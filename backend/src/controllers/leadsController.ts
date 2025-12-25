import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { GoogleMapsExtractor } from '../extractors/googleMapsExtractor';
import { logger } from '../utils/logger';

const router = Router();

// Listar leads com filtros
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      stage,
      temperature,
      segment,
      city,
      source,
      search
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    let whereConditions = ['l.is_active = true'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Filtros
    if (stage) {
      whereConditions.push(`l.stage = $${paramIndex++}`);
      queryParams.push(stage);
    }
    
    if (temperature) {
      whereConditions.push(`l.temperature = $${paramIndex++}`);
      queryParams.push(temperature);
    }
    
    if (segment) {
      whereConditions.push(`c.segment ILIKE $${paramIndex++}`);
      queryParams.push(`%${segment}%`);
    }
    
    if (city) {
      whereConditions.push(`c.city ILIKE $${paramIndex++}`);
      queryParams.push(`%${city}%`);
    }
    
    if (source) {
      whereConditions.push(`l.source = $${paramIndex++}`);
      queryParams.push(source);
    }
    
    if (search) {
      whereConditions.push(`(l.name ILIKE $${paramIndex++} OR c.name ILIKE $${paramIndex++})`);
      queryParams.push(`%${search}%`, `%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query principal
    const leadsQuery = `
      SELECT 
        l.*,
        c.name as company_name,
        c.segment,
        c.city,
        c.state,
        c.phone as company_phone,
        c.website,
        c.instagram,
        (SELECT COUNT(*) FROM interactions WHERE lead_id = l.id) as interactions_count,
        (SELECT created_at FROM interactions WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_interaction
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      ${whereClause}
      ORDER BY l.icp_score DESC, l.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(Number(limit), offset);

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      ${whereClause}
    `;

    const [leadsResult, countResult] = await Promise.all([
      query(leadsQuery, queryParams.slice(0, -2)), // Remove limit e offset para count
      query(countQuery, queryParams.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      leads: leadsResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error) {
    logger.error('Erro ao listar leads:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar lead por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const leadResult = await query(`
      SELECT 
        l.*,
        c.name as company_name,
        c.segment,
        c.city,
        c.state,
        c.address,
        c.phone as company_phone,
        c.email as company_email,
        c.website,
        c.instagram,
        c.facebook
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      WHERE l.id = $1
    `, [id]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Buscar interações
    const interactionsResult = await query(`
      SELECT * FROM interactions 
      WHERE lead_id = $1 
      ORDER BY created_at DESC
    `, [id]);

    const lead = {
      ...leadResult.rows[0],
      interactions: interactionsResult.rows
    };

    res.json(lead);

  } catch (error) {
    logger.error('Erro ao buscar lead:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar lead
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      stage,
      temperature,
      priority,
      icp_score,
      assigned_to,
      next_contact_date,
      notes
    } = req.body;

    const updateFields: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (stage !== undefined) {
      updateFields.push(`stage = $${paramIndex++}`);
      queryParams.push(stage);
    }
    
    if (temperature !== undefined) {
      updateFields.push(`temperature = $${paramIndex++}`);
      queryParams.push(temperature);
    }
    
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      queryParams.push(priority);
    }
    
    if (icp_score !== undefined) {
      updateFields.push(`icp_score = $${paramIndex++}`);
      queryParams.push(icp_score);
    }
    
    if (assigned_to !== undefined) {
      updateFields.push(`assigned_to = $${paramIndex++}`);
      queryParams.push(assigned_to);
    }
    
    if (next_contact_date !== undefined) {
      updateFields.push(`next_contact_date = $${paramIndex++}`);
      queryParams.push(next_contact_date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(id);

    const updateQuery = `
      UPDATE leads 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Registrar atividade
    if (notes) {
      await query(`
        INSERT INTO interactions (lead_id, type, content, direction)
        VALUES ($1, 'note', $2, 'internal')
      `, [id, notes]);
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Erro ao atualizar lead:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Extrair leads do Google Maps
router.post('/extract/google-maps', async (req: Request, res: Response) => {
  try {
    const { segment, location, limit = 100, campaignId } = req.body;

    if (!segment || !location) {
      return res.status(400).json({ 
        error: 'Segmento e localização são obrigatórios' 
      });
    }

    logger.info(`Iniciando extração: ${segment} em ${location}`);

    const extractor = new GoogleMapsExtractor();
    
    // Extrair leads
    const leads = await extractor.extractLeads(segment, location, limit);
    
    // Salvar no banco
    const saveResult = await extractor.saveLeads(leads, campaignId, segment, location);
    
    await extractor.close();

    res.json({
      message: 'Extração concluída com sucesso',
      results: {
        total_found: leads.length,
        ...saveResult
      }
    });

  } catch (error) {
    logger.error('Erro na extração:', error);
    res.status(500).json({ 
      error: 'Erro na extração de leads',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Adicionar interação manual
router.post('/:id/interactions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, channel, content, direction = 'outbound' } = req.body;

    if (!type || !content) {
      return res.status(400).json({ 
        error: 'Tipo e conteúdo são obrigatórios' 
      });
    }

    const result = await query(`
      INSERT INTO interactions (lead_id, type, channel, content, direction, status)
      VALUES ($1, $2, $3, $4, $5, 'completed')
      RETURNING *
    `, [id, type, channel, content, direction]);

    // Atualizar lead
    await query(`
      UPDATE leads SET 
        is_contacted = true,
        last_contact_date = CURRENT_TIMESTAMP,
        stage = CASE WHEN stage = 'new' THEN 'contacted' ELSE stage END
      WHERE id = $1
    `, [id]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    logger.error('Erro ao adicionar interação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas de leads
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE stage = 'new') as new_leads,
        COUNT(*) FILTER (WHERE stage = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE stage = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE temperature = 'hot') as hot_leads,
        COUNT(*) FILTER (WHERE temperature = 'warm') as warm_leads,
        COUNT(*) FILTER (WHERE temperature = 'cold') as cold_leads,
        AVG(icp_score) as avg_icp_score
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const sourceStats = await query(`
      SELECT source, COUNT(*) as count
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source
      ORDER BY count DESC
    `);

    res.json({
      overview: stats.rows[0],
      by_source: sourceStats.rows
    });

  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;