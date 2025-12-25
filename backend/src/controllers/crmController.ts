import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

const router = Router();

// Dashboard principal
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Estatísticas gerais
    const stats = await query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE stage = 'new') as new_leads,
        COUNT(*) FILTER (WHERE stage = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE stage = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE stage = 'opportunity') as opportunities,
        COUNT(*) FILTER (WHERE stage = 'customer') as customers,
        COUNT(*) FILTER (WHERE temperature = 'hot') as hot_leads,
        COUNT(*) FILTER (WHERE is_contacted = true) as contacted_total,
        AVG(icp_score) as avg_icp_score
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Leads por dia (últimos 30 dias)
    const dailyLeads = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Top segmentos
    const topSegments = await query(`
      SELECT 
        c.segment,
        COUNT(l.id) as lead_count,
        AVG(l.icp_score) as avg_score
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      WHERE l.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.segment
      ORDER BY lead_count DESC
      LIMIT 10
    `);

    // Conversão por fonte
    const conversionBySource = await query(`
      SELECT 
        source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE stage IN ('qualified', 'opportunity', 'customer')) as converted,
        ROUND(
          COUNT(*) FILTER (WHERE stage IN ('qualified', 'opportunity', 'customer')) * 100.0 / COUNT(*), 
          2
        ) as conversion_rate
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source
      ORDER BY conversion_rate DESC
    `);

    res.json({
      overview: stats.rows[0],
      daily_leads: dailyLeads.rows,
      top_segments: topSegments.rows,
      conversion_by_source: conversionBySource.rows
    });

  } catch (error) {
    logger.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Pipeline de vendas (Kanban)
router.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const pipeline = await query(`
      SELECT 
        l.stage,
        COUNT(*) as count,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', l.id,
            'name', l.name,
            'company_name', c.name,
            'icp_score', l.icp_score,
            'temperature', l.temperature,
            'last_contact_date', l.last_contact_date,
            'created_at', l.created_at
          ) ORDER BY l.icp_score DESC, l.created_at DESC
        ) as leads
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      WHERE l.stage IN ('new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost')
      GROUP BY l.stage
      ORDER BY 
        CASE l.stage 
          WHEN 'new' THEN 1
          WHEN 'contacted' THEN 2
          WHEN 'qualified' THEN 3
          WHEN 'opportunity' THEN 4
          WHEN 'customer' THEN 5
          WHEN 'lost' THEN 6
        END
    `);

    // Estruturar dados para Kanban
    const stages = [
      { id: 'new', name: 'Novos Leads', leads: [], count: 0 },
      { id: 'contacted', name: 'Contatados', leads: [], count: 0 },
      { id: 'qualified', name: 'Qualificados', leads: [], count: 0 },
      { id: 'opportunity', name: 'Oportunidades', leads: [], count: 0 },
      { id: 'customer', name: 'Clientes', leads: [], count: 0 },
      { id: 'lost', name: 'Perdidos', leads: [], count: 0 }
    ];

    pipeline.rows.forEach(row => {
      const stage = stages.find(s => s.id === row.stage);
      if (stage) {
        stage.leads = row.leads || [];
        stage.count = parseInt(row.count);
      }
    });

    res.json({ stages });

  } catch (error) {
    logger.error('Erro ao buscar pipeline:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de performance SDR
router.get('/reports/sdr-performance', async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;

    const performance = await query(`
      SELECT 
        DATE_TRUNC('day', i.created_at) as date,
        COUNT(*) FILTER (WHERE i.type = 'whatsapp') as whatsapp_sent,
        COUNT(*) FILTER (WHERE i.type = 'email') as emails_sent,
        COUNT(*) FILTER (WHERE i.direction = 'inbound') as responses_received,
        COUNT(DISTINCT i.lead_id) as leads_contacted,
        COUNT(*) FILTER (WHERE i.sentiment = 'positive') as positive_responses,
        COUNT(*) FILTER (WHERE i.sentiment = 'negative') as negative_responses
      FROM interactions i
      WHERE i.created_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('day', i.created_at)
      ORDER BY date DESC
    `);

    // Métricas de conversão
    const conversion = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE stage = 'new') as new_leads,
        COUNT(*) FILTER (WHERE stage = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE stage = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE stage = 'opportunity') as opportunities,
        COUNT(*) FILTER (WHERE stage = 'customer') as customers,
        ROUND(
          COUNT(*) FILTER (WHERE stage IN ('qualified', 'opportunity', 'customer')) * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE stage != 'new'), 0), 
          2
        ) as qualification_rate,
        ROUND(
          COUNT(*) FILTER (WHERE stage = 'customer') * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE stage = 'opportunity'), 0), 
          2
        ) as close_rate
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days'
    `);

    res.json({
      daily_performance: performance.rows,
      conversion_metrics: conversion.rows[0]
    });

  } catch (error) {
    logger.error('Erro ao buscar relatório SDR:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Mover lead no pipeline
router.put('/pipeline/move', async (req: Request, res: Response) => {
  try {
    const { leadId, newStage, notes } = req.body;

    if (!leadId || !newStage) {
      return res.status(400).json({ 
        error: 'Lead ID e novo estágio são obrigatórios' 
      });
    }

    // Atualizar lead
    const result = await query(`
      UPDATE leads 
      SET stage = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [newStage, leadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Registrar atividade
    if (notes) {
      await query(`
        INSERT INTO interactions (lead_id, type, content, direction)
        VALUES ($1, 'stage_change', $2, 'internal')
      `, [leadId, `Movido para: ${newStage}. ${notes}`]);
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Erro ao mover lead:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;