require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const db      = require('./db');
const { authMiddleware } = require('./middleware/auth');

const authRouter           = require('./routes/auth');
const clientesRouter       = require('./routes/clientes');
const transportadorasRouter = require('./routes/transportadoras');
const veiculosRouter        = require('./routes/veiculos');
const motoristasRouter      = require('./routes/motoristas');
const ordensRouter          = require('./routes/ordens');
const manutencoesRouter     = require('./routes/manutencoes');
const multasRouter          = require('./routes/multas');
const financeiroRouter      = require('./routes/financeiro');
const relatoriosRouter      = require('./routes/relatorios');
const parametrosRouter      = require('./routes/parametros');

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

// Rotas protegidas (requerem token JWT)
app.use('/api/clientes',        authMiddleware, clientesRouter);
app.use('/api/transportadoras', authMiddleware, transportadorasRouter);
app.use('/api/veiculos',        authMiddleware, veiculosRouter);
app.use('/api/motoristas',      authMiddleware, motoristasRouter);
app.use('/api/ordens',          authMiddleware, ordensRouter);
app.use('/api/manutencoes',     authMiddleware, manutencoesRouter);
app.use('/api/multas',          authMiddleware, multasRouter);
app.use('/api/financeiro',      authMiddleware, financeiroRouter);
app.use('/api/relatorios',      authMiddleware, relatoriosRouter);
app.use('/api/parametros',      authMiddleware, parametrosRouter);

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
