import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company_name: string;
  segment: string;
  city: string;
  icp_score: number;
  temperature: string;
  stage: string;
}

interface MessageTemplate {
  id: string;
  content: string;
  variables: string[];
  channel: string;
  type: string;
}

export class SDREngine {
  
  // Qualificar leads automaticamente
  async qualifyLeads(): Promise<void> {
    try {
      logger.info('Iniciando qualificação automática de leads');

      // Buscar leads não qualificados
      const unqualifiedLeads = await query(`
        SELECT l.*, c.name as company_name, c.segment, c.city, c.website, c.instagram
        FROM leads l
        JOIN companies c ON l.company_id = c.id
        WHERE l.is_qualified = false AND l.stage = 'new'
        ORDER BY l.created_at DESC
        LIMIT 100
      `);

      for (const lead of unqualifiedLeads.rows) {
        const qualificationData = await this.performQualification(lead);
        
        await query(`
          UPDATE leads SET 
            icp_score = $1,
            temperature = $2,
            priority = $3,
            is_qualified = true,
            stage = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [
          qualificationData.icpScore,
          qualificationData.temperature,
          qualificationData.priority,
          qualificationData.stage,
          lead.id
        ]);

        logger.info(`Lead qualificado: ${lead.name} - Score: ${qualificationData.icpScore}`);
      }

      logger.info(`Qualificação concluída: ${unqualifiedLeads.rows.length} leads processados`);

    } catch (error) {
      logger.error('Erro na qualificação de leads:', error);
      throw error;
    }
  }

  private async performQualification(lead: any) {
    let icpScore = 0;
    let temperature = 'cold';
    let priority = 'low';
    let stage = 'qualified';

    // Critérios de qualificação
    
    // 1. Dados de contato (40 pontos)
    if (lead.phone) icpScore += 20;
    if (lead.email) icpScore += 20;

    // 2. Presença digital (30 pontos)
    if (lead.website) icpScore += 15;
    if (lead.instagram) icpScore += 15;

    // 3. Segmento alvo (20 pontos)
    const targetSegments = ['restaurante', 'loja', 'clinica', 'escritorio', 'academia'];
    if (targetSegments.some(seg => lead.segment?.toLowerCase().includes(seg))) {
      icpScore += 20;
    }

    // 4. Localização (10 pontos)
    const targetCities = ['sao paulo', 'rio de janeiro', 'belo horizonte', 'curitiba', 'porto alegre'];
    if (targetCities.some(city => lead.city?.toLowerCase().includes(city))) {
      icpScore += 10;
    }

    // Definir temperatura baseada no score
    if (icpScore >= 80) {
      temperature = 'hot';
      priority = 'high';
    } else if (icpScore >= 60) {
      temperature = 'warm';
      priority = 'medium';
    } else {
      temperature = 'cold';
      priority = 'low';
    }

    return { icpScore, temperature, priority, stage };
  }

  // Iniciar sequência de contato automática
  async startContactSequence(leadId: string, sequenceId?: string): Promise<void> {
    try {
      // Buscar lead
      const leadResult = await query(`
        SELECT l.*, c.name as company_name, c.segment, c.city
        FROM leads l
        JOIN companies c ON l.company_id = c.id
        WHERE l.id = $1
      `, [leadId]);

      if (leadResult.rows.length === 0) {
        throw new Error('Lead não encontrado');
      }

      const lead = leadResult.rows[0];

      // Definir sequência baseada no perfil do lead
      let finalSequenceId = sequenceId;
      if (!finalSequenceId) {
        finalSequenceId = await this.selectBestSequence(lead);
      }

      // Iniciar sequência
      await query(`
        INSERT INTO lead_sequences (lead_id, sequence_id, current_step, status, next_execution)
        VALUES ($1, $2, 1, 'active', CURRENT_TIMESTAMP + INTERVAL '1 hour')
      `, [leadId, finalSequenceId]);

      logger.info(`Sequência iniciada para lead: ${lead.name}`);

    } catch (error) {
      logger.error('Erro ao iniciar sequência:', error);
      throw error;
    }
  }

  private async selectBestSequence(lead: any): Promise<string> {
    // Lógica para selecionar melhor sequência baseada no perfil
    const sequences = await query(`
      SELECT id, segment FROM sequences 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);

    // Priorizar sequência específica do segmento
    const segmentSequence = sequences.rows.find(seq => 
      seq.segment?.toLowerCase() === lead.segment?.toLowerCase()
    );

    if (segmentSequence) {
      return segmentSequence.id;
    }

    // Retornar sequência padrão
    return sequences.rows[0]?.id || null;
  }

  // Executar próximos passos das sequências
  async executeSequenceSteps(): Promise<void> {
    try {
      logger.info('Executando passos de sequências');

      // Buscar sequências prontas para execução
      const readySequences = await query(`
        SELECT ls.*, l.name as lead_name, l.phone, l.email,
               c.name as company_name, c.segment, c.city,
               s.name as sequence_name
        FROM lead_sequences ls
        JOIN leads l ON ls.lead_id = l.id
        JOIN companies c ON l.company_id = c.id
        JOIN sequences s ON ls.sequence_id = s.id
        WHERE ls.status = 'active' 
        AND ls.next_execution <= CURRENT_TIMESTAMP
        ORDER BY ls.next_execution ASC
        LIMIT 50
      `);

      for (const sequence of readySequences.rows) {
        await this.executeSequenceStep(sequence);
      }

      logger.info(`Sequências executadas: ${readySequences.rows.length}`);

    } catch (error) {
      logger.error('Erro na execução de sequências:', error);
      throw error;
    }
  }

  private async executeSequenceStep(sequence: any): Promise<void> {
    try {
      // Buscar passo atual da sequência
      const stepResult = await query(`
        SELECT ss.*, mt.content, mt.channel, mt.variables, mt.subject
        FROM sequence_steps ss
        JOIN message_templates mt ON ss.template_id = mt.id
        WHERE ss.sequence_id = $1 AND ss.step_order = $2
      `, [sequence.sequence_id, sequence.current_step]);

      if (stepResult.rows.length === 0) {
        // Sequência concluída
        await query(`
          UPDATE lead_sequences SET 
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [sequence.id]);
        return;
      }

      const step = stepResult.rows[0];

      // Personalizar mensagem
      const personalizedMessage = this.personalizeMessage(step.content, {
        name: sequence.lead_name,
        company: sequence.company_name,
        segment: sequence.segment,
        city: sequence.city
      });

      // Enviar mensagem
      await this.sendMessage({
        leadId: sequence.lead_id,
        channel: step.channel,
        content: personalizedMessage,
        subject: step.subject
      });

      // Atualizar sequência para próximo passo
      const nextStep = sequence.current_step + 1;
      const nextExecution = new Date();
      nextExecution.setDate(nextExecution.getDate() + (step.delay_days || 1));
      nextExecution.setHours(nextExecution.getHours() + (step.delay_hours || 0));

      await query(`
        UPDATE lead_sequences SET 
          current_step = $1,
          next_execution = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [nextStep, nextExecution, sequence.id]);

      logger.info(`Passo executado: ${sequence.lead_name} - Passo ${sequence.current_step}`);

    } catch (error) {
      logger.error(`Erro ao executar passo da sequência ${sequence.id}:`, error);
      
      // Marcar sequência como erro
      await query(`
        UPDATE lead_sequences SET 
          status = 'error',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [sequence.id]);
    }
  }

  private personalizeMessage(template: string, variables: any): string {
    let message = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, variables[key] || '');
    });

    return message;
  }

  private async sendMessage(messageData: {
    leadId: string;
    channel: string;
    content: string;
    subject?: string;
  }): Promise<void> {
    try {
      // Registrar interação
      await query(`
        INSERT INTO interactions (
          lead_id, type, channel, direction, subject, content, status
        ) VALUES ($1, $2, $3, 'outbound', $4, $5, 'sent')
      `, [
        messageData.leadId,
        messageData.channel,
        messageData.channel,
        messageData.subject,
        messageData.content
      ]);

      // Atualizar lead
      await query(`
        UPDATE leads SET 
          is_contacted = true,
          last_contact_date = CURRENT_TIMESTAMP,
          stage = CASE WHEN stage = 'new' THEN 'contacted' ELSE stage END
        WHERE id = $1
      `, [messageData.leadId]);

      // Aqui seria integrado com APIs reais (WhatsApp, Email, etc.)
      logger.info(`Mensagem enviada via ${messageData.channel} para lead ${messageData.leadId}`);

    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  // Analisar respostas e ajustar estratégia
  async analyzeResponses(): Promise<void> {
    try {
      logger.info('Analisando respostas de leads');

      // Buscar interações com respostas não analisadas
      const responses = await query(`
        SELECT i.*, l.id as lead_id, l.stage
        FROM interactions i
        JOIN leads l ON i.lead_id = l.id
        WHERE i.response IS NOT NULL 
        AND i.sentiment IS NULL
        AND i.direction = 'inbound'
        ORDER BY i.created_at DESC
        LIMIT 100
      `);

      for (const response of responses.rows) {
        const sentiment = this.analyzeSentiment(response.response);
        
        await query(`
          UPDATE interactions SET 
            sentiment = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [sentiment, response.id]);

        // Ajustar estratégia baseada na resposta
        await this.adjustLeadStrategy(response.lead_id, sentiment, response.response);
      }

      logger.info(`Respostas analisadas: ${responses.rows.length}`);

    } catch (error) {
      logger.error('Erro na análise de respostas:', error);
      throw error;
    }
  }

  private analyzeSentiment(text: string): string {
    // Análise simples de sentimento
    const positiveWords = ['sim', 'interessado', 'quero', 'gostaria', 'pode', 'vamos'];
    const negativeWords = ['não', 'nao', 'nunca', 'pare', 'remover', 'sair'];
    
    const lowerText = text.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private async adjustLeadStrategy(leadId: string, sentiment: string, response: string): Promise<void> {
    try {
      if (sentiment === 'positive') {
        // Lead interessado - acelerar processo
        await query(`
          UPDATE leads SET 
            temperature = 'hot',
            priority = 'high',
            stage = 'qualified',
            next_contact_date = CURRENT_TIMESTAMP + INTERVAL '1 day'
          WHERE id = $1
        `, [leadId]);

      } else if (sentiment === 'negative') {
        // Lead não interessado - pausar sequência
        await query(`
          UPDATE lead_sequences SET 
            status = 'paused'
          WHERE lead_id = $1 AND status = 'active'
        `, [leadId]);

        await query(`
          UPDATE leads SET 
            stage = 'not_interested',
            temperature = 'cold'
          WHERE id = $1
        `, [leadId]);
      }

    } catch (error) {
      logger.error('Erro ao ajustar estratégia do lead:', error);
    }
  }
}