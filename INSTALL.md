# 🚀 INSTALAÇÃO RÁPIDA - SDR AUTOMATIZADO

## ⚡ Setup em 5 minutos

### 1️⃣ **Pré-requisitos**
```bash
# Verificar versões
node --version  # >= 18.0.0
npm --version   # >= 8.0.0
```

### 2️⃣ **Clonar e Instalar**
```bash
# Clonar repositório
git clone https://github.com/seu-usuario/sdr-automatizado.git
cd sdr-automatizado

# Instalar dependências do backend
cd backend
npm install

# Voltar para raiz
cd ..
```

### 3️⃣ **Configurar Banco (Docker - Recomendado)**
```bash
# Subir PostgreSQL e Redis
docker-compose up -d postgres redis

# Aguardar inicialização (30 segundos)
sleep 30

# Verificar se está rodando
docker ps
```

### 4️⃣ **Configurar Variáveis**
```bash
# Copiar arquivo de exemplo
cd backend
cp .env.example .env

# Editar configurações (usar editor de sua preferência)
notepad .env  # Windows
nano .env     # Linux/Mac
```

**Configuração mínima (.env):**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sdr_automatizado
DB_USER=postgres
DB_PASSWORD=postgres123
PORT=3001
NODE_ENV=development
```

### 5️⃣ **Executar Sistema**
```bash
# Executar backend
npm run dev
```

### 6️⃣ **Testar Instalação**
```bash
# Testar API
curl http://localhost:3001/health

# Resposta esperada:
# {"status":"ok","timestamp":"...","database":"connected"}
```

## 🎯 **Primeiro Uso**

### **Extrair Leads:**
```bash
curl -X POST http://localhost:3001/api/leads/extract/google-maps \
  -H "Content-Type: application/json" \
  -d '{
    "segment": "pizzarias",
    "location": "São Paulo",
    "limit": 50
  }'
```

### **Qualificar Leads:**
```bash
curl -X POST http://localhost:3001/api/sdr/qualify
```

### **Ver Dashboard:**
```bash
curl http://localhost:3001/api/crm/dashboard
```

## 🔧 **Comandos Úteis**

```bash
# Ver logs em tempo real
tail -f backend/logs/combined.log

# Parar todos os containers
docker-compose down

# Reiniciar apenas o banco
docker-compose restart postgres

# Limpar dados do banco
docker-compose down -v
docker-compose up -d postgres redis
```

## 🆘 **Problemas Comuns**

### **Erro de conexão com banco:**
```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Recriar container se necessário
docker-compose down
docker-compose up -d postgres
```

### **Porta já em uso:**
```bash
# Verificar processo na porta 3001
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Linux/Mac

# Matar processo se necessário
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Linux/Mac
```

### **Erro de permissão (Linux/Mac):**
```bash
# Dar permissão para scripts
chmod +x scripts/*.sh

# Executar com sudo se necessário
sudo docker-compose up -d
```

## 📊 **Próximos Passos**

1. **Configurar extração automática** - Agendar jobs
2. **Personalizar templates** - Mensagens do SDR
3. **Integrar WhatsApp API** - Envio real de mensagens
4. **Configurar email** - Notificações e relatórios
5. **Deploy em produção** - Docker + PM2

## 🔗 **Links Úteis**

- 📖 [Documentação Completa](README-SDR.md)
- 🏗️ [Arquitetura do Sistema](ARCHITECTURE.md)
- 🐳 [Deploy com Docker](docker/README.md)
- 🔧 [Configurações Avançadas](docs/advanced-config.md)

---

**✅ Sistema instalado com sucesso!** 
Agora você tem um SDR automatizado funcionando localmente.