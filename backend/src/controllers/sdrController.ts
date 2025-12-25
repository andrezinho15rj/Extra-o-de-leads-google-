import { Router, Request, Response } from 'express';
import { SDREngine } from '../sdr/sdrEngine';
import { logger } from '../utils/logger';

const router = Router();
const sdrEngine = new SDREngine();

// Qualificar leads automaticamente
router.post('/qualify', async (req: Request, res: Response) => {
  try {
    await sdrEngine.qualifyLeads();
    
    res.json({
      message: 'Qualificação de leads executada com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro na qualificação de leads:', error);
    res.status(500).json({ 
      error: 'Erro na qualificação de leads',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Iniciar sequência de contato
router.post('/sequences/start', async (req: Request, res: Response) => {
  try {
    const { leadId, sequenceId } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID é obrigatório' });
    }

    await sdrEngine.startContactSequence(leadId, sequenceId);
    
    res.json({
      message: 'Sequência iniciada com sucesso',
      leadId,
      sequenceId
    });

  } catch (error) {
    logger.error('Erro ao iniciar sequência:', error);
    res.status(500).json({ 
      error: 'Erro ao iniciar sequência',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Executar próximos passos das sequências
router.post('/sequences/execute', async (req: Request, res: Response) => {
  try {
    await sdrEngine.executeSequenceSteps();
    
    res.json({
      message: 'Sequências executadas com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro na execução de sequências:', error);
    res.status(500).json({ 
      error: 'Erro na execução de sequências',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Analisar respostas
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    await sdrEngine.analyzeResponses();
    
    res.json({
      message: 'Análise de respostas executada com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro na análise de respostas:', error);
    res.status(500).json({ 
      error: 'Erro na análise de respostas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;