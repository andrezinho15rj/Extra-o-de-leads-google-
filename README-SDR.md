# 🚀 SDR AUTOMATIZADO - Sistema Completo

Sistema completo de **extração, qualificação, gestão e conversão de leads** que substitui totalmente o trabalho manual de um SDR humano, operando de forma automática, inteligente e escalável.

## 🎯 FUNCIONALIDADES PRINCIPAIS

### 🔍 **1. EXTRAÇÃO MULTICANAL**
- ✅ Google Maps (implementado)
- 🔄 Google Search (em desenvolvimento)
- 🔄 Instagram (planejado)
- 🔄 Facebook (planejado)
- 🔄 Sites institucionais (planejado)

### 🤖 **2. SDR AUTOMATIZADO**
- ✅ Qualificação automática por IA
- ✅ Sistema de pontuação (ICP Score)
- ✅ Classificação por temperatura (Hot/Warm/Cold)
- ✅ Sequências de follow-up automáticas
- ✅ Mensagens personalizadas

### 📊 **3. CRM COMPLETO**
- ✅ Pipeline de vendas (Kanban)
- ✅ Gestão de leads e oportunidades
- ✅ Histórico completo de interações
- ✅ Relatórios e dashboards
- ✅ Filtros avançados

### 🗄️ **4. BANCO DE DADOS**
- ✅ PostgreSQL com schema otimizado
- ✅ Índices para alta performance
- ✅ Relacionamentos bem definidos
- ✅ Logs de auditoria completos

## 🏗️ ARQUITETURA

```
📁 sdr-automatizado/
├── 🔧 backend/              # API Node.js + TypeScript
│   ├── src/
│   │   ├── controllers/     # Controladores REST
│   │   ├── services/        # Lógica de negócio
│   │   ├── extractors/      # Extratores de leads
│   │   ├── sdr/            # Motor SDR
│   │   ├── database/       # Configuração DB
│   │   └── utils/          # Utilitários
│   └── database/
│       └── schema.sql      # Schema PostgreSQL
├── 🎨 frontend/            # React + TypeScript
├── 🐳 docker/              # Configurações Docker
└── 📚 docs/               # Documentação
```

## 🚀 INSTALAÇÃO E CONFIGURAÇÃO

### **Pré-requisitos**
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (opcional)

### **1. Configuração do Banco**

```bash
# Criar banco PostgreSQL
createdb sdr_automatizado

# Executar schema
psql -d sdr_automatizado -f backend/database/schema.sql
```

### **2. Backend**

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Executar em desenvolvimento
npm run dev
```

### **3. Frontend**

```bash
cd frontend

# Instalar dependências
npm install

# Executar em desenvolvimento
npm start
```

### **4. Docker (Alternativa)**

```bash
# Subir todos os serviços
docker-compose up -d

# Verificar logs
docker-compose logs -f
```

## 📋 SCHEMA DO BANCO

### **Tabelas Principais:**

- **`users`** - Usuários do sistema
- **`companies`** - Empresas coletadas
- **`leads`** - Leads individuais
- **`campaigns`** - Campanhas de extração
- **`interactions`** - Interações/contatos
- **`message_templates`** - Templates de mensagem
- **`sequences`** - Sequências de follow-up
- **`pipelines`** - Funis de vendas

### **Relacionamentos:**
```sql
companies (1) ←→ (N) leads
leads (1) ←→ (N) interactions
sequences (1) ←→ (N) sequence_steps
leads (N) ←→ (N) sequences (lead_sequences)
```

## 🤖 MOTOR SDR

### **Qualificação Automática:**
```typescript
// Critérios de pontuação (0-100)
- Dados de contato: 40 pontos
- Presença digital: 30 pontos  
- Segmento alvo: 20 pontos
- Localização: 10 pontos
```

### **Classificação por Temperatura:**
- **🔥 Hot (80-100)**: Prioridade alta, contato imediato
- **🟡 Warm (60-79)**: Prioridade média, contato em 1-2 dias
- **❄️ Cold (0-59)**: Prioridade baixa, sequência longa

### **Sequências Automáticas:**
1. **Primeiro contato** (imediato)
2. **Follow-up 1** (+3 dias)
3. **Follow-up 2** (+7 dias)
4. **Follow-up 3** (+14 dias)
5. **Reativação** (+30 dias)

## 📊 API ENDPOINTS

### **Leads**
```http
GET    /api/leads              # Listar leads
GET    /api/leads/:id          # Buscar lead
PUT    /api/leads/:id          # Atualizar lead
POST   /api/leads/extract      # Extrair leads
POST   /api/leads/:id/interactions  # Adicionar interação
GET    /api/leads/stats        # Estatísticas
```

### **SDR**
```http
POST   /api/sdr/qualify        # Qualificar leads
POST   /api/sdr/sequences      # Iniciar sequência
GET    /api/sdr/execute        # Executar sequências
POST   /api/sdr/analyze        # Analisar respostas
```

### **CRM**
```http
GET    /api/crm/pipeline       # Pipeline de vendas
POST   /api/crm/opportunities  # Criar oportunidade
GET    /api/crm/dashboard      # Dashboard
GET    /api/crm/reports        # Relatórios
```

## 🔒 SEGURANÇA & COMPLIANCE

### **Implementado:**
- ✅ Criptografia de senhas (bcrypt)
- ✅ JWT para autenticação
- ✅ Rate limiting
- ✅ Logs de auditoria
- ✅ Validação de dados (Zod)
- ✅ Headers de segurança (Helmet)

### **LGPD Compliance:**
- ✅ Consentimento rastreável
- ✅ Opt-out automático
- ✅ Anonização de dados
- ✅ Logs de acesso

## 📈 PERFORMANCE

### **Otimizações:**
- ✅ Índices otimizados no PostgreSQL
- ✅ Conexão pool para DB
- ✅ Cache Redis para sessões
- ✅ Paginação em todas as listagens
- ✅ Rate limiting inteligente

### **Escalabilidade:**
- 🔄 Filas Redis para jobs pesados
- 🔄 Microserviços (planejado)
- 🔄 Load balancer (planejado)
- 🔄 Sharding de banco (planejado)

## 🧪 TESTES

```bash
# Backend
cd backend
npm test

# Frontend  
cd frontend
npm test

# E2E
npm run test:e2e
```

## 📦 DEPLOY

### **Produção:**
```bash
# Build
npm run build

# Executar
npm start

# PM2 (recomendado)
pm2 start ecosystem.config.js
```

### **Docker:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 CONFIGURAÇÕES AVANÇADAS

### **Extração:**
```env
EXTRACTION_DELAY_MS=2000        # Delay entre requests
MAX_CONCURRENT_EXTRACTIONS=3   # Máx extrações simultâneas
```

### **SDR:**
```env
SDR_QUALIFICATION_INTERVAL=3600000  # Qualificar a cada 1h
SDR_SEQUENCE_INTERVAL=1800000       # Executar sequências a cada 30min
```

## 🤝 CONTRIBUIÇÃO

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 LICENÇA

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 SUPORTE

- 📧 Email: suporte@sdr-automatizado.com
- 💬 Discord: [Link do servidor]
- 📖 Docs: [Link da documentação]

---

**🚀 Desenvolvido com ❤️ para revolucionar a geração de leads!**