import puppeteer from 'puppeteer';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface GoogleMapsLead {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: string;
  reviews?: number;
  category?: string;
}

export class GoogleMapsExtractor {
  private browser: any;
  private page: any;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Configurar user agent para evitar detecção
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await this.page.setViewport({ width: 1366, height: 768 });
  }

  async extractLeads(segment: string, location: string, limit: number = 100): Promise<GoogleMapsLead[]> {
    try {
      if (!this.browser) await this.initialize();

      const searchQuery = `${segment} em ${location}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      
      logger.info(`Iniciando extração: ${searchQuery}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);

      // Aguardar carregamento dos resultados
      await this.page.waitForSelector('[role="main"]', { timeout: 10000 });

      const leads: GoogleMapsLead[] = [];
      let scrollAttempts = 0;
      const maxScrolls = Math.ceil(limit / 20); // ~20 resultados por scroll

      while (leads.length < limit && scrollAttempts < maxScrolls) {
        // Extrair dados da página atual
        const pageLeads = await this.page.evaluate(() => {
          const results: GoogleMapsLead[] = [];
          const elements = document.querySelectorAll('[data-result-index]');

          elements.forEach((element: any) => {
            try {
              const nameElement = element.querySelector('[class*="fontHeadlineSmall"]');
              const addressElement = element.querySelector('[class*="fontBodyMedium"] span[title]');
              const phoneElement = element.querySelector('[data-value="Telefone"]');
              const websiteElement = element.querySelector('[data-value="Website"]');
              const ratingElement = element.querySelector('[class*="fontBodyMedium"] span[aria-label*="estrelas"]');
              const categoryElement = element.querySelector('[class*="fontBodyMedium"]:not([title])');

              if (nameElement) {
                const lead: GoogleMapsLead = {
                  name: nameElement.textContent?.trim() || '',
                  address: addressElement?.getAttribute('title') || '',
                  phone: phoneElement?.textContent?.trim(),
                  website: websiteElement?.getAttribute('href'),
                  rating: ratingElement?.textContent?.trim(),
                  category: categoryElement?.textContent?.trim()
                };

                if (lead.name && lead.address) {
                  results.push(lead);
                }
              }
            } catch (error) {
              console.log('Erro ao extrair elemento:', error);
            }
          });

          return results;
        });

        // Adicionar novos leads únicos
        pageLeads.forEach(lead => {
          if (!leads.find(existing => existing.name === lead.name && existing.address === lead.address)) {
            leads.push(lead);
          }
        });

        // Scroll para carregar mais resultados
        await this.page.evaluate(() => {
          const sidebar = document.querySelector('[role="main"]');
          if (sidebar) {
            sidebar.scrollTop = sidebar.scrollHeight;
          }
        });

        await this.page.waitForTimeout(2000);
        scrollAttempts++;

        logger.info(`Scroll ${scrollAttempts}: ${leads.length} leads coletados`);
      }

      logger.info(`Extração concluída: ${leads.length} leads encontrados`);
      return leads.slice(0, limit);

    } catch (error) {
      logger.error('Erro na extração do Google Maps:', error);
      throw error;
    }
  }

  async saveLeads(leads: GoogleMapsLead[], campaignId: string, segment: string, location: string) {
    const client = await query('BEGIN');
    
    try {
      let savedCount = 0;
      let updatedCount = 0;
      let duplicatedCount = 0;

      for (const lead of leads) {
        // Verificar se empresa já existe
        const existingCompany = await query(
          'SELECT id FROM companies WHERE name = $1 AND city = $2',
          [lead.name, location]
        );

        let companyId: string;

        if (existingCompany.rows.length > 0) {
          companyId = existingCompany.rows[0].id;
          duplicatedCount++;
        } else {
          // Criar nova empresa
          const newCompany = await query(`
            INSERT INTO companies (name, segment, city, address, phone, website)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [lead.name, segment, location, lead.address, lead.phone, lead.website]);
          
          companyId = newCompany.rows[0].id;
        }

        // Verificar se lead já existe
        const existingLead = await query(
          'SELECT id FROM leads WHERE company_id = $1 AND source = $2',
          [companyId, 'google_maps']
        );

        if (existingLead.rows.length === 0) {
          // Criar novo lead
          await query(`
            INSERT INTO leads (
              company_id, campaign_id, name, phone, source, 
              source_url, icp_score, temperature, stage
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            companyId, campaignId, lead.name, lead.phone, 'google_maps',
            `https://www.google.com/maps/search/${encodeURIComponent(lead.name)}`,
            this.calculateICPScore(lead), 'cold', 'new'
          ]);
          
          savedCount++;
        } else {
          // Atualizar lead existente
          await query(`
            UPDATE leads SET 
              phone = COALESCE($1, phone),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [lead.phone, existingLead.rows[0].id]);
          
          updatedCount++;
        }
      }

      await query('COMMIT');

      logger.info(`Leads salvos: ${savedCount} novos, ${updatedCount} atualizados, ${duplicatedCount} duplicados`);
      
      return { savedCount, updatedCount, duplicatedCount };

    } catch (error) {
      await query('ROLLBACK');
      logger.error('Erro ao salvar leads:', error);
      throw error;
    }
  }

  private calculateICPScore(lead: GoogleMapsLead): number {
    let score = 0;
    
    // Pontuação base
    score += 20;
    
    // Tem telefone
    if (lead.phone) score += 30;
    
    // Tem website
    if (lead.website) score += 25;
    
    // Tem avaliação boa
    if (lead.rating) {
      const rating = parseFloat(lead.rating);
      if (rating >= 4.0) score += 15;
      else if (rating >= 3.0) score += 10;
    }
    
    // Endereço completo
    if (lead.address && lead.address.length > 20) score += 10;
    
    return Math.min(score, 100);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}