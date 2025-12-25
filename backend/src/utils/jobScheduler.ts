import cron from 'node-cron';
import { SDREngine } from '../sdr/sdrEngine';
import { logger } from '../utils/logger';

const sdrEngine = new SDREngine();

export class JobScheduler {
  
  static start() {
    logger.info('🕐 Iniciando agendador de jobs...');

    // Qualificar leads a cada 1 hora
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('🤖 Executando qualificação automática de leads...');
        await sdrEngine.qualifyLeads();
        logger.info('✅ Qualificação de leads concluída');
      } catch (error) {
        logger.error('❌ Erro na qualificação automática:', error);
      }
    });

    // Executar sequências a cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      try {
        logger.info('📨 Executando sequências de contato...');
        await sdrEngine.executeSequenceSteps();
        logger.info('✅ Sequências executadas');
      } catch (error) {
        logger.error('❌ Erro na execução de sequências:', error);
      }
    });

    // Analisar respostas a cada 15 minutos
    cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('🔍 Analisando respostas de leads...');
        await sdrEngine.analyzeResponses();
        logger.info('✅ Análise de respostas concluída');
      } catch (error) {
        logger.error('❌ Erro na análise de respostas:', error);
      }
    });

    // Limpeza de logs antigos - diariamente às 2h
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('🧹 Executando limpeza de logs antigos...');
        await this.cleanOldLogs();
        logger.info('✅ Limpeza de logs concluída');
      } catch (error) {
        logger.error('❌ Erro na limpeza de logs:', error);
      }
    });

    // Relatório diário - todos os dias às 8h
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('📊 Gerando relatório diário...');
        await this.generateDailyReport();
        logger.info('✅ Relatório diário gerado');
      } catch (error) {
        logger.error('❌ Erro na geração do relatório:', error);
      }
    });

    logger.info('✅ Jobs agendados com sucesso!');
  }

  private static async cleanOldLogs() {
    const { query } = await import('../database/connection');
    
    // Remover logs de sistema com mais de 90 dias
    await query(`
      DELETE FROM system_logs 
      WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    `);

    // Remover logs de extração com mais de 30 dias
    await query(`
      DELETE FROM extraction_logs 
      WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
    `);

    logger.info('Logs antigos removidos');
  }

  private static async generateDailyReport() {
    const { query } = await import('../database/connection');
    
    // Estatísticas do dia anterior
    const stats = await query(`
      SELECT 
        COUNT(*) as new_leads,
        COUNT(*) FILTER (WHERE is_contacted = true) as contacted_leads,
        COUNT(*) FILTER (WHERE stage = 'qualified') as qualified_leads,
        AVG(icp_score) as avg_score
      FROM leads 
      WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    `);

    // Interações do dia anterior
    const interactions = await query(`
      SELECT 
        COUNT(*) as total_interactions,
        COUNT(*) FILTER (WHERE type = 'whatsapp') as whatsapp_sent,
        COUNT(*) FILTER (WHERE type = 'email') as emails_sent,
        COUNT(*) FILTER (WHERE direction = 'inbound') as responses_received
      FROM interactions 
      WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    `);

    const report = {
      date: new Date().toISOString().split('T')[0],
      leads: stats.rows[0],
      interactions: interactions.rows[0]
    };

    logger.info('Relatório diário:', report);
    
    // Aqui você pode enviar por email, salvar em arquivo, etc.
  }
}