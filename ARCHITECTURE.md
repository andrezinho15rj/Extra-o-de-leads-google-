# 🚀 SDR AUTOMATIZADO - Sistema Completo

## 📋 ARQUITETURA DO SISTEMA

```
sdr-automatizado/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Controladores da API
│   │   ├── services/            # Lógica de negócio
│   │   ├── models/              # Modelos do banco
│   │   ├── extractors/          # Extratores de leads
│   │   ├── sdr/                 # Motor SDR
│   │   ├── crm/                 # Sistema CRM
│   │   ├── database/            # Configuração DB
│   │   ├── utils/               # Utilitários
│   │   └── middleware/          # Middlewares
│   ├── migrations/              # Migrações DB
│   ├── seeds/                   # Seeds iniciais
│   └── tests/                   # Testes
├── frontend/
│   ├── src/
│   │   ├── components/          # Componentes React
│   │   ├── pages/               # Páginas
│   │   ├── services/            # Serviços API
│   │   ├── hooks/               # Custom hooks
│   │   └── utils/               # Utilitários
├── docker/                      # Configurações Docker
├── docs/                        # Documentação
└── scripts/                     # Scripts utilitários
```

## 🎯 STACK TECNOLÓGICA

**Backend:**
- Node.js + TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Bull Queue (jobs)
- Redis (cache/queue)
- JWT Authentication

**Frontend:**
- React + TypeScript
- Tailwind CSS
- React Query
- Zustand (state)
- React Hook Form

**Infraestrutura:**
- Docker & Docker Compose
- Nginx (proxy)
- PM2 (process manager)

## 🔄 FLUXO DO SISTEMA

1. **Extração** → Coleta leads de múltiplas fontes
2. **Qualificação** → IA classifica e pontua leads
3. **Distribuição** → Atribui leads ao SDR virtual
4. **Abordagem** → SDR envia mensagens personalizadas
5. **Follow-up** → Sequência automática de contatos
6. **Conversão** → Leads qualificados para vendas
7. **Análise** → Relatórios e otimização contínua

## 📊 MODELAGEM DO BANCO

### Tabelas Principais:
- `companies` - Empresas
- `leads` - Leads individuais
- `contacts` - Contatos/interações
- `campaigns` - Campanhas de extração
- `messages` - Mensagens enviadas
- `pipelines` - Funis de vendas
- `users` - Usuários do sistema
- `logs` - Auditoria

## 🤖 MOTOR SDR

### Qualificação Automática:
- **Score ICP**: 0-100 pontos
- **Temperatura**: Quente/Morno/Frio
- **Prioridade**: Alta/Média/Baixa
- **Segmento**: Classificação automática

### Mensagens Inteligentes:
- Templates personalizados por segmento
- Variáveis dinâmicas
- A/B testing automático
- Adaptação por resposta

## 🔒 SEGURANÇA & COMPLIANCE

- Criptografia de dados sensíveis
- Rate limiting inteligente
- Logs de auditoria completos
- LGPD compliance
- Opt-out automático
- Consentimento rastreável