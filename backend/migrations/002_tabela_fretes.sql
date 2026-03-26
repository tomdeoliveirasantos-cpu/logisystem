-- ════════════════════════════════════════════════════════════════════════════
-- Migração: Tabelas de Frete - Março 2026
-- Adiciona sub_tabela à logi_tabela_fretes e cria logi_tabela_frete_recebido
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Adicionar coluna sub_tabela se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logi_tabela_fretes' AND column_name = 'sub_tabela'
  ) THEN
    ALTER TABLE logi_tabela_fretes ADD COLUMN sub_tabela VARCHAR(20) DEFAULT 'sp';
  END IF;
END $$;

-- 2) Criar tabela de frete recebido (fixo por veículo)
CREATE TABLE IF NOT EXISTS logi_tabela_frete_recebido (
  id SERIAL PRIMARY KEY,
  tipo_veiculo VARCHAR(10) NOT NULL UNIQUE,
  descricao VARCHAR(60),
  valor NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3) Popular frete recebido (fixo - Léo Madeiras)
INSERT INTO logi_tabela_frete_recebido (tipo_veiculo, descricao, valor) VALUES
  ('HR',    'até 1500 kg', 643.00),
  ('IVECO', 'até 2500 kg', 775.00),
  ('3/4',   'até 4500 kg', 900.00),
  ('TOCO',  'até 6500 kg', 1005.00),
  ('TRUCK', '',            1820.00)
ON CONFLICT (tipo_veiculo) DO UPDATE SET
  valor = EXCLUDED.valor,
  descricao = EXCLUDED.descricao,
  updated_at = NOW();

-- 4) Limpar fretes agregados antigos para re-popular
DELETE FROM logi_tabela_fretes WHERE tipo_frete = 'agregado';

-- 5) Popular ROTAS SP (agregado) - HR, IVECO, 3/4
INSERT INTO logi_tabela_fretes (regiao, tipo_veiculo, valor_base, tipo_frete, sub_tabela) VALUES
  -- OSASCO / BARUERI / JANDIRA / ITAPEVI / CARAPICUIBA / SANTANA DE PARNAIBA / PIRAPORA DO BOM JESUS / LAPA
  ('OSASCO / BARUERI / JANDIRA / ITAPEVI / CARAPICUIBA / SANTANA DE PARNAIBA / PIRAPORA DO BOM JESUS / LAPA', 'HR', 380, 'agregado', 'sp'),
  ('OSASCO / BARUERI / JANDIRA / ITAPEVI / CARAPICUIBA / SANTANA DE PARNAIBA / PIRAPORA DO BOM JESUS / LAPA', 'IVECO', 430, 'agregado', 'sp'),
  ('OSASCO / BARUERI / JANDIRA / ITAPEVI / CARAPICUIBA / SANTANA DE PARNAIBA / PIRAPORA DO BOM JESUS / LAPA', '3/4', 500, 'agregado', 'sp'),
  ('ZONA LESTE', 'HR', 430, 'agregado', 'sp'),
  ('ZONA LESTE', 'IVECO', 480, 'agregado', 'sp'),
  ('ZONA LESTE', '3/4', 550, 'agregado', 'sp'),
  ('ZONA NORTE', 'HR', 430, 'agregado', 'sp'),
  ('ZONA NORTE', 'IVECO', 480, 'agregado', 'sp'),
  ('ZONA NORTE', '3/4', 550, 'agregado', 'sp'),
  ('ZONA SUL', 'HR', 430, 'agregado', 'sp'),
  ('ZONA SUL', 'IVECO', 480, 'agregado', 'sp'),
  ('ZONA SUL', '3/4', 550, 'agregado', 'sp'),
  ('SÃO BERNARDO / SANTO ANDRE / DIADEMA', 'HR', 450, 'agregado', 'sp'),
  ('SÃO BERNARDO / SANTO ANDRE / DIADEMA', 'IVECO', 500, 'agregado', 'sp'),
  ('SÃO BERNARDO / SANTO ANDRE / DIADEMA', '3/4', 600, 'agregado', 'sp'),
  ('RIACHO GRANDE', 'HR', 500, 'agregado', 'sp'),
  ('RIACHO GRANDE', 'IVECO', 550, 'agregado', 'sp'),
  ('RIACHO GRANDE', '3/4', 650, 'agregado', 'sp'),
  ('ARUJA', 'HR', 460, 'agregado', 'sp'),
  ('ARUJA', 'IVECO', 530, 'agregado', 'sp'),
  ('ARUJA', '3/4', 650, 'agregado', 'sp'),
  ('ATIBAIA', 'HR', 550, 'agregado', 'sp'),
  ('ATIBAIA', 'IVECO', 580, 'agregado', 'sp'),
  ('ATIBAIA', '3/4', 750, 'agregado', 'sp'),
  ('BIRITIBA MIRIM', 'HR', 560, 'agregado', 'sp'),
  ('BIRITIBA MIRIM', 'IVECO', 630, 'agregado', 'sp'),
  ('BIRITIBA MIRIM', '3/4', 850, 'agregado', 'sp'),
  ('BOM JESUS PERDÕES', 'HR', 550, 'agregado', 'sp'),
  ('BOM JESUS PERDÕES', 'IVECO', 620, 'agregado', 'sp'),
  ('BOM JESUS PERDÕES', '3/4', 850, 'agregado', 'sp'),
  ('BRAGANÇA', 'HR', 600, 'agregado', 'sp'),
  ('BRAGANÇA', 'IVECO', 670, 'agregado', 'sp'),
  ('BRAGANÇA', '3/4', 900, 'agregado', 'sp'),
  ('CAÇAPAVA', 'HR', 600, 'agregado', 'sp'),
  ('CAÇAPAVA', 'IVECO', 670, 'agregado', 'sp'),
  ('CAJAMAR', 'HR', 430, 'agregado', 'sp'),
  ('CAJAMAR', 'IVECO', 480, 'agregado', 'sp'),
  ('CAJAMAR', '3/4', 550, 'agregado', 'sp'),
  ('COTIA', 'HR', 380, 'agregado', 'sp'),
  ('COTIA', 'IVECO', 430, 'agregado', 'sp'),
  ('COTIA', '3/4', 550, 'agregado', 'sp'),
  ('CAUCAIA', 'HR', 420, 'agregado', 'sp'),
  ('CAUCAIA', 'IVECO', 470, 'agregado', 'sp'),
  ('CAUCAIA', '3/4', 600, 'agregado', 'sp'),
  ('EMBU GUAÇU', 'HR', 470, 'agregado', 'sp'),
  ('EMBU GUAÇU', 'IVECO', 540, 'agregado', 'sp'),
  ('EXTREMA', 'HR', 640, 'agregado', 'sp'),
  ('EXTREMA', 'IVECO', 720, 'agregado', 'sp'),
  ('EXTREMA', '3/4', 1000, 'agregado', 'sp'),
  ('FRANCO DA ROCHA', 'HR', 450, 'agregado', 'sp'),
  ('FRANCO DA ROCHA', 'IVECO', 500, 'agregado', 'sp'),
  ('FERRAZ', 'HR', 470, 'agregado', 'sp'),
  ('FERRAZ', 'IVECO', 540, 'agregado', 'sp'),
  ('GUARAREMA', 'HR', 550, 'agregado', 'sp'),
  ('GUARAREMA', 'IVECO', 620, 'agregado', 'sp'),
  ('GUARAREMA', '3/4', 850, 'agregado', 'sp'),
  ('GUARULHOS', 'HR', 430, 'agregado', 'sp'),
  ('GUARULHOS', 'IVECO', 480, 'agregado', 'sp'),
  ('IBIUNA', 'HR', 450, 'agregado', 'sp'),
  ('IBIUNA', 'IVECO', 520, 'agregado', 'sp'),
  ('IBIUNA', '3/4', 600, 'agregado', 'sp'),
  ('IGARATA', 'HR', 570, 'agregado', 'sp'),
  ('IGARATA', 'IVECO', 640, 'agregado', 'sp'),
  ('IGARATA', '3/4', 900, 'agregado', 'sp'),
  ('ITATIBA', 'HR', 490, 'agregado', 'sp'),
  ('ITATIBA', 'IVECO', 560, 'agregado', 'sp'),
  ('ITATIBA', '3/4', 730, 'agregado', 'sp'),
  ('ITUPEVA', 'HR', 470, 'agregado', 'sp'),
  ('ITUPEVA', 'IVECO', 540, 'agregado', 'sp'),
  ('ITUPEVA', '3/4', 650, 'agregado', 'sp'),
  ('INDAIATUBA', 'HR', 520, 'agregado', 'sp'),
  ('INDAIATUBA', 'IVECO', 590, 'agregado', 'sp'),
  ('INDAIATUBA', '3/4', 750, 'agregado', 'sp'),
  ('ITAQUAQUECETUBA', 'HR', 470, 'agregado', 'sp'),
  ('ITAQUAQUECETUBA', 'IVECO', 540, 'agregado', 'sp'),
  ('JARINU', 'HR', 460, 'agregado', 'sp'),
  ('JARINU', 'IVECO', 530, 'agregado', 'sp'),
  ('JARINU', '3/4', 650, 'agregado', 'sp'),
  ('JOANOPOLIS', 'HR', 610, 'agregado', 'sp'),
  ('JOANOPOLIS', 'IVECO', 680, 'agregado', 'sp'),
  ('JOANOPOLIS', '3/4', 1000, 'agregado', 'sp'),
  ('JUNDIAI', 'HR', 460, 'agregado', 'sp'),
  ('JUNDIAI', 'IVECO', 530, 'agregado', 'sp'),
  ('JUNDIAI', '3/4', 620, 'agregado', 'sp'),
  ('JUQUITIBA', 'HR', 470, 'agregado', 'sp'),
  ('JUQUITIBA', 'IVECO', 540, 'agregado', 'sp'),
  ('JUQUITIBA', '3/4', 650, 'agregado', 'sp'),
  ('MAIRIPORA', 'HR', 470, 'agregado', 'sp'),
  ('MAIRIPORA', 'IVECO', 540, 'agregado', 'sp'),
  ('MAIRIPORA', '3/4', 590, 'agregado', 'sp'),
  ('MAUA', 'HR', 510, 'agregado', 'sp'),
  ('MAUA', 'IVECO', 580, 'agregado', 'sp'),
  ('MAUA', '3/4', 750, 'agregado', 'sp'),
  ('MOGI', 'HR', 510, 'agregado', 'sp'),
  ('MOGI', 'IVECO', 580, 'agregado', 'sp'),
  ('MOGI', '3/4', 750, 'agregado', 'sp'),
  ('NAZARE PAULISTA', 'HR', 550, 'agregado', 'sp'),
  ('NAZARE PAULISTA', 'IVECO', 620, 'agregado', 'sp'),
  ('NAZARE PAULISTA', '3/4', 850, 'agregado', 'sp'),
  ('PARELHEIROS', 'HR', 470, 'agregado', 'sp'),
  ('PARELHEIROS', 'IVECO', 540, 'agregado', 'sp'),
  ('PINHALZINHO', 'HR', 600, 'agregado', 'sp'),
  ('PINHALZINHO', 'IVECO', 670, 'agregado', 'sp'),
  ('PINHALZINHO', '3/4', 1000, 'agregado', 'sp'),
  ('PIRACAIA', 'HR', 570, 'agregado', 'sp'),
  ('PIRACAIA', 'IVECO', 640, 'agregado', 'sp'),
  ('PIRACAIA', '3/4', 900, 'agregado', 'sp'),
  ('POA', 'HR', 470, 'agregado', 'sp'),
  ('POA', 'IVECO', 540, 'agregado', 'sp'),
  ('RIBEIRÃO PIRES', 'HR', 530, 'agregado', 'sp'),
  ('RIBEIRÃO PIRES', 'IVECO', 600, 'agregado', 'sp'),
  ('RIBEIRÃO PIRES', '3/4', 750, 'agregado', 'sp'),
  ('RIO GRANDE DA SERRA', 'HR', 600, 'agregado', 'sp'),
  ('RIO GRANDE DA SERRA', 'IVECO', 670, 'agregado', 'sp'),
  ('SALESOPOLIS', 'HR', 580, 'agregado', 'sp'),
  ('SALESOPOLIS', 'IVECO', 650, 'agregado', 'sp'),
  ('SALESOPOLIS', '3/4', 1000, 'agregado', 'sp'),
  ('SALTO', 'HR', 490, 'agregado', 'sp'),
  ('SALTO', 'IVECO', 560, 'agregado', 'sp'),
  ('SALTO', '3/4', 730, 'agregado', 'sp'),
  ('SANTA ISABEL', 'HR', 500, 'agregado', 'sp'),
  ('SANTA ISABEL', 'IVECO', 570, 'agregado', 'sp'),
  ('SANTA ISABEL', '3/4', 750, 'agregado', 'sp'),
  ('SÃO JOSE DOS CAMPOS', 'HR', 570, 'agregado', 'sp'),
  ('SÃO JOSE DOS CAMPOS', 'IVECO', 640, 'agregado', 'sp'),
  ('SÃO JOSE DOS CAMPOS', '3/4', 900, 'agregado', 'sp'),
  ('SÃO LOURENÇO DA SERRA', 'HR', 460, 'agregado', 'sp'),
  ('SÃO LOURENÇO DA SERRA', 'IVECO', 530, 'agregado', 'sp'),
  ('SOCORRO', 'HR', 610, 'agregado', 'sp'),
  ('SOCORRO', 'IVECO', 680, 'agregado', 'sp'),
  ('SOCORRO', '3/4', 1150, 'agregado', 'sp'),
  ('SUZANO', 'HR', 480, 'agregado', 'sp'),
  ('SUZANO', 'IVECO', 550, 'agregado', 'sp'),
  ('SUZANO', '3/4', 650, 'agregado', 'sp'),
  ('TAUBATE', 'HR', 610, 'agregado', 'sp'),
  ('TAUBATE', 'IVECO', 680, 'agregado', 'sp'),
  ('TAUBATE', '3/4', 1150, 'agregado', 'sp'),
  ('TUIUTI', 'HR', 570, 'agregado', 'sp'),
  ('TUIUTI', 'IVECO', 640, 'agregado', 'sp'),
  ('TUIUTI', '3/4', 900, 'agregado', 'sp'),
  ('VARGEM GRANDE', 'HR', 400, 'agregado', 'sp'),
  ('VARGEM GRANDE', 'IVECO', 450, 'agregado', 'sp');

-- 6) Popular SOROCABA (por km)
INSERT INTO logi_tabela_fretes (regiao, tipo_veiculo, km_max, valor_base, tipo_frete, sub_tabela) VALUES
  ('SOROCABA', 'HR', 100, 650, 'agregado', 'sorocaba'),
  ('SOROCABA', 'HR', 250, 725, 'agregado', 'sorocaba'),
  ('SOROCABA', 'HR', 300, 800, 'agregado', 'sorocaba'),
  ('SOROCABA', 'HR', 350, 875, 'agregado', 'sorocaba'),
  ('SOROCABA', 'HR', 400, 950, 'agregado', 'sorocaba'),
  ('SOROCABA', 'IVECO', 100, 750, 'agregado', 'sorocaba'),
  ('SOROCABA', 'IVECO', 250, 825, 'agregado', 'sorocaba'),
  ('SOROCABA', 'IVECO', 300, 900, 'agregado', 'sorocaba'),
  ('SOROCABA', 'IVECO', 350, 975, 'agregado', 'sorocaba'),
  ('SOROCABA', 'IVECO', 400, 1050, 'agregado', 'sorocaba'),
  ('SOROCABA', '3/4', 100, 1100, 'agregado', 'sorocaba'),
  ('SOROCABA', '3/4', 250, 1235, 'agregado', 'sorocaba'),
  ('SOROCABA', '3/4', 300, 1375, 'agregado', 'sorocaba'),
  ('SOROCABA', '3/4', 350, 1500, 'agregado', 'sorocaba'),
  ('SOROCABA', '3/4', 400, 1650, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TOCO', 100, 1250, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TOCO', 250, 1385, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TOCO', 300, 1525, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TOCO', 350, 1650, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TOCO', 400, 1800, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TRUCK', 100, 1400, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TRUCK', 250, 1600, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TRUCK', 300, 1800, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TRUCK', 350, 2100, 'agregado', 'sorocaba'),
  ('SOROCABA', 'TRUCK', 400, 2300, 'agregado', 'sorocaba');

-- 7) Popular CAMPINAS 1 (até 300km)
INSERT INTO logi_tabela_fretes (regiao, tipo_veiculo, valor_base, tipo_frete, sub_tabela) VALUES
  ('CAMPINAS 1', 'HR', 700, 'agregado', 'campinas1'),
  ('CAMPINAS 1', 'IVECO', 800, 'agregado', 'campinas1'),
  ('CAMPINAS 1', '3/4', 1200, 'agregado', 'campinas1'),
  ('CAMPINAS 1', 'TOCO', 1350, 'agregado', 'campinas1'),
  ('CAMPINAS 1', 'TRUCK', 1600, 'agregado', 'campinas1');

-- 8) Popular CAMPINAS 2 (até 500km)
INSERT INTO logi_tabela_fretes (regiao, tipo_veiculo, valor_base, tipo_frete, sub_tabela) VALUES
  ('CAMPINAS 2', 'HR', 950, 'agregado', 'campinas2'),
  ('CAMPINAS 2', 'IVECO', 1150, 'agregado', 'campinas2'),
  ('CAMPINAS 2', '3/4', 1650, 'agregado', 'campinas2'),
  ('CAMPINAS 2', 'TOCO', 2000, 'agregado', 'campinas2'),
  ('CAMPINAS 2', 'TRUCK', 2350, 'agregado', 'campinas2');
