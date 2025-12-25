-- =============================================
-- SDR AUTOMATIZADO - SCHEMA POSTGRESQL
-- =============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- TABELA: users (Usuários do sistema)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: companies (Empresas)
-- =============================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18),
    segment VARCHAR(100),
    size_category VARCHAR(50), -- micro, pequena, media, grande
    city VARCHAR(100),
    state VARCHAR(2),
    address TEXT,
    website VARCHAR(255),
    instagram VARCHAR(255),
    facebook VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    employee_count INTEGER,
    revenue_estimate DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: campaigns (Campanhas de extração)
-- =============================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_segment VARCHAR(100),
    target_location VARCHAR(100),
    source_channels TEXT[], -- ['google_maps', 'instagram', 'facebook']
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed
    leads_target INTEGER,
    leads_extracted INTEGER DEFAULT 0,
    extraction_config JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: leads (Leads coletados)
-- =============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    campaign_id UUID REFERENCES campaigns(id),
    
    -- Dados básicos
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    position VARCHAR(100),
    
    -- Classificação
    icp_score INTEGER DEFAULT 0, -- 0-100
    temperature VARCHAR(20) DEFAULT 'cold', -- hot, warm, cold
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    stage VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, opportunity, customer, lost
    
    -- Origem
    source VARCHAR(50) NOT NULL, -- google_maps, instagram, facebook, etc
    source_url TEXT,
    extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Dados enriquecidos
    linkedin_url VARCHAR(255),
    additional_data JSONB,
    
    -- Controle
    is_qualified BOOLEAN DEFAULT false,
    is_contacted BOOLEAN DEFAULT false,
    last_contact_date TIMESTAMP,
    next_contact_date TIMESTAMP,
    assigned_to UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: interactions (Interações com leads)
-- =============================================
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    type VARCHAR(50) NOT NULL, -- call, email, whatsapp, meeting, note
    channel VARCHAR(50), -- whatsapp, email, instagram, facebook
    direction VARCHAR(20), -- inbound, outbound
    
    subject VARCHAR(255),
    content TEXT,
    response TEXT,
    
    status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, replied, failed
    sentiment VARCHAR(20), -- positive, neutral, negative
    
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    metadata JSONB, -- dados específicos do canal
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: message_templates (Templates de mensagem)
-- =============================================
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- first_contact, follow_up, objection_handling
    channel VARCHAR(50) NOT NULL, -- whatsapp, email, instagram
    segment VARCHAR(100),
    
    subject VARCHAR(255),
    content TEXT NOT NULL,
    variables TEXT[], -- variáveis disponíveis
    
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: sequences (Sequências de follow-up)
-- =============================================
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    segment VARCHAR(100),
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: sequence_steps (Passos da sequência)
-- =============================================
CREATE TABLE sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
    template_id UUID REFERENCES message_templates(id),
    
    step_order INTEGER NOT NULL,
    delay_days INTEGER DEFAULT 1,
    delay_hours INTEGER DEFAULT 0,
    
    conditions JSONB, -- condições para executar o passo
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABELA: lead_sequences (Leads em sequências)
-- =============================================
CREATE TABLE lead_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id UUID REFERENCES sequences(id),
    
    current_step INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, stopped
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_execution TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Leads
CREATE INDEX idx_leads_company_id ON leads(company_id);
CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_temperature ON leads(temperature);
CREATE INDEX idx_leads_icp_score ON leads(icp_score DESC);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- Companies
CREATE INDEX idx_companies_segment ON companies(segment);
CREATE INDEX idx_companies_city_state ON companies(city, state);
CREATE INDEX idx_companies_name_trgm ON companies USING gin(name gin_trgm_ops);

-- Interactions
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_interactions_created_at ON interactions(created_at DESC);

-- Sequences
CREATE INDEX idx_lead_sequences_lead_id ON lead_sequences(lead_id);
CREATE INDEX idx_lead_sequences_status ON lead_sequences(status);
CREATE INDEX idx_lead_sequences_next_execution ON lead_sequences(next_execution);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();