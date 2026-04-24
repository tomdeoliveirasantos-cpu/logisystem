# WEAVY_PROMPTS — Geração de assets do LogiSystem

> Prompts prontos para gerar assets visuais no Weavy AI, alinhados ao `BRAND.md`.
> Ordem de execução sugerida no final do documento. Todo prompt já embute:
> paleta do LogiSystem (claro + azul `#2563EB` / sidebar `#0F2044`), tom
> profissional-industrial, e as âncoras negativas (sem gradiente colorido, sem
> ilustração 3D, sem emoji, sem estética de consumidor final).
>
> **Antes de rodar qualquer prompt, reler `BRAND.md` §3 (âncoras negativas) e §5
> (paleta). Após gerar, validar contra `BRAND.md` §9 (checklist de asset).**

---

## Índice de prompts

1. [Logo wsdevsoft — marca-mãe](#1-logo-wsdevsoft)
2. [Logo LogiSystem — marca-produto](#2-logo-logisystem)
3. [Validação da paleta](#3-validação-da-paleta)
4. [Background da tela de login](#4-background-da-tela-de-login)
5. [Empty states — família de 4](#5-empty-states)
6. [OG Image — social preview](#6-og-image)
7. [Favicon](#7-favicon)
8. [Hero ilustrativo — cadastro público de motorista](#8-hero-cadastro-motorista)

**Fora de escopo neste documento:** ícones dos módulos. A decisão é usar
`lucide-react` diretamente (ver `BRAND.md` §7.6 e o mapeamento de migração).

---

## Convenções de prompt

- **Ideogram V3** — usado quando há texto/tipografia precisa (logos, OG,
  favicon). Ideogram renderiza texto com fidelidade.
- **Flux 2 Pro** — usado quando é imagem sem texto (backgrounds, empty
  states, ilustrações). Flux produz composição melhor.
- **Aspect ratio** sempre explicitado no prompt (`--ar 1:1`, `--ar 16:9`, etc.).
- **Estilo negativo** sempre no final do prompt (`No gradient, no 3D...`).
- **Cores em hex** nos prompts — modelos lidam melhor com `#2563EB` do que "azul".

---

## 1. Logo wsdevsoft

**Uso:** marca-mãe da empresa. Aparece como rodapé em Romaneio PDF, no canto
da tela de login ("Powered by WsDevSoft"), em documentos externos e no README.

**Modelo:** Ideogram V3
**Aspect ratio:** `--ar 3:1` (horizontal, para uso em header)
**Variante adicional a gerar:** `--ar 1:1` (quadrada, para favicon secundário)

### Prompt principal

```
Minimalist corporate software company logo reading "wsdevsoft" in lowercase,
modern geometric sans-serif typography (similar to Inter or DM Sans),
letter "w" slightly enlarged with a subtle chevron or forward-slash accent
integrated into the first stroke, representing "software development". Single
solid color #0F2044 (navy blue) on pure white background. Clean, professional,
suitable for a B2B logistics software company. Flat vector style.

No gradient, no 3D effect, no shadow, no glow, no shine, no emoji, no mascot,
no decorative illustration, no orbit rings, no circuit pattern, no tech clichés
like lightning bolts or gears. Typography only with one geometric accent mark
maximum. --ar 3:1 --style raw
```

### Variante monocromática (para fundo escuro)

```
Same logo as wsdevsoft, but inverted: white "wsdevsoft" lettering on solid
#0F2044 navy background. Single color. Flat. --ar 3:1
```

### Validação
- O "w" tem o accent chevron? Se não, regerar.
- A tipografia lê bem em 32px de altura (uso real em header)?
- Contraste navy/branco ≥ 4.5:1 (OK por definição).

---

## 2. Logo LogiSystem

**Uso:** marca do produto. Aparece no header da sidebar, na aba do browser
(via favicon), no PDF de contrato de motorista, no email de boas-vindas.

**Modelo:** Ideogram V3
**Aspect ratio:** `--ar 3:1` e também `--ar 1:1` (ícone isolado)

### Prompt principal (wordmark + ícone)

```
Software product logo for "LogiSystem", a logistics management platform.
Wordmark in two weights: "Logi" in medium weight #0F2044, "System" in bold
weight #2563EB, both in a modern geometric sans-serif (Inter / DM Sans style).
To the left of the wordmark, a compact monogram mark: an abstract letter "L"
formed by two solid rectangles arranged to suggest a truck silhouette or a
routing path, in solid #2563EB on white background. The monogram is square,
about 1x1 proportion to the text height.

Flat vector, single-color fills, no outlines, no gradient, no shadow, no 3D,
no glow, no shine, no emoji, no mascot, no globe icon, no orbit rings, no
GPS pin cliché. Professional B2B aesthetic suitable for a dashboard header.
--ar 3:1 --style raw
```

### Prompt do ícone isolado

```
Minimalist square app icon: a stylized letter "L" formed by two solid
rectangles arranged to suggest a truck silhouette or routing path, color
#2563EB on solid white background, rounded container (16% corner radius).
Flat vector, single color, no gradient, no shadow, no 3D, no outline. --ar 1:1
```

### Validação
- O ícone sozinho é reconhecível em 32x32px (uso real na sidebar)?
- O "L" lê como "L" e também sugere movimento/transporte?
- Funciona invertido (branco sobre navy) sem perder o mark?

---

## 3. Validação da paleta

**Uso:** prova visual da paleta do BRAND.md. Serve para alinhar decisões de
cor com stakeholders e como referência ao rodar prompts de Flux 2 Pro
(podemos anexar este asset como referência de cor).

**Modelo:** Flux 2 Pro
**Aspect ratio:** `--ar 16:9`

### Prompt

```
Design system color palette reference card, flat vector style. Horizontal
layout with 8 color swatches arranged in a single row, each swatch is a
rounded rectangle (8px radius) with the hex code in small monospace type
below it on white background. Swatches in order from left to right:
#F4F7FB (label: background), #FFFFFF with thin border (label: surface),
#0F2044 (label: sidebar), #2563EB (label: accent), #16A34A (label: success),
#D97706 (label: warning), #DC2626 (label: critical), #0D9488 (label: info).
Above the row, a thin small-caps label "LogiSystem palette" in #0F1D35.

Pure flat design, no gradient, no shadow, no 3D, no glow, no texture, no
decoration. Clean typographic layout, generous whitespace. Suitable as a
slide in a design spec document. --ar 16:9 --style raw
```

### Validação
- Os hexes renderizados no asset batem com os do `BRAND.md`? (Flux às vezes
  desvia o tom — se swatch está visivelmente diferente do `#2563EB` real,
  regerar ou editar manualmente no Figma.)

---

## 4. Background da tela de login

**Uso:** `frontend/src/pages/Login.jsx` ocupa a tela inteira no desktop hoje.
Um hero sutil do lado esquerdo (ou em overlay 40%) eleva a tela de login sem
transformá-la em landing page.

**Modelo:** Flux 2 Pro
**Aspect ratio:** `--ar 16:9` (desktop) e `--ar 9:16` (mobile)

### Prompt principal

```
Abstract geometric background for a B2B logistics software login screen.
Composition: large flat shapes suggesting warehouse architecture, freight
containers, and routing lines. Palette strictly limited to #0F2044 (60%),
#2563EB (25%), #1D4ED8 (10%), #EEF4FF (5%). No other colors. Dominant mood:
quiet, industrial, confident, nocturnal warehouse. Simplified shapes only —
stacked rectangles for containers, thin parallel lines for routing paths,
large negative space. Isometric perspective, but flat shading (no rendered
depth). Slight texture from halftone dots is acceptable.

No photography, no 3D render, no realistic truck illustration, no human
figures, no text, no logo, no gradient mesh, no lens flare, no sky with
clouds, no futuristic neon, no circuit board pattern, no globe, no GPS pin.
Pure geometric composition. Mood boards: Loggi brand, Linear.app dashboard,
Ramp.com marketing pages. --ar 16:9 --style raw
```

### Variante mobile

```
Same composition, reformatted vertically for mobile login screen, same
palette and constraints. --ar 9:16
```

### Validação
- O asset funciona como **background** (elementos de UI sobrepostos continuam
  legíveis)? Se houver muita atividade visual no centro, regerar ou cropar.
- Respeita a paleta estrita? Se Flux introduziu um ciano ou verde fora da
  lista, regerar com paleta reforçada no prompt.
- Sem figuras humanas (o cadastro é B2B, não afetivo).

---

## 5. Empty states

**Uso:** 4 estados vazios reutilizáveis ao longo do sistema. Usar como
SVG/PNG pequeno (160-200px de largura) acompanhado do texto + CTA, conforme
`BRAND.md` §7.7.

**Modelo:** Flux 2 Pro
**Aspect ratio:** `--ar 1:1`

**Regra comum a todos:** estilo linha monocromática em `#2563EB` sobre fundo
`#F4F7FB`, stroke de 1.75-2px, sem preenchimento, proporção pequena
(a ilustração ocupa só 60% do quadro, centralizada, com whitespace em volta).
Estética próxima de ícones do Lucide mas em tamanho maior e com cena simples.

### 5.1 — Empty state: "Nenhuma ordem de transporte"

```
Minimalist single-line illustration: an empty clipboard with three horizontal
placeholder lines, a thin magnifying glass hovering slightly offset to the
right. Color: single stroke #2563EB at 2px weight on solid #F4F7FB background.
No fill, no shadow, no gradient, no color variation. Icon-like, suitable at
160px display size. Mood: calm, inviting action. Centered composition with
generous padding around the illustration. --ar 1:1 --style raw
```

### 5.2 — Empty state: "Nenhum motorista cadastrado"

```
Minimalist single-line illustration: a driver's ID card with a small circular
avatar silhouette placeholder and two horizontal lines beside it representing
name and document fields. Color: single stroke #2563EB at 2px weight on solid
#F4F7FB background. No fill, no shadow, no gradient. Icon-like, centered
composition. --ar 1:1 --style raw
```

### 5.3 — Empty state: "Nenhuma manutenção registrada"

```
Minimalist single-line illustration: a wrench crossed over a small gear,
both rendered as thin outlines only. Color: single stroke #2563EB at 2px
weight on solid #F4F7FB background. No fill, no shadow, no gradient.
Icon-like, centered composition with space around. --ar 1:1 --style raw
```

### 5.4 — Empty state: "Nenhum lançamento financeiro"

```
Minimalist single-line illustration: a stylized document/receipt with three
horizontal lines and a small currency symbol (generic, not specifically a
Real sign) at the bottom right corner. Color: single stroke #2563EB at 2px
weight on solid #F4F7FB background. No fill, no shadow, no gradient.
Icon-like, centered composition. --ar 1:1 --style raw
```

### Validação comum aos 4
- Os 4 assets formam uma **família visual coerente** (stroke igual, tamanho
  igual, proporção igual)? Gerar os 4 em sequência ajuda.
- Cada um é reconhecível em 160px sem precisar de legenda?
- Sem cor além do azul `#2563EB`? Sem gradient? Sem sombra?

---

## 6. OG Image

**Uso:** preview em link sharing (WhatsApp, Slack, LinkedIn). Referenciada
pelo `<meta property="og:image">` no `index.html`.

**Modelo:** Ideogram V3 (precisa renderizar texto)
**Aspect ratio:** `--ar 1.91:1` (1200x630 padrão OG)

### Prompt

```
Social media preview card for a B2B logistics software called LogiSystem.
Left side: large wordmark "LogiSystem" in modern geometric sans-serif
(Inter / DM Sans style), "Logi" in #0F2044 and "System" in #2563EB, bold
weight. Below the wordmark, small tagline in #4A5E7A, regular weight:
"Gestão logística para transportadoras e indústria". Right side: the same
abstract L monogram from the LogiSystem logo, large, #2563EB solid, on a
subtle background of thin #DDE5F0 routing lines.

Overall background: solid #F4F7FB (off-white). Flat design, no gradient,
no shadow, no 3D, no glow, no photo. Clean professional tech company preview
card, suitable for LinkedIn sharing. --ar 1.91:1 --style raw
```

### Validação
- Texto "LogiSystem" está legível em miniatura 300px de largura?
- Quando compartilhado no WhatsApp, a imagem não é cropada perdendo a marca
  (manter elementos a 10% das bordas)?

---

## 7. Favicon

**Uso:** `frontend/public/favicon.ico` e `favicon-32.png`.

**Modelo:** Ideogram V3
**Aspect ratio:** `--ar 1:1`
**Tamanhos a gerar:** 16x16, 32x32, 192x192 (PWA)

### Prompt

```
App favicon: square with rounded corners (18% radius), solid #2563EB
background, white stylized letter "L" formed by two thick rectangles in the
center, suggesting a truck silhouette or routing path. Flat design, no
gradient, no shadow, no 3D, no glow, no outline, single color. Crisp at
16x16 pixel size. --ar 1:1
```

### Validação
- Lê claramente como "L" em 16x16?
- A versão 192x192 mantém a mesma proporção do monograma?
- Não é uma redução direta do logo completo — favicon precisa ser mais
  agressivo/simples que o wordmark.

---

## 8. Hero — cadastro público de motorista

**Uso:** `frontend/src/pages/CadastroMotoristaPublico.jsx`. É a única tela
pública do sistema (motorista novo recebe link por WhatsApp e chega sem
login). Merece um hero mais acolhedor que o resto — motorista não é
despachante, é candidato. Mas **sem cair em "app de consumidor"**: sem
ilustrações 3D, sem cores vibrantes, sem mascote.

**Modelo:** Flux 2 Pro
**Aspect ratio:** `--ar 16:9`

### Prompt

```
Abstract geometric illustration for the header of a public driver onboarding
form. Composition: a simplified truck silhouette in outline (stroke 2px
#2563EB), moving from left to right, with parallel thin lines #DDE5F0
suggesting a route/road behind it, and three small stylized document shapes
(#2563EB outline) floating above the truck representing the onboarding
documents (CNH, CPF, contract). Background solid #F4F7FB. Flat design, line
art style, no fill inside the truck or documents, no photography, no 3D, no
gradient, no shadow, no human face, no hand-drawn look, no cartoon character.
Mood: welcoming but professional. Composition leaves 40% of the image empty
on the right side for potential overlay text. --ar 16:9 --style raw
```

### Validação
- Um candidato a motorista, com ensino fundamental completo, entende que
  essa imagem representa "cadastro de motorista"?
- Não parece ilustração de storybook? (teste: se passaria como ilustração
  de app infantil, regerar.)
- Mantém a paleta restrita a `#2563EB`, `#DDE5F0`, `#F4F7FB`?

---

## Ordem de execução sugerida

Assets que **bloqueiam** outros assets devem vir primeiro. Esta é a ordem
canônica para quem está começando do zero:

1. **Logo wsdevsoft** — bloqueia logo LogiSystem (queremos coerência de
   família tipográfica entre as duas marcas).
2. **Logo LogiSystem** — bloqueia favicon, OG image, e qualquer asset com
   monograma.
3. **Validação da paleta** — útil para anexar como referência nos prompts
   seguintes (Flux lida melhor com hex quando a referência visual reforça).
4. **Favicon** — derivado do monograma do logo.
5. **OG Image** — derivado do logo + tagline.
6. **Empty states** (família de 4 em sequência) — gerar os 4 em batch ajuda
   na coerência visual.
7. **Background do login** (desktop e mobile em sequência).
8. **Hero do cadastro de motorista** — único asset com "figura" (silhueta
   de caminhão); gerar por último evita contaminar a estética monocromática
   dos anteriores.

---

## Checklist geral de validação de asset

Aplicar a qualquer asset antes de salvar em `frontend/public/assets/`:

- [ ] Respeita a paleta do `BRAND.md` §5 — nenhuma cor fora dos hexes listados.
- [ ] Não viola nenhuma das 4 âncoras negativas do `BRAND.md` §3.
- [ ] Sem gradient, sem sombra, sem 3D, sem glow (salvo exceção documentada).
- [ ] Sem emoji embutido na imagem.
- [ ] Sem logotipo/marca de terceiro aparecendo (Ideogram e Flux às vezes
      "inventam" marcas; se aparecer, regerar).
- [ ] Sem figura humana realista (salvo silhueta abstrata explicitamente
      pedida).
- [ ] Sem texto em inglês em asset com audiência pt-BR (usuários internos
      veem português).
- [ ] Contraste mínimo WCAG AA se houver texto sobreposto.
- [ ] Nome de arquivo descritivo em kebab-case: `empty-state-ordens.svg`,
      `hero-login-desktop.png`.
- [ ] Salvar em `frontend/public/assets/[categoria]/` — categorias: `brand/`,
      `empty-states/`, `hero/`, `og/`.

---

## Onde vivem os assets gerados

```
frontend/public/
├── favicon.ico
├── wsdevsoft-logo.svg          (já existe)
└── assets/
    ├── brand/
    │   ├── logisystem-logo.svg
    │   ├── logisystem-logo-dark.svg      (variante para fundo escuro)
    │   ├── logisystem-icon.svg
    │   └── wsdevsoft-logo-dark.svg
    ├── empty-states/
    │   ├── sem-ordens.svg
    │   ├── sem-motoristas.svg
    │   ├── sem-manutencao.svg
    │   └── sem-financeiro.svg
    ├── hero/
    │   ├── login-desktop.png
    │   ├── login-mobile.png
    │   └── cadastro-motorista.png
    └── og/
        ├── og-default.png
        └── palette-reference.png           (interno, não vai ao público)
```

---

## Quando este documento é atualizado

- **Imediatamente** ao adicionar/remover módulo que precise de empty state
  novo.
- **Em PR próprio** ao introduzir nova família de asset (ex: ilustrações
  para uma landing page pública futura).
- **Após regerar** um prompt no Weavy com ajustes — documentar o ajuste
  aqui, não num chat separado.

_Última revisão: Abril 2026. Alinhado com `BRAND.md` Abril 2026._
