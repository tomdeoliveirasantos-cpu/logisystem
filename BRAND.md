# BRAND — LogiSystem

> Guia visual e de conteúdo do LogiSystem. Este documento é a fonte da verdade
> para qualquer decisão de UI, geração de asset, ou revisão de PR de frontend.
> É consultado pelo `code-review.yml` em todo PR que mexe em `frontend/`.
>
> **Se algo neste documento contradiz o código em produção, o documento vence.**
> Quando houver divergência, o PR que reconcilia ou é aberto imediatamente, ou
> o BRAND.md é atualizado de forma consciente — nunca ignorado.

---

## 1. O que é o LogiSystem

Sistema de gestão logística web construído pela WsDevSoft para a **Léo Madeiras**.
Operado diariamente por despachantes, controladores de frota, financeiro e
administradores. Rodando em produção em `app.wsdevsoft.com`.

Cobre o ciclo operacional completo: cadastro de clientes/transportadoras/frota,
onboarding digital de motoristas agregados, ordens de transporte, romaneio com
agrupamento, manutenção preventiva e corretiva, multas, contas a pagar e
receber, tabela de fretes, importação de planilhas do cliente, e relatórios.

**Quem usa:** gente que passa 6-8 horas por dia dentro do sistema. Não é um
onboarding bonito para impressionar, é uma ferramenta de trabalho repetitivo
que precisa ser rápida, previsível e resistente a erro humano.

---

## 2. Como o usuário deve se sentir

Em ordem de prioridade (quando houver trade-off, ganha quem está mais no topo):

1. **No controle e confiante** — a tela nunca "esconde" o estado real.
   Totais batem, IDs são visíveis, status é sempre óbvio, ações destrutivas
   pedem confirmação. Nada "automático demais" sem o usuário saber.
2. **Ágil e produtivo** — atalhos de teclado, filtros persistidos, formulários
   que não quebram ao recarregar, exportações de 1 clique, sem cliques
   cerimoniais ("tem certeza que quer ver o detalhe?").
3. **Organizado e tranquilo** — hierarquia visual clara, mesmo com tela cheia
   de dados. Respiro entre seções, tipografia consistente, sem ruído decorativo.
4. **Profissional e sério** — visual que um gerente de logística mostra para
   o dono da transportadora sem constrangimento. Sem "toy look", sem memes,
   sem copy brincalhona em contexto operacional.

---

## 3. Âncoras negativas — o que o LogiSystem NÃO pode parecer

Quando estiver em dúvida, rode mentalmente esta checklist. Se a tela cai em
qualquer uma das quatro, está errada — independente do que o BRAND.md
"permite" positivamente.

### 3.1 Sistema legado dos anos 2000
Sintomas: cinza chapado `#CCCCCC`, Arial/Tahoma 9pt, tabelas sem respiro com
bordas duplas, linhas zebradas em azul-claro violento, botões com biselado,
ícones 16x16 do Windows XP, ausência total de microinterações.
**Remédio:** respiro vertical, radius nos cantos, tipografia contemporânea,
estados de hover explícitos.

### 3.2 Ferramenta genérica de CRUD
Sintomas: tela cara de admin template do ThemeForest — sidebar roxa com ícones
do FontAwesome, dashboard com 4 gráficos aleatórios que ninguém olha, badges
coloridas sem mapeamento de domínio, copy genérica ("Welcome back, User!").
**Remédio:** vocabulário do domínio sempre (OT, romaneio, CTe, MDFe, agregado),
componentes que refletem o problema real, nunca componentes "decorativos".

### 3.3 App de consumidor final
Sintomas: gradientes coloridos em botões e cards, ilustrações 3D de pessoinhas,
emojis decorativos no menu, animações de celebração em ações comuns, hero
sections com lottie, cores pastéis saturadas.
**Remédio:** cores chapadas, ícones em linha 1.5-2px, animações só para feedback
funcional (loading, toast), sem emoji em UI permanente.

### 3.4 Planilha Excel turbinada
Sintomas: tudo com mesmo peso tipográfico, nenhuma hierarquia, tabelas que
ocupam 100% da tela sem nenhum filtro visível, texto azul sublinhado como
único indicador de clicável, font-size único, sem spacing entre grupos lógicos.
**Remédio:** hierarquia tipográfica explícita (3 tamanhos mínimo), filtros
sempre visíveis no topo, agrupamento visual com cards/sections, densidade
controlada.

---

## 4. Direção visual — princípios

### 4.1 Densidade com respiro
Operação logística é densa por natureza. A tabela de ordens tem 12 colunas
relevantes, o romaneio agrupa dezenas de linhas. Densidade é requisito, mas
respiro (padding interno, line-height 1.6, altura de linha em tabelas) é o que
separa uma ferramenta profissional de uma planilha. Medida de referência:
13px body, 10-11px labels auxiliares, padding 8-12px em células, 16-20px em
cards.

### 4.2 Monocromático com acentos funcionais
A tela é neutra (fundo claro, textos escuros, bordas discretas). Cor tem
significado: azul é ação do sistema, verde é sucesso/recebido, vermelho é
crítico/vencido, âmbar é pendente/atenção, teal é categoria informativa.
**Nunca use cor como decoração.** Se uma cor aparece na tela e não comunica
estado, remova.

### 4.3 Dados primeiro, decoração nunca
Se uma borda, ícone, gradiente ou ilustração pode ser removida sem prejuízo
de compreensão, remova. O dashboard mostra números de ordens reais, não cards
vazios esperando dados. O estado vazio sugere a próxima ação, não celebra
ausência.

### 4.4 Previsibilidade sobre novidade
O mesmo botão faz a mesma coisa em toda tela. Badges de status têm cor fixa
por status no `StatusBadge`. Modais abrem do mesmo jeito. Confirmações usam
o mesmo padrão. Quando há dúvida entre "fazer igual" e "fazer melhor",
fazer igual.

---

## 5. Paleta — tokens CSS

A paleta vive em `frontend/src/index.css` no `:root`. **Não duplicar em JS,
não recriar em componentes com hex hardcoded.** Se um componente precisa de
cor, usar `var(--nome)`. Se a cor não existe, adicionar ao `:root`.

### 5.1 Neutros e superfícies
```css
--bg:       #F4F7FB;  /* Fundo da aplicação */
--bg2:      #FFFFFF;  /* Cards, modais, inputs */
--bg3:      #EEF2F8;  /* Zebra sutil, headers de tabela, botão ghost */
--text:     #0F1D35;  /* Texto principal */
--text2:    #4A5E7A;  /* Texto secundário / labels */
--text3:    #8FA3BE;  /* Hints, placeholders, labels em uppercase */
--border:   #DDE5F0;  /* Borda padrão de cards, tabelas, inputs */
--border2:  #C8D5E8;  /* Borda de input em estado normal */
```

### 5.2 Sidebar
```css
--sidebar:    #0F2044;              /* Fundo CHAPADO — sem gradiente */
--sidebar-h:  rgba(255,255,255,.07); /* Hover de nav-item */
--sidebar-a:  rgba(99,144,255,.18);  /* Active de nav-item */
```

**Mudança obrigatória ao aplicar este documento:**
a variável `--sidebar-grad` (gradiente `#0F2044 → #1a3a6e → #1e4080`) existe
hoje no CSS e deve ser **removida**. A sidebar usa apenas `--sidebar` chapado.
Mesma coisa para `.brand-icon` — a cor azul do ícone da logo deve ser
`#2563EB` chapado, não o gradiente `linear-gradient(135deg, #3B82F6, #2563EB)`.

### 5.3 Acento primário (azul)
```css
--accent:    #2563EB;  /* Azul principal — links, foco, borda esquerda de métrica */
--accent2:   #1D4ED8;  /* Hover do btn-primary */
--accent-lt: #EEF4FF;  /* Background de badge-blue */
```

**Mudança obrigatória:** a variável `--accent-grad` existe hoje e é usada no
`.btn-primary`. Deve ser **removida**. `.btn-primary` usa `--accent` chapado
e muda para `--accent2` no hover. Motivo: gradiente colorido em botão é uma
das entradas da âncora negativa 3.3 ("app de consumidor final").

### 5.4 Status (semânticos)
```css
--green:    #16A34A;  --green-bg: #F0FDF4;   /* Entregue, recebido, pago, sucesso */
--amber:    #D97706;  --amber-bg: #FFFBEB;   /* Pendente, warning, atenção */
--red:      #DC2626;  --red-bg:   #FEF2F2;   /* Cancelado, vencido, devolução, crítico */
--teal:     #0D9488;  --teal-bg:  #F0FDFA;   /* Categoria informativa (frota própria) */
```

Regras rígidas:
- **Verde é sempre desfecho positivo consumado** — pago, recebido, entregue.
  Nunca "em andamento", nunca "ok, pode clicar".
- **Vermelho é sempre problema acionável** — vencido, cancelado, devolução.
  Nunca "botão perigoso" decorativo.
- **Âmbar é sempre atenção que precisa de ação** — pendente, vence em X dias,
  pendência do cliente. Nunca "amarelo porque ficou bonito".
- **Teal é categoria neutra informativa** — tipo de veículo (próprio/terceiros),
  tipo de manutenção. Nunca status.
- **Azul é sistema** — elemento clicável, selecionado, foco. Nunca status de
  domínio.

### 5.5 Radius, sombras, layout
```css
--radius:      10px;   /* Inputs, botões, badges pill (usar 99px para pill) */
--radius-lg:   14px;   /* Cards, modais */
--sidebar-w:   224px;
--sidebar-w-collapsed: 60px;
--header-h:    56px;
--shadow-sm:   0 1px 4px rgba(15,32,68,.07), 0 1px 2px rgba(15,32,68,.04);
--shadow-md:   0 4px 20px rgba(15,32,68,.1);
--transition:  all .2s ease;
```

### 5.6 Roadmap — dark mode
Dark mode **não é objetivo imediato**. Sinalizado aqui para decisões futuras
não serem tomadas à revelia:
- Quando/se entrarmos em dark, os tokens semânticos de status (green/amber/red/teal)
  ficam próximos dos atuais — apenas os `*-bg` escurecem.
- A inversão correta de neutros seria `#0A0E17 / #141B2B / #1F2A44` para bg
  em três níveis, e a sidebar permaneceria `#0F2044` (ela já é escura).
- Preferência: implementar via classe `[data-theme="dark"]` no `<html>`,
  nunca `prefers-color-scheme` sozinho — usuário em galpão iluminado não
  quer tela escurecendo automaticamente ao entardecer.

Enquanto isso, **não introduzir tokens escuros no CSS** — só adicionar quando
houver PR de implementação real.

---

## 6. Tipografia

Famílias carregadas no projeto hoje (via `index.html` ou import CSS no `index.css`):

```css
--font:         'DM Sans', system-ui, -apple-system, sans-serif;
--font-heading: 'Satoshi', 'DM Sans', system-ui, sans-serif;
--mono:         'Consolas', 'Courier New', monospace;
```

**DM Sans** é a base de UI. **Satoshi** é aplicada automaticamente em
`h1-h6`, `.page-title`, `.modal-title`, `.section-title`, `.brand-name`,
`.metric-value` via regra global no `index.css`.

### 6.1 Escala (em px, base 14px no `<html>`)
| Uso                       | Tamanho | Peso | Família     |
|---------------------------|---------|------|-------------|
| `h1` / page hero          | 22–24px | 600  | Satoshi     |
| `h2` / section title      | 14px    | 600  | Satoshi     |
| `h3` / modal-title        | 15px    | 600  | Satoshi     |
| `.metric-value`           | 22px    | 700  | Satoshi     |
| Body / `td`               | 13px    | 400  | DM Sans     |
| Labels de form            | 12px    | 500  | DM Sans     |
| `thead th`, `.metric-label`| 10–11px| 600 uppercase 0.05em | DM Sans |
| IDs, números em tabela    | 13px    | 400  | Consolas (`.font-mono`, `tabular-nums`) |

### 6.2 Regras
- **Números em tabela usam `font-variant-numeric: tabular-nums`.** Alinhamento
  vertical de dígitos importa em operação.
- **IDs de registro (OT-1047, CT-e 3524) usam mono.** Facilita busca visual
  e Ctrl+F.
- **Nunca usar `font-weight: 900`.** Fica pesado demais para telas densas.
  Pesos canônicos: 400, 500, 600, 700.
- **Sentence case em títulos e botões.** "Nova ordem" não "Nova Ordem", "Novo
  motorista" não "NOVO MOTORISTA". Exceção: labels auxiliares em `text-transform: uppercase`
  com `letter-spacing: 0.05em` (ex: "ORDENS", "ENTREGUES" em metric cards).

---

## 7. Componentes — padrão atual

Componentes base vivem em `frontend/src/components/UI.jsx` e estilos globais
em `frontend/src/index.css`. Este documento reflete **o que existe hoje**.
Quando novo componente é criado, adicionar aqui.

### 7.1 Botões — classe `.btn`
Três variantes apenas:
- `.btn-primary` — ação primária da tela. **Um por tela no máximo.** Cor
  chapada `--accent`, hover `--accent2`. Sem gradiente (ver 5.3).
- `.btn-ghost` — ações secundárias (cancelar, fechar, filtrar). Fundo `--bg3`,
  borda `--border`.
- `.btn-danger` — ações destrutivas confirmadas (excluir, cancelar OT). Fundo
  `--red-bg`, texto `--red`. Nunca usar decorativamente.

Variante de tamanho: `.btn-sm` para barras de ações em tabela e filtros.

### 7.2 Cards — classe `.card`
Contêiner genérico de seção. `bg2` sobre `bg`, borda `--border`, radius `--radius-lg`,
padding `16px 20px`, shadow `--shadow-sm`. Cards empilhados ganham `margin-top: 16px`.

### 7.3 Metric cards — classe `.metric-card`
Para KPIs no topo do Dashboard. Border-left colorido (3px) indica a família
do indicador: `.green` / `.amber` / `.red` / `.teal`, default `--accent`.
Layout: label uppercase 10px `--text3` + valor 22px `--text` + sub opcional 11px.
**Não criar variante "metric-card-hero" ou "metric-card-xl"** — se um KPI
merece mais destaque, o problema é de layout do dashboard, não do componente.

### 7.4 Tabelas
Estilos globais na tag `table`. Regras:
- `thead th` uppercase 11px `--text3`, fundo `--bg3`, padding `9px 12px`.
- `tbody td` 13px `--text`, padding `10px 12px`, borda inferior `--border`.
- Hover na linha: fundo `#F8FAFF` (não criar nova variável, é uso único).
- `.table-wrap` obrigatório para permitir scroll horizontal em mobile.
- **Nenhuma tabela sem wrap.** Em telas abaixo de 900px a tabela rola em X,
  nunca quebra linha em célula.

### 7.5 Badges — classe `.badge` + modificador
Ver componente `<StatusBadge />` em `UI.jsx` para o mapeamento canônico de
status de domínio. Status conhecidos:
- `entregue`, `recebido`, `pago` → verde
- `pendente` → âmbar
- `devolucao`, `cancelado`, `vencido` → vermelho
- `proprio`, `frota` → teal
- `terceiros`, `agregado`, `preventiva` → azul
- `corretiva` → âmbar

**Nunca inline-style uma badge com cor nova.** Se um novo status aparece no
domínio, adicionar ao mapa de `StatusBadge` com justificativa.

### 7.6 Ícones
- **Não usar emoji como ícone de UI permanente.** Emoji no menu (`📋`, `🚛`, `👤`)
  é débito técnico a pagar — a âncora negativa 3.4 alerta sobre isto.
- **Substituir por `lucide-react`** (stroke 1.75-2px, 16px em botões/menu,
  20px em cards, 24px em estados vazios).
- Ícone de aplicação (logo) é SVG inline ou asset em `frontend/public/`.

Migração de emoji → lucide acontece em PR próprio, não misturado com feature.
Mapeamento sugerido (sidebar):
- 📋 Clientes / Ordens → `Users` / `ClipboardList`
- 🏢 Transportadoras → `Building2`
- 🚛 Veículos → `Truck`
- 👤 Motoristas → `UserCircle`
- 🏪 Fornecedores → `Store`
- 📁 Importar → `FileUp`
- 🔧 Manutenção → `Wrench`
- ⚠️ Multas → `AlertTriangle`
- 📥 Receber / 📤 Pagar → `ArrowDownToLine` / `ArrowUpFromLine`
- 💲 Fretes → `DollarSign`
- 📊 Dashboard / 📈 Relatórios → `LayoutDashboard` / `BarChart3`
- 🖨️ Romaneio → `Printer`
- 🔐 Usuários → `ShieldCheck`
- ⚙️ Parâmetros → `Settings`

### 7.7 Estados vazios
Template: ícone 32-40px `--text3`, título 14px `--text2`, descrição 13px
`--text3`, 1 CTA `.btn-primary` (opcional, só quando a ação é óbvia).
**Nunca usar ilustração 3D.** Nunca usar copy genérica ("Ops! Nada aqui.").
Copy deve explicar o que está faltando e convidar à ação:
- Bom: "Nenhum motorista cadastrado ainda. [+ Novo motorista]"
- Ruim: "Não há dados para exibir."

### 7.8 Formulários — componentes `Field`, `Input`
- Labels sempre visíveis acima do input (nunca placeholder como label).
- Erros abaixo do input em vermelho (`--red`), 11px.
- Grupos lógicos separados por `<fieldset>` ou `margin-bottom: 16px`.
- Formulário de 3+ seções vai em `.tabs` ou accordion, nunca em um único scroll.
- Campos obrigatórios marcados com asterisco no label, não na borda.

### 7.9 Modais — componente `Modal`
Usar sempre `<Modal>` do `UI.jsx`. Props: `title`, `onClose`, `width` (default 600).
Confirmações destrutivas: modal com `btn-ghost` (Cancelar) à esquerda e
`btn-danger` (Confirmar) à direita. Nunca usar `window.confirm`.

### 7.10 Toasts e feedback
`.toast-success` e `.toast-error` (canto inferior direito, auto-dismiss 3s).
Feedback de ação que altera dados **é obrigatório** — criar, editar, excluir
sempre mostram toast. Reload silencioso de lista sem indicação é bug.

---

## 8. Tom de voz — copy de UI

### 8.1 Idioma e registro
- **Português brasileiro.** Sempre.
- **Direto, sem gerúndio de enrolação.** "Carregando..." não "Estamos
  carregando seus dados...".
- **Vocabulário do domínio.** Usar os termos que o despachante usa:
  - OT / Ordem de Transporte (não "pedido", não "entrega")
  - Romaneio (não "lote", não "batch")
  - CT-e / MDF-e (com hífen, maiúsculas)
  - Coleta / Entrega (não "pickup" / "dropoff")
  - Agregado / Próprio / Terceiros (tipo de motorista/veículo)
  - Frete (não "tarifa")
  - Manutenção preventiva / corretiva
  - Despachante (não "operador", salvo quando for perfil de acesso no sistema)
- **Sem gírias, sem emoji em copy permanente.** Exceção: feedback momentâneo
  ("✓ Salvo") ou status inequívoco.

### 8.2 Padrões de botão
- Ação primária em verbo no infinitivo: "Salvar", "Criar ordem", "Gerar romaneio".
- Ação secundária curta: "Cancelar", "Voltar", "Fechar".
- Confirmação destrutiva explicita o objeto: "Excluir motorista" não "Confirmar".

### 8.3 Mensagens de erro
- Explicar **o que aconteceu** e **o que fazer**, nessa ordem.
- Bom: "CPF inválido — verifique os dígitos e tente novamente."
- Ruim: "Erro 400. Contate o administrador."
- Nunca expor stack trace ou mensagem crua de API no toast.

### 8.4 Confirmações
- Sempre no formato: "Tem certeza que deseja [ação] [objeto]? [Consequência]."
- "Tem certeza que deseja excluir este motorista? Os dados associados serão mantidos em histórico."
- Nunca "Tem certeza?" sozinho.

---

## 9. Workflow de geração de assets

Quando precisar de asset visual novo (logo, ícone de módulo, background de
login, estado vazio, OG image, favicon), seguir **`WEAVY_PROMPTS.md`** na raiz
do repo. Regra básica:

1. Consultar este BRAND.md para confirmar a paleta e o estilo.
2. Pegar o prompt relevante em `WEAVY_PROMPTS.md` e rodar no Weavy AI.
3. Validar o asset gerado contra:
   - Paleta (sem cor fora de `:root`)
   - Âncoras negativas (seção 3)
   - Contraste mínimo (WCAG AA para texto)
4. Salvar asset em `frontend/public/assets/[categoria]/` com nome descritivo.

**Para ícones de módulos não se gera no Weavy** — usa-se `lucide-react`
(ver 7.6).

---

## 10. Checklist de merge — telas novas

Antes de abrir PR que toca `.jsx`, `.tsx`, `.css`, `.scss` ou `frontend/public/`,
rodar mentalmente:

- [ ] Nenhuma cor hex hardcoded fora de `index.css` (usar `var(--...)`).
- [ ] Nenhum gradiente colorido novo (âncora 3.3).
- [ ] Nenhum emoji decorativo em UI permanente (âncora 3.4).
- [ ] Tipografia usa variáveis `--font` / `--font-heading` / `--mono`.
- [ ] Tabela tem `.table-wrap` para scroll em mobile.
- [ ] Tabela tem ao menos um filtro visível antes do corpo.
- [ ] Formulário tem labels visíveis, erros tratados, estado de loading.
- [ ] Ação primária da tela tem exatamente UM `btn-primary`.
- [ ] Ação destrutiva passa por `Modal` de confirmação.
- [ ] Status de domínio usam `<StatusBadge>`, nunca badge com cor inline.
- [ ] Feedback de sucesso/erro visível (toast) após ação de mutação.
- [ ] Responsivo testado em ≤ 640px (breakpoint mobile).
- [ ] Vocabulário do domínio respeitado na copy (OT, romaneio, CTe, etc.).
- [ ] Nenhuma copy genérica ("Ops!", "Ocorreu um erro") sem contexto.

---

## 11. Arquivos relacionados

- `frontend/src/index.css` — tokens e estilos globais (fonte da verdade dos tokens).
- `frontend/src/components/UI.jsx` — componentes base reutilizáveis.
- `frontend/src/components/Sidebar.jsx` — IA do menu e mapeamento de módulos.
- `WEAVY_PROMPTS.md` — prompts de geração de assets.
- `.github/workflows/code-review.yml` — revisão automática que consulta este documento.

---

_Última revisão: Abril 2026. Próxima revisão obrigatória ao migrar emojis →
lucide-react, ou ao introduzir dark mode, o que vier primeiro._
