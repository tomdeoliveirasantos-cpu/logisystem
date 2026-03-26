-- ════════════════════════════════════════════════════════════════════════════
-- Migração 003: Histórico de alterações de ordens
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS logi_historico_ordens (
  id SERIAL PRIMARY KEY,
  ordem_id TEXT NOT NULL,
  status_anterior VARCHAR(20),
  status_novo VARCHAR(20) NOT NULL,
  usuario_id TEXT,
  usuario_nome VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_ordem ON logi_historico_ordens(ordem_id);
