require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// ─── Configuração ──────────────────────────────────────────────────────
const SLUG_LEO = 'leo-madeiras';
const SLUG_WSDEV = 'wsdevsoft';

// Email do super-admin (Wellington) — busca em logi_usuarios e vincula à WsDevSoft
const SUPER_ADMIN_EMAIL = 'admin@logisystem.com';

// Tabelas tenant-aware: ganham coluna organizacao_id
const TABELAS_TENANT = [
  // Operacionais
  'logi_clientes',
  'logi_motoristas',
  'logi_veiculos',
  'logi_ordens_transporte',
  'logi_ordem_paradas',
  'logi_ordem_anexos',
  'logi_ordem_ajudantes',
  'logi_historico_ordens',
  'logi_transportadoras',
  'logi_ajudantes',
  'logi_multas',
  'logi_manutencoes',
  'logi_contas_pagar',
  'logi_contas_receber',
  'logi_adiantamentos',
  'logi_fornecedores',
  // Cadastros auxiliares
  'logi_tabela_fretes',
  'logi_tabela_frete_recebido',
  'logi_reajustes_frete',
  'logi_motorista_cadastros',
  'logi_cadastro_convites',
];

// ─── Helpers ───────────────────────────────────────────────────────────
const LOG_PATH = path.join(__dirname, '..', 'migration_021_log.txt');
fs.writeFileSync(LOG_PATH, '');
const log = (m) => {
  console.log(m);
  fs.appendFileSync(LOG_PATH, m + '\n');
};

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return r.rows.length > 0;
}

// ─── MAIN ──────────────────────────────────────────────────────────────
(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    log('=== MIGRATION 021 — Fundação Multi-Tenant ===');
    log(`Iniciado em ${new Date().toISOString()}\n`);

    // ════════════════════════════════════════════════════════════════
    // 1. Criar logi_organizacoes
    // ════════════════════════════════════════════════════════════════
    log('--- 1. logi_organizacoes ---');
    if (await tableExists(client, 'logi_organizacoes')) {
      log('  ✓ tabela já existe');
    } else {
      await client.query(`
        CREATE TABLE logi_organizacoes (
          id              TEXT PRIMARY KEY DEFAULT md5(((random())::text || (clock_timestamp())::text)),
          nome            VARCHAR(120) NOT NULL,
          razao_social    VARCHAR(180),
          cnpj            VARCHAR(18),
          slug            VARCHAR(40) UNIQUE NOT NULL,
          logo_url        TEXT,
          cor_primaria    VARCHAR(7),
          plano           VARCHAR(20) NOT NULL DEFAULT 'basico',
          ativo           BOOLEAN NOT NULL DEFAULT TRUE,
          is_wsdevsoft    BOOLEAN NOT NULL DEFAULT FALSE,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      log('  ✓ logi_organizacoes criada');
    }

    // ════════════════════════════════════════════════════════════════
    // 2. Inserir org WsDevSoft e Léo Madeiras
    // ════════════════════════════════════════════════════════════════
    log('\n--- 2. Seed de organizações ---');

    let wsdev = await client.query(
      `SELECT id FROM logi_organizacoes WHERE slug = $1`, [SLUG_WSDEV]
    );
    let wsdevId;
    if (wsdev.rows.length) {
      wsdevId = wsdev.rows[0].id;
      log(`  ✓ WsDevSoft já existe (${wsdevId})`);
    } else {
      const r = await client.query(`
        INSERT INTO logi_organizacoes (nome, razao_social, slug, is_wsdevsoft, plano)
        VALUES ('WsDevSoft', 'WsDevSoft Desenvolvimento de Software', $1, TRUE, 'super')
        RETURNING id
      `, [SLUG_WSDEV]);
      wsdevId = r.rows[0].id;
      log(`  ✓ WsDevSoft criada (${wsdevId})`);
    }

    let leo = await client.query(
      `SELECT id FROM logi_organizacoes WHERE slug = $1`, [SLUG_LEO]
    );
    let leoId;
    if (leo.rows.length) {
      leoId = leo.rows[0].id;
      log(`  ✓ Léo Madeiras já existe (${leoId})`);
    } else {
      const r = await client.query(`
        INSERT INTO logi_organizacoes (nome, razao_social, slug, plano)
        VALUES ('Léo Madeiras', 'Léo Madeiras Ltda', $1, 'basico')
        RETURNING id
      `, [SLUG_LEO]);
      leoId = r.rows[0].id;
      log(`  ✓ Léo Madeiras criada (${leoId})`);
    }

    // ════════════════════════════════════════════════════════════════
    // 3. Criar logi_usuarios_orgs
    // ════════════════════════════════════════════════════════════════
    log('\n--- 3. logi_usuarios_orgs ---');
    if (await tableExists(client, 'logi_usuarios_orgs')) {
      log('  ✓ tabela já existe');
    } else {
      await client.query(`
        CREATE TABLE logi_usuarios_orgs (
          usuario_id      TEXT NOT NULL REFERENCES logi_usuarios(id) ON DELETE CASCADE,
          organizacao_id  TEXT NOT NULL REFERENCES logi_organizacoes(id) ON DELETE CASCADE,
          perfil_na_org   VARCHAR(40) NOT NULL,
          ativo           BOOLEAN NOT NULL DEFAULT TRUE,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (usuario_id, organizacao_id)
        )
      `);
      log('  ✓ logi_usuarios_orgs criada');

      await client.query(`CREATE INDEX idx_usuarios_orgs_usuario ON logi_usuarios_orgs(usuario_id) WHERE ativo`);
      await client.query(`CREATE INDEX idx_usuarios_orgs_org ON logi_usuarios_orgs(organizacao_id) WHERE ativo`);
      log('  ✓ índices criados');
    }

    // ════════════════════════════════════════════════════════════════
    // 4. Backfill: todo usuário existente vira membro da Léo Madeiras
    // ════════════════════════════════════════════════════════════════
    log('\n--- 4. Backfill logi_usuarios_orgs (Léo) ---');
    const usuarios = await client.query(`SELECT id, email, perfil FROM logi_usuarios`);
    log(`  Encontrados ${usuarios.rows.length} usuários`);

    for (const u of usuarios.rows) {
      const exists = await client.query(
        `SELECT 1 FROM logi_usuarios_orgs WHERE usuario_id=$1 AND organizacao_id=$2`,
        [u.id, leoId]
      );
      if (exists.rows.length) {
        log(`  ✓ ${u.email} já vinculado à Léo`);
      } else {
        await client.query(
          `INSERT INTO logi_usuarios_orgs (usuario_id, organizacao_id, perfil_na_org)
           VALUES ($1, $2, $3)`,
          [u.id, leoId, u.perfil || 'admin']
        );
        log(`  ✓ ${u.email} → Léo (${u.perfil || 'admin'})`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 5. Vincular super-admin (Wellington) à WsDevSoft
    // ════════════════════════════════════════════════════════════════
    log('\n--- 5. Super-admin → WsDevSoft ---');
    const sa = await client.query(
      `SELECT id, email FROM logi_usuarios WHERE LOWER(email) = LOWER($1)`,
      [SUPER_ADMIN_EMAIL]
    );
    if (!sa.rows.length) {
      log(`  ⚠ Usuário '${SUPER_ADMIN_EMAIL}' não encontrado — pule esta etapa e vincule manualmente depois`);
    } else {
      const saId = sa.rows[0].id;
      const exists = await client.query(
        `SELECT 1 FROM logi_usuarios_orgs WHERE usuario_id=$1 AND organizacao_id=$2`,
        [saId, wsdevId]
      );
      if (exists.rows.length) {
        log(`  ✓ ${sa.rows[0].email} já vinculado à WsDevSoft`);
      } else {
        await client.query(
          `INSERT INTO logi_usuarios_orgs (usuario_id, organizacao_id, perfil_na_org)
           VALUES ($1, $2, 'super_admin')`,
          [saId, wsdevId]
        );
        log(`  ✓ ${sa.rows[0].email} → WsDevSoft (super_admin)`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 6. Adicionar organizacao_id (nullable) em todas as tabelas tenant
    // ════════════════════════════════════════════════════════════════
    log('\n--- 6. Coluna organizacao_id (nullable) ---');
    for (const tabela of TABELAS_TENANT) {
      if (!(await tableExists(client, tabela))) {
        log(`  ⚠ ${tabela}: tabela não existe — pulando`);
        continue;
      }
      if (await columnExists(client, tabela, 'organizacao_id')) {
        log(`  ✓ ${tabela}: coluna já existe`);
      } else {
        await client.query(
          `ALTER TABLE ${tabela} ADD COLUMN organizacao_id TEXT REFERENCES logi_organizacoes(id)`
        );
        log(`  ✓ ${tabela}: coluna adicionada`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 7. Backfill: todos os dados existentes pertencem à Léo
    // ════════════════════════════════════════════════════════════════
    log('\n--- 7. Backfill organizacao_id = Léo Madeiras ---');
    for (const tabela of TABELAS_TENANT) {
      if (!(await tableExists(client, tabela))) continue;
      const r = await client.query(
        `UPDATE ${tabela} SET organizacao_id = $1 WHERE organizacao_id IS NULL`,
        [leoId]
      );
      log(`  ✓ ${tabela}: ${r.rowCount} linhas atualizadas`);
    }

    // ════════════════════════════════════════════════════════════════
    // 8. Índices em organizacao_id
    // ════════════════════════════════════════════════════════════════
    log('\n--- 8. Índices em organizacao_id ---');
    for (const tabela of TABELAS_TENANT) {
      if (!(await tableExists(client, tabela))) continue;
      const idxName = `idx_${tabela}_org`;
      const idxExists = await client.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`,
        [idxName]
      );
      if (idxExists.rows.length) {
        log(`  ✓ ${idxName} já existe`);
      } else {
        await client.query(`CREATE INDEX ${idxName} ON ${tabela}(organizacao_id)`);
        log(`  ✓ ${idxName} criado`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 9. Validação final
    // ════════════════════════════════════════════════════════════════
    log('\n--- 9. Validação ---');
    const orgs = await client.query(`SELECT id, nome, slug, is_wsdevsoft FROM logi_organizacoes ORDER BY is_wsdevsoft DESC, nome`);
    log(`  Organizações cadastradas (${orgs.rows.length}):`);
    orgs.rows.forEach(o => log(`    - ${o.nome} (${o.slug}) ${o.is_wsdevsoft ? '[SUPER]' : ''}`));

    const vinc = await client.query(`
      SELECT u.email, o.nome AS org, uo.perfil_na_org
      FROM logi_usuarios_orgs uo
      JOIN logi_usuarios u ON u.id = uo.usuario_id
      JOIN logi_organizacoes o ON o.id = uo.organizacao_id
      WHERE uo.ativo
      ORDER BY u.email, o.nome
    `);
    log(`\n  Vínculos usuário↔org (${vinc.rows.length}):`);
    vinc.rows.forEach(v => log(`    - ${v.email} → ${v.org} (${v.perfil_na_org})`));

    // Sanity check: nenhuma linha sem organizacao_id nas tabelas tenant
    log('\n  Sanity check (linhas órfãs sem org):');
    let totalOrfas = 0;
    for (const tabela of TABELAS_TENANT) {
      if (!(await tableExists(client, tabela))) continue;
      const r = await client.query(`SELECT COUNT(*) AS c FROM ${tabela} WHERE organizacao_id IS NULL`);
      const c = parseInt(r.rows[0].c, 10);
      if (c > 0) {
        log(`    ⚠ ${tabela}: ${c} linhas órfãs`);
        totalOrfas += c;
      }
    }
    if (totalOrfas === 0) {
      log('    ✓ Nenhuma linha órfã. Pronto para Fase 5 (NOT NULL + RLS).');
    } else {
      log(`    ⚠ TOTAL: ${totalOrfas} linhas órfãs — investigar antes da Fase 5`);
    }

    await client.query('COMMIT');
    log(`\n=== ✓ MIGRATION 021 CONCLUÍDA EM ${new Date().toISOString()} ===`);
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    log('\n=== ✗ ERRO — ROLLBACK ===');
    log('ERROR: ' + e.message);
    log('STACK: ' + e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
})();
