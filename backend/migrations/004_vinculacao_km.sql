-- ════════════════════════════════════════════════════════════════════════════
-- Migração 004: Vinculação motorista-veículo e controle de KM
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Vinculação motorista → veículo padrão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logi_motoristas' AND column_name = 'veiculo_padrao_id'
  ) THEN
    ALTER TABLE logi_motoristas ADD COLUMN veiculo_padrao_id TEXT REFERENCES logi_veiculos(id);
  END IF;
END $$;

-- 2) Controle de KM nas ordens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logi_ordens_transporte' AND column_name = 'km_saida'
  ) THEN
    ALTER TABLE logi_ordens_transporte ADD COLUMN km_saida NUMERIC(10,1);
    ALTER TABLE logi_ordens_transporte ADD COLUMN km_chegada NUMERIC(10,1);
  END IF;
END $$;
