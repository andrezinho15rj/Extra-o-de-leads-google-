import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

const router = Router();

// Listar campanhas
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaigns = await query(`
      SELECT 
        c.*,
        u.name as created_by_name,
        COUNT(l.id) as total_leads
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN leads l ON c.id = l.campaign_id
      GROUP BY c.id, u.name
      ORDER BY c.created_at DESC
    `);

    res.json(campaigns.rows);

  } catch (error) {
    logger.error('Erro ao listar campanhas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar campanha
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      target_segment,
      target_location,
      source_channels,
      leads_target,
      extraction_config
    } = req.body;

    if (!name || !target_segment || !target_location) {
      return res.status(400).json({ 
        error: 'Nome, segmento e localização são obrigatórios' 
      });
    }

    const result = await query(`
      INSERT INTO campaigns (
        name, description, target_segment, target_location,
        source_channels, leads_target, extraction_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      name,
      description,
      target_segment,
      target_location,
      source_channels || ['google_maps'],
      leads_target || 100,
      extraction_config || {}
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    logger.error('Erro ao criar campanha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;