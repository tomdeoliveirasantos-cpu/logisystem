// teste CI v3

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const db      = require('./db');
const { authMiddleware } = require('./middleware/auth');
const { requireTenant }  = require('./middleware/tenant');

const authRouter           = require('./routes/auth');
const clientesRouter       = require('./routes/clientes');
const transportadorasRouter = require('./routes/transportadoras');
const veiculosRouter        = require('./routes/veiculos');
const motoristasRouter      = require('./routes/motoristas');
const ordensRouter          = require('./routes/ordens');
const manutencoesRouter     = require('./routes/manutencoes');
const multasRouter          = require('./routes/multas');
const financeiroRouter      = require('./routes/financeiro');
const fornecedoresRouter     = require('./routes/fornecedores');
const relatoriosRouter      = require('./routes/relatorios');
const parametrosRouter      = require('./routes/parametros');
const reajustesRouter       = require('./routes/reajustes');
const ajudantesRouter       = require('./routes/ajudantes');
const motoristaAppRouter    = require('./routes/motorista-app');
const { publicRouter: cadastroPublicRouter, adminRouter: cadastroAdminRouter } = require('./routes/cadastro-motorista');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', async (_, res) => {
  const ok = await db.testConnection();
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'db_error', ts: new Date() });
});

// Rotas públicas (sem autenticação)
app.use('/api/auth', authRouter);

// Rotas públicas — formulário de cadastro de motorista (acesso via token)
app.use('/api/cadastro-motorista', cadastroPublicRouter);
app.use('/api/motorista-app',      motoristaAppRouter);

// Rotas protegidas (requerem token JWT + tenant resolvido)
// requireTenant valida que o JWT carrega organizacao_id e popula req.organizacao_id, req.perfil_na_org, req.is_super_admin
app.use('/api/clientes',        authMiddleware, requireTenant, clientesRouter);
app.use('/api/transportadoras', authMiddleware, requireTenant, transportadorasRouter);
app.use('/api/veiculos',        authMiddleware, requireTenant, veiculosRouter);
app.use('/api/motoristas',      authMiddleware, requireTenant, motoristasRouter);
app.use('/api/ordens',          authMiddleware, requireTenant, ordensRouter);
app.use('/api/manutencoes',     authMiddleware, requireTenant, manutencoesRouter);
app.use('/api/fornecedores',    authMiddleware, requireTenant, fornecedoresRouter);
app.use('/api/ajudantes',       authMiddleware, requireTenant, ajudantesRouter);
app.use('/api/multas',          authMiddleware, requireTenant, multasRouter);
app.use('/api/financeiro',      authMiddleware, requireTenant, financeiroRouter);
app.use('/api/relatorios',      authMiddleware, requireTenant, relatoriosRouter);
app.use('/api/parametros',      authMiddleware, parametrosRouter); // parametros é global (sem tenant)
app.use('/api/reajustes',       authMiddleware, requireTenant, reajustesRouter);
app.use('/api/motorista-cadastros', authMiddleware, requireTenant, cadastroAdminRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚛 LogiSystem API v2 — porta ${PORT}`);
  await db.testConnection();
  console.log(`🔗 http://localhost:${PORT}/health\n`);
});
