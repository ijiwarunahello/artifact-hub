---
name: using-artifact-hub
description: Use when you finish meaningful research, build a runnable HTML demo, or want to share output with another agent or with the human across sessions — publishes the result to the local Artifact Hub MCP server so a human can view it in a browser and other agents can fetch it later.
---

# Using Artifact Hub

The Artifact Hub is a local always-on MCP server at `http://127.0.0.1:27183`. It stores
"artifacts" — durable, addressable pieces of agent output — and pushes new ones live to
a browser dashboard the human keeps open.

## When to publish

Publish (`artifact_create`) when:

- You finish a research pass and the report would be lost otherwise
- You build an interactive HTML/SVG demo the human should be able to interact with
- You produce a piece of code worth highlighting (configs, scripts, snippets)
- Another agent is likely to want this output later

Skip publishing for: trivial answers, single-shot questions, ephemeral debug output, code
that already lives in a real file in a repo.

## When to consume

Before starting a new research task, call `artifact_search` with a couple of likely
keywords. If a prior pass already covered the topic, call `artifact_get` and treat that
content as authoritative context — do not redo the same work.

Use `artifact_list` to browse what is available when you don't yet have a query.

## Choosing a kind

**Default to `html`.** Write-ups should ship as a single self-contained HTML
document with layout, headings, callout boxes, and diagrams. HTML artifacts can
load Mermaid from `cdn.jsdelivr.net` for rich graphs / sequence / state diagrams,
and may inline SVG illustrations and `<style>` blocks. Treat the dashboard
iframe as your canvas, not a README.

`markdown` is **no longer accepted** for new artifacts — the renderer cannot mix
in diagrams or interactive elements alongside prose, which is what humans and
agents want when scanning a research result. Use `html` instead and lift the
prose into semantic sections.

Use the other kinds for narrow purposes:

| kind     | When                                                                  |
|----------|-----------------------------------------------------------------------|
| `html`   | Any substantive write-up, demo, dashboard, or illustrated explainer.  |
| `svg`    | A single standalone vector illustration with no surrounding prose.    |
| `mermaid`| A single standalone diagram (graph / sequence / state / ER).          |
| `code`   | A single code snippet worth highlighting on its own.                  |

If you find yourself reaching for `markdown`, you're about to publish a
write-up — convert it to `html` with a small style block, headings, and at
least one diagram (mermaid block or inline SVG) and publish that instead.

## HTML design guidelines

Every HTML artifact is a self-contained document a human reads in a browser.
Follow these guidelines so output is consistently readable and well-crafted.
The aesthetic is Swiss Style: grid-based, whitespace-driven, no decoration
for decoration's sake.

### Reference CSS variables

Copy this block into every HTML artifact's `<style>` and build on it.
Adjust the accent color to suit the topic if desired; keep the rest stable.

```css
:root {
  /* Fonts */
  --font-sans: system-ui, -apple-system, "Helvetica Neue",
               "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code",
               "Fira Code", Menlo, monospace;

  /* Type scale — Major Third (1.25) */
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-sm:   clamp(0.875rem, 0.85rem + 0.12vw, 0.9375rem);
  --text-xs:   clamp(0.75rem, 0.73rem + 0.1vw, 0.8125rem);
  --text-h4:   clamp(1.125rem, 1.05rem + 0.38vw, 1.25rem);
  --text-h3:   clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-h2:   clamp(1.5rem, 1.25rem + 1.25vw, 1.875rem);
  --text-h1:   clamp(1.875rem, 1.5rem + 1.88vw, 2.5rem);

  /* Spacing — 8px grid */
  --sp-1: 0.25rem; --sp-2: 0.5rem;  --sp-3: 0.75rem; --sp-4: 1rem;
  --sp-5: 1.5rem;  --sp-6: 2rem;    --sp-8: 3rem;    --sp-10: 4rem;
  --sp-12: 5rem;

  /* Colors — monochrome + single accent */
  --c-bg:         #ffffff;
  --c-bg-subtle:  #f5f5f5;
  --c-bg-muted:   #e8e8e8;
  --c-text:       #1a1a1a;
  --c-text-muted: #555555;
  --c-border:     #d0d0d0;
  --c-accent:     #0055ff;
  --c-accent-bg:  #eef3ff;

  /* Semantic — conventional UI colors */
  --c-info:       #0055ff;  /* = accent */
  --c-info-bg:    #eef3ff;  /* = accent-bg */
  --c-tip:        #1a7f37;
  --c-tip-bg:     #effbf3;
  --c-warn:       #8a4500;
  --c-warn-bg:    #fef4e8;
  --c-danger:     #c41e1e;
  --c-danger-bg:  #fdf0f0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --c-bg:         #111111;
    --c-bg-subtle:  #1c1c1c;
    --c-bg-muted:   #282828;
    --c-text:       #e5e5e5;
    --c-text-muted: #aaaaaa;
    --c-border:     #555555;
    --c-accent:     #5599ff;
    --c-accent-bg:  #1a2744;
    --c-info:       #5599ff;
    --c-info-bg:    #1a2744;
    --c-tip:        #3dbb5e;
    --c-tip-bg:     #0d2818;
    --c-warn:       #e09050;
    --c-warn-bg:    #2a1a00;
    --c-danger:     #f07070;
    --c-danger-bg:  #2a0a0a;
  }
}
```

Never load CJK web fonts (Noto Sans JP is 9 MB+). The system font stack
covers macOS, Windows, iOS, and Android.

### Typography rules

- **Body**: `font-size: var(--text-base)` (16-18 px), `line-height: 1.7`.
- **Headings**: limit to 3-4 levels. H1 bold 700, H2 semibold 600,
  H3 medium 500. `line-height: 1.3`, `letter-spacing: -0.02em` on H1/H2.
  All headings use `--c-text` (never muted) — differentiate by size and
  weight only.
- **Weight hierarchy**: Regular 400 (body) > Medium 500 > Semibold 600 >
  Bold 700. Use weight and size, not color, to show importance.
- **Code**: `font-family: var(--font-mono)`, `font-size: 0.9em`.

### Spacing rules

- Separate sections with whitespace (`margin-top: var(--sp-12)` = 80 px).
  In constrained layouts (tabs, sidebars), combine whitespace with a
  `border-top: 2px solid var(--c-border)` on subsection headings.
- Heading `margin-top` must be larger than `margin-bottom` so the heading
  attaches visually to the content below it, not the section above.
- Constrain content width: `max-width: 40em` for CJK-heavy documents,
  `max-width: 66ch` for Latin-heavy. Center with `margin-inline: auto`.

### Color rules

- Monochrome first. Use `--c-accent` only for links and primary actions.
- Body text `--c-text` on `--c-bg` must exceed 4.5:1 contrast (WCAG AA).
- Muted text `--c-text-muted` is for metadata, captions, and labels only.
- **Semantic colors override monochrome**: 一般的に認知された
  UI セマンティクス（info=blue, tip/success=green, warning=amber,
  danger/error=red）は慣例に従う。これは装飾ではなく情報設計。
- Callout types use dedicated CSS variables per severity:

  | Type       | Color var      | Use case                          |
  |------------|----------------|-----------------------------------|
  | `.note`    | `--c-info`     | 補足情報、参考リンク              |
  | `.tip`     | `--c-tip`      | ヒント、推奨事項、ベストプラクティス |
  | `.warning` | `--c-warn`     | 注意事項、非推奨、前提条件        |
  | `.danger`  | `--c-danger`   | 安全上の危険、データ損失、不可逆操作 |

### Document structure

Every HTML artifact must include:

1. **H1 title** — one per document, at the top.
2. **Summary box** — immediately after H1. A bordered/shaded box with 2-4
   bullet points stating the key takeaways. The reader decides relevance
   from this box alone.
3. **Table of contents** — required when there are 3+ sections. Inline
   `<nav>` with anchor links. Use the `.toc` pattern below.
4. **Sections** (`<section>`) — each with an H2. Subsections use H3.

Keep bold/highlighted text under 30 % of the total. Use `<details>` for
secondary content in long documents.

### Component patterns

**Callout** — left-border accent, semantically-colored background.
Text inside callouts always uses `--c-text` (never muted). The label
uses the semantic color for its type. Follow conventional UI color
associations: blue=info, green=tip, amber=warning, red=danger.
```html
<div class="callout warning">
  <div class="callout-label">Warning</div>
  <p>Important safety information here.</p>
</div>
```
```css
.callout { padding: var(--sp-4) var(--sp-5); margin: var(--sp-6) 0;
           background: var(--c-bg-subtle); border-left: 3px solid var(--c-border);
           color: var(--c-text); }
.callout.note    { border-left-color: var(--c-info);   background: var(--c-info-bg); }
.callout.tip     { border-left-color: var(--c-tip);    background: var(--c-tip-bg); }
.callout.warning { border-left-color: var(--c-warn);   background: var(--c-warn-bg); }
.callout.danger  { border-left-color: var(--c-danger); background: var(--c-danger-bg); }
.callout-label   { font-size: var(--text-xs); font-weight: 600;
                   text-transform: uppercase; letter-spacing: 0.05em; }
.callout.note .callout-label    { color: var(--c-info); }
.callout.tip .callout-label     { color: var(--c-tip); }
.callout.warning .callout-label { color: var(--c-warn); }
.callout.danger .callout-label  { color: var(--c-danger); }
```

**Table** — wrap in a bordered container for clear boundaries:
```css
.table-wrap { border: 1px solid var(--c-border); overflow-x: auto;
              margin: var(--sp-4) 0 var(--sp-6); }
table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
thead { background: var(--c-bg-muted); border-bottom: 2px solid var(--c-border); }
th { text-align: left; padding: var(--sp-2) var(--sp-3);
     font-weight: 600; color: var(--c-text); }
td { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--c-border); }
tbody tr:nth-child(even) { background: var(--c-bg-subtle); }
```

**Code block**:
```css
pre { background: var(--c-bg-muted); padding: var(--sp-4) var(--sp-5);
      overflow-x: auto; font-family: var(--font-mono);
      font-size: var(--text-sm); line-height: 1.6;
      border: 1px solid var(--c-border); border-radius: 2px; }
```

**Table of contents**:
```css
.toc { margin: var(--sp-6) 0 var(--sp-8); padding: var(--sp-4) var(--sp-5);
       border: 1px solid var(--c-border); }
.toc-title { font-size: var(--text-sm); font-weight: 600;
             letter-spacing: 0.05em; text-transform: uppercase;
             color: var(--c-text-muted); margin-bottom: var(--sp-3); }
.toc ol { list-style: none; padding-left: 0; margin: 0; }
.toc a { color: var(--c-text); text-decoration: none;
         border-bottom: 1px solid var(--c-border); }
.toc a:hover { color: var(--c-accent); border-bottom-color: var(--c-accent); }
```

### Responsive rules

- `clamp()` in the type scale handles font scaling — no media queries needed
  for font sizes.
- Tables: add `overflow-x: auto` wrapper on narrow screens.
- Content padding: `var(--sp-4)` on mobile, `var(--sp-8)` on desktop via
  one media query at `min-width: 640px`.

### HTML template skeleton

Use this as the starting point for every HTML artifact:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <style>
    /* Paste reference CSS variables above, then: */
    *, *::before, *::after { box-sizing: border-box; margin: 0; }
    body { font-family: var(--font-sans); font-size: var(--text-base);
           line-height: 1.7; color: var(--c-text); background: var(--c-bg);
           padding: var(--sp-4); }
    @media (min-width: 640px) { body { padding: var(--sp-8); } }
    article { max-width: 40em; margin-inline: auto; }
    h1 { font-size: var(--text-h1); font-weight: 700; line-height: 1.3;
         letter-spacing: -0.02em; margin-bottom: var(--sp-6); }
    h2 { font-size: var(--text-h2); font-weight: 600; line-height: 1.3;
         letter-spacing: -0.01em;
         margin-top: var(--sp-12); margin-bottom: var(--sp-4); }
    h3 { font-size: var(--text-h3); font-weight: 500; line-height: 1.4;
         margin-top: var(--sp-8); margin-bottom: var(--sp-3);
         padding-top: var(--sp-5); border-top: 2px solid var(--c-border); }
    p  { margin-bottom: var(--sp-4); }
    a  { color: var(--c-accent); }
    .summary { padding: var(--sp-5) var(--sp-6); margin-bottom: var(--sp-8);
               background: var(--c-bg-subtle); border: 1px solid var(--c-border); }
    .summary h2 { font-size: var(--text-h4); margin: 0 0 var(--sp-3); }
    .summary ul { margin: 0; padding-left: var(--sp-5); }
    .meta { font-size: var(--text-sm); color: var(--c-text-muted);
            margin-bottom: var(--sp-6); }
    /* Add callout, table, code, toc styles as needed */
  </style>
</head>
<body>
  <article>
    <header>
      <h1>{{title}}</h1>
      <p class="meta">{{date}}  .  {{category}}</p>
    </header>
    <div class="summary">
      <h2>Key points</h2>
      <ul>
        <li>{{point 1}}</li>
        <li>{{point 2}}</li>
        <li>{{point 3}}</li>
      </ul>
    </div>
    <nav class="toc"> <!-- include when 3+ sections -->
      <div class="toc-title">Contents</div>
      <ol>
        <li><a href="#s1">{{section 1}}</a></li>
        <li><a href="#s2">{{section 2}}</a></li>
      </ol>
    </nav>
    <section id="s1">
      <h2>{{section 1}}</h2>
      <p>...</p>
    </section>
  </article>
</body>
</html>
```

### Pre-publish checklist

Before calling `artifact_create`, verify:

- All elements align to the spacing system (8 px grid)
- No emoji in text or as indicators — use geometric glyphs (`>`, `.`, `*`)
- Content width is constrained (`max-width: 40em` or `66ch`)
- Summary box with key takeaways appears after H1
- Text contrast >= 4.5:1 (use the reference palette)
- No horizontal scrolling on mobile (375 px viewport)
- Dark mode does not break layout (`prefers-color-scheme: dark`)

### Sources

These guidelines are informed by the following research:

- **Scanability**: [5 Formatting Techniques for Long-Form Content](https://www.nngroup.com/articles/formatting-long-form-content/) (NN/g)
- **Type scale**: [CSS-only Fluid Modular Type Scales](https://utopia.fyi/blog/css-modular-scales/) (Utopia), [Font Size Guidelines](https://www.learnui.design/blog/mobile-desktop-website-font-size-guidelines.html) (LearnUI.design)
- **Spacing**: [8-Point Grid System](https://wpdean.com/what-is-the-8-point-grid-system/) (WP Dean), [USWDS Spacing Units](https://designsystem.digital.gov/design-tokens/spacing-units/)
- **Swiss Style**: [International Typographic Style in Web Design](https://medium.com/design-bootcamp/international-typographic-style-in-web-design-a23fddd599f5) (Bootcamp)
- **Readability**: [Optimal Line Length](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/) (UXPin), [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (W3C)
- **CJK fonts**: [Best Japanese CSS font-family](https://www.bloomstreetjapan.com/best-japanese-font-setting-for-websites/) (Bloomstreet)

## Writing style — no click-bait

Titles, summaries, headings, and prose go straight onto a human's dashboard,
where a single-screen list of artifacts has to be scannable. **Write like a
technical note, not like a YouTube thumbnail.**

Do **not** use:

- Hyperbolic adjectives — "最強", "完全", "革命的", "驚愕", "神", "ヤバい",
  "ultimate", "complete", "the only … you'll ever need".
- Teaser numerals that hide the content — "3 つの秘訣", "知らないと損する 5 選",
  "10 things X engineers don't tell you". Numbers are fine when they describe
  the structure ("3 サブシステムの結合") but not as bait.
- Cliffhangers / withheld nouns — "意外な真犯人は…", "結果はこうなった", "the
  surprising reason why…". Name the thing in the title.
- Emotive interjections / emoji as bait — "🔥", "⚡️", "！！", "ガチで",
  "本気で". Plain punctuation only.
- Second-person provocation — "あなたはまだ X してるの?", "Are you still …?",
  "Stop doing X". Describe the artifact, not the reader.
- Manufactured urgency / scarcity — "今すぐ", "限定", "緊急", "must-read".

Do:

- State the subject and the angle directly: `Stack-chan × Codex ペット会話ロボ
  — 構築知見` not `Stack-chan を AI で動かす衝撃の方法`.
- Put the most informative noun phrase first; modifiers after an em dash or
  colon. `hermes /api/ws 制御 — JSON-RPC とトークン取得手順` beats
  `hermes をハックして自由に喋らせる`.
- Make the `summary` describe what's inside, not why you should click — list
  the actual sections, tools, or conclusions.
- Prefer concrete numbers with units over vague intensifiers: "TTFT 10 秒 →
  数秒に短縮" beats "爆速化".

A good gut-check: if the title were the file name of a note in your own
repo, would you keep it? If it sounds like a tweet, rewrite it.

## Tool quick reference

| Tool              | When to use                                                                    |
|-------------------|---------------------------------------------------------------------------------|
| `artifact_create` | After finishing research / building a demo. Pick `kind` per the table above (default `html`). Always set `title` and `summary`. Tag with topical keywords. |
| `artifact_update` | When iterating on the same artifact across multiple turns. Reuse the same id.   |
| `artifact_list`   | To browse recent work, optionally filtered by `kind` or `tag`.                  |
| `artifact_get`    | To pull a known artifact's full body into your context.                         |
| `artifact_search` | First step when starting a new topic — check whether prior art already exists.  |

## id conventions

- Let the server generate the id from `title` when you have no opinion (it produces `YYYY-MM-DD-slug`).
- Pass an explicit `id` only when you intend to overwrite a known artifact.

## Source attribution

Set `source.agent = "claude-code"` and `source.session = <your session id>` on every
`artifact_create` so the human and other agents can tell who produced what.
