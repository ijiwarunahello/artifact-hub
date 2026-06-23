interface ArtifactMeta {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  summary?: string;
  language?: string;
  source?: { agent?: string; session?: string };
  createdAt: string;
  updatedAt: string;
}

const brandEl = document.getElementById("brand") as HTMLAnchorElement;
const listEl = document.getElementById("list") as HTMLUListElement;
const frameEl = document.getElementById("frame") as HTMLIFrameElement;
const headerEl = document.getElementById("preview-header") as HTMLDivElement;
const emptyEl = document.getElementById("preview-empty") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const searchEl = document.getElementById("search") as HTMLInputElement;
const kindEl = document.getElementById("kind") as HTMLSelectElement;
const layoutEl = document.getElementById("layout") as HTMLElement;
const backEl = document.getElementById("back-to-list") as HTMLButtonElement;
const statsTotalEl = document.getElementById("stats-total") as HTMLSpanElement;
const statsBarsEl = document.getElementById("stats-bars") as HTMLDivElement;
const recentListEl = document.getElementById("recent-list") as HTMLUListElement;

let all: ArtifactMeta[] = [];
let selectedId: string | null = null;
let query = "";
let kindFilter = "";
let mobileView: "list" | "preview" = "list";

async function loadList() {
  const res = await fetch("/api/artifacts");
  const data = await res.json();
  all = data.items;
  render();
  renderTopContent();
}

function selectFromUrl() {
  const id = new URLSearchParams(location.search).get("id");
  if (id) select(id, { updateUrl: false });
  else setMobileView("list", { updateUrl: false });
}

function render() {
  const q = query.trim().toLowerCase();
  const filtered = all.filter((m) => {
    if (kindFilter && m.kind !== kindFilter) return false;
    if (!q) return true;
    const hay = `${m.title} ${m.summary ?? ""} ${m.tags.join(" ")} ${m.id}`.toLowerCase();
    return hay.includes(q);
  });
  listEl.innerHTML = "";
  for (const m of filtered) {
    const li = document.createElement("li");
    li.dataset.id = m.id;
    if (m.id === selectedId) li.classList.add("active");
    li.innerHTML = `
      <div class="title"><span class="kind">${m.kind}</span><span>${escapeHtml(m.title)}</span></div>
      <div class="meta">${m.id} · ${relTime(m.updatedAt)}${m.source?.agent ? ` · ${escapeHtml(m.source.agent)}` : ""}</div>
      ${m.summary ? `<div class="summary">${escapeHtml(m.summary)}</div>` : ""}
    `;
    li.addEventListener("click", () => select(m.id));
    listEl.appendChild(li);
  }
}

function select(id: string, opts: { updateUrl?: boolean } = {}) {
  selectedId = id;
  setMobileView("preview", { updateUrl: false });
  for (const li of listEl.querySelectorAll("li")) {
    li.classList.toggle("active", (li as HTMLLIElement).dataset.id === id);
  }
  const meta = all.find((m) => m.id === id);
  headerEl.innerHTML = meta ? renderHeader(meta) : "";
  emptyEl.hidden = true;
  frameEl.hidden = false;
  frameEl.src = `/render/${encodeURIComponent(id)}?t=${Date.now()}`;
  if (opts.updateUrl !== false) replaceUrlId(id);
}

function renderHeader(meta: ArtifactMeta): string {
  const tools = detectTools(meta);
  const toolLinks = tools
    .map(
      (t) =>
        `<a class="tool-link" href="/t/${t.name}?artifact=${encodeURIComponent(meta.id)}" target="_blank" rel="noopener">${escapeHtml(t.label)}</a>`,
    )
    .join(" ");
  return `<span><strong>${escapeHtml(meta.title)}</strong> <span class="tags">${escapeHtml(meta.id)}</span>${toolLinks ? " " + toolLinks : ""}</span>
     <span class="tags">${meta.tags.map(escapeHtml).join(" · ")}</span>`;
}

function detectTools(meta: ArtifactMeta): { name: string; label: string }[] {
  const tools: { name: string; label: string }[] = [];
  if (
    meta.kind === "code" &&
    (meta.language ?? "").toLowerCase() === "stl"
  ) {
    tools.push({ name: "stl", label: "open in stl preview" });
  }
  return tools;
}

function setMobileView(view: "list" | "preview", opts: { updateUrl?: boolean } = {}) {
  mobileView = view;
  layoutEl.classList.toggle("mobile-list", mobileView === "list");
  layoutEl.classList.toggle("mobile-preview", mobileView === "preview");
  if (view === "list" && opts.updateUrl !== false) replaceUrlId(null);
}

function replaceUrlId(id: string | null) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("id", id);
  else url.searchParams.delete("id");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => {
    statusEl.textContent = "live";
    statusEl.classList.add("live");
  };
  ws.onclose = () => {
    statusEl.textContent = "reconnecting…";
    statusEl.classList.remove("live");
    setTimeout(connectWs, 1500);
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "created" || msg.type === "updated") {
        upsert(msg.meta);
        if (msg.type === "updated" && msg.meta.id === selectedId) {
          select(msg.meta.id);
        }
      }
    } catch {}
  };
}

function upsert(meta: ArtifactMeta) {
  const idx = all.findIndex((m) => m.id === meta.id);
  if (idx >= 0) all[idx] = meta;
  else all.unshift(meta);
  all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  render();
  renderTopContent();
}

function renderTopContent() {
  statsTotalEl.textContent = String(all.length);

  const counts = new Map<string, number>();
  for (const m of all) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  statsBarsEl.innerHTML = sorted
    .map(
      ([kind, count]) =>
        `<div class="stats-row">
          <span class="kind">${escapeHtml(kind)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
          <span class="count">${count}</span>
        </div>`,
    )
    .join("");

  const recent = all.slice(0, 5);
  if (recent.length === 0) {
    recentListEl.innerHTML = '<li class="recent-empty">no artifacts yet</li>';
    return;
  }
  recentListEl.innerHTML = recent
    .map(
      (m) =>
        `<li>
          <a data-id="${escapeHtml(m.id)}">
            <span class="kind-badge">${escapeHtml(m.kind)}</span>
            <span class="title-text">${escapeHtml(m.title)}</span>
          </a>
          <span class="time">${relTime(m.updatedAt)}</span>
        </li>`,
    )
    .join("");

  for (const a of recentListEl.querySelectorAll("a[data-id]")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      select((a as HTMLAnchorElement).dataset.id!);
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

searchEl.addEventListener("input", () => {
  query = searchEl.value;
  render();
});
kindEl.addEventListener("change", () => {
  kindFilter = kindEl.value;
  render();
});
backEl.addEventListener("click", () => {
  setMobileView("list");
});
brandEl.addEventListener("click", (e) => {
  e.preventDefault();
  deselect();
});

function deselect() {
  selectedId = null;
  for (const li of listEl.querySelectorAll("li")) li.classList.remove("active");
  headerEl.innerHTML = "";
  emptyEl.hidden = false;
  frameEl.hidden = true;
  frameEl.src = "";
  replaceUrlId(null);
  setMobileView("list", { updateUrl: false });
}
window.addEventListener("popstate", selectFromUrl);

loadList().then(selectFromUrl);
connectWs();
