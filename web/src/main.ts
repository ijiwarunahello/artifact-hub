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

const listEl = document.getElementById("list") as HTMLUListElement;
const frameEl = document.getElementById("frame") as HTMLIFrameElement;
const headerEl = document.getElementById("preview-header") as HTMLDivElement;
const emptyEl = document.getElementById("preview-empty") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const searchEl = document.getElementById("search") as HTMLInputElement;
const kindEl = document.getElementById("kind") as HTMLSelectElement;
const layoutEl = document.getElementById("layout") as HTMLElement;
const backEl = document.getElementById("back-to-list") as HTMLButtonElement;

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
  headerEl.innerHTML = meta
    ? `<span><strong>${escapeHtml(meta.title)}</strong> <span class="tags">${escapeHtml(meta.id)}</span></span>
       <span class="tags">${meta.tags.map(escapeHtml).join(" · ")}</span>`
    : "";
  emptyEl.hidden = true;
  frameEl.hidden = false;
  frameEl.src = `/render/${encodeURIComponent(id)}?t=${Date.now()}`;
  if (opts.updateUrl !== false) replaceUrlId(id);
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
window.addEventListener("popstate", selectFromUrl);

loadList().then(selectFromUrl);
connectWs();
