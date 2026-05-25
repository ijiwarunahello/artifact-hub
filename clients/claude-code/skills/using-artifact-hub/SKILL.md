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
