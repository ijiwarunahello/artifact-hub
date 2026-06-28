import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import type { Artifact } from "../types/artifact.js";
import { HLJS_LIGHT, HLJS_DARK } from "./render-css.generated.js";

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        // fall through
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
  },
});

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
  const token = tokens[idx];
  if (token) {
    const info = token.info ? token.info.trim() : "";
    if (info === "mermaid") {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>\n`;
    }
  }
  return defaultFence
    ? defaultFence(tokens, idx, options, env, slf)
    : slf.renderToken(tokens, idx, options);
};

const MERMAID_LOADER = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default" });
</script>`;

const CSP_MARKDOWN_WITH_MERMAID = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "frame-ancestors 'self'",
  "connect-src https://cdn.jsdelivr.net",
].join("; ");

const BASE_STYLE = `
:root { color-scheme: light dark; }
body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; margin: 0; padding: 24px; line-height: 1.6; color: #111; background: #fff; }
@media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
pre.hljs { padding: 12px; border-radius: 6px; overflow: auto; background: #f6f8fa; font-size: 13px; line-height: 1.5; }
@media (prefers-color-scheme: dark) { pre.hljs { background: #0d1117; } }
code:not(pre code) { background: #f6f8fa; padding: 1px 5px; border-radius: 3px; font-size: 0.92em; }
@media (prefers-color-scheme: dark) { code:not(pre code) { background: #161b22; } }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 6px 10px; }
@media (prefers-color-scheme: dark) { th, td { border-color: #333; } }
img, svg { max-width: 100%; }
${HLJS_LIGHT}
@media (prefers-color-scheme: dark) {
${HLJS_DARK}
}
`;

const COMMON_CSP_NO_SCRIPT = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
].join("; ");

const HTML_CSP_WITH_SCRIPT = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "frame-ancestors 'self'",
].join("; ");

export interface RenderResult {
  html: string;
  csp: string;
  sandbox?: string;
}

export function renderArtifact(artifact: Artifact): RenderResult {
  switch (artifact.kind) {
    case "html":
      return renderHtml(artifact);
    case "markdown":
      return renderMarkdown(artifact);
    case "svg":
      return renderSvg(artifact);
    case "mermaid":
      return renderMermaid(artifact);
    case "code":
      return renderCode(artifact);
    default:
      return renderText(artifact.content);
  }
}

function renderHtml(artifact: Artifact): RenderResult {
  return {
    html: artifact.content,
    csp: HTML_CSP_WITH_SCRIPT,
    sandbox: "allow-scripts allow-same-origin",
  };
}

function renderMarkdown(artifact: Artifact): RenderResult {
  const body = md.render(artifact.content);
  const hasMermaid = body.includes('<div class="mermaid">');
  if (!hasMermaid) {
    return {
      html: shell(artifact.title, body),
      csp: COMMON_CSP_NO_SCRIPT,
      sandbox: "",
    };
  }
  return {
    html: shell(artifact.title, body + "\n" + MERMAID_LOADER),
    csp: CSP_MARKDOWN_WITH_MERMAID,
    sandbox: "allow-scripts",
  };
}

function renderSvg(artifact: Artifact): RenderResult {
  const safe = stripScript(artifact.content);
  const body = `<div class="svg-wrap">${safe}</div>`;
  return {
    html: shell(artifact.title, body),
    csp: COMMON_CSP_NO_SCRIPT,
    sandbox: "",
  };
}

function renderMermaid(artifact: Artifact): RenderResult {
  const escaped = escapeHtml(artifact.content);
  const body = `<div class="mermaid">${escaped}</div>
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default" });
</script>`;
  return {
    html: shell(artifact.title, body, { allowCdn: true }),
    csp: [
      "default-src 'none'",
      "script-src 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "frame-ancestors 'self'",
      "connect-src https://cdn.jsdelivr.net",
    ].join("; "),
    sandbox: "allow-scripts",
  };
}

function renderCode(artifact: Artifact): RenderResult {
  const lang = artifact.language ?? "";
  let body: string;
  if (lang && hljs.getLanguage(lang)) {
    body = `<pre class="hljs"><code>${hljs.highlight(artifact.content, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
  } else {
    body = `<pre class="hljs"><code>${escapeHtml(artifact.content)}</code></pre>`;
  }
  return {
    html: shell(artifact.title, body),
    csp: COMMON_CSP_NO_SCRIPT,
    sandbox: "",
  };
}

function renderText(content: string): RenderResult {
  return {
    html: shell("text", `<pre>${escapeHtml(content)}</pre>`),
    csp: COMMON_CSP_NO_SCRIPT,
    sandbox: "",
  };
}

function shell(title: string, body: string, opts: { allowCdn?: boolean } = {}): string {
  const cspMeta = opts.allowCdn ? "" : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
${cspMeta}<style>${BASE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripScript(svg: string): string {
  return svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
}
