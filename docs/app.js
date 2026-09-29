const MODELS = [
  { id: "grok-4-fast-reasoning", label: "Grok 4 Fast" },
  { id: "grok-4-fast-non-reasoning", label: "Grok 4 Fast (instant)" },
  { id: "grok-4.6", label: "Grok 4.6" },
  { id: "grok-4.7", label: "Grok 4.7" },
  { id: "grok-4", label: "Grok 4" },
  { id: "grok-3-mini", label: "Grok 3 Mini" }
];
const STARTERS = [
  "Explain the NBA 2026-27 title picture in plain English",
  "Write a hype caption for a midnight Lakers game",
  "What should I know about Grok 4.7?",
  "Plan a 3-day Seattle itinerary on a budget"
];
const STORE_KEY = "grok-web-state-v1";

const state = loadState();
let deferredPrompt = null;
let abortCtl = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    apiKey: "",
    model: MODELS[0].id,
    chats: [{ id: uid(), title: "New chat", messages: [], createdAt: Date.now() }],
    activeId: null
  };
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function activeChat() {
  return state.chats.find((c) => c.id === state.activeId) || state.chats[0];
}
if (!state.activeId) state.activeId = state.chats[0].id;

const $ = (id) => document.getElementById(id);
const modelSelect = $("model");
const defaultModel = $("default-model");
MODELS.forEach((m) => {
  modelSelect.insertAdjacentHTML("beforeend", `<option value="${m.id}">${m.label}</option>`);
  defaultModel.insertAdjacentHTML("beforeend", `<option value="${m.id}">${m.label}</option>`);
});
modelSelect.value = state.model;
defaultModel.value = state.model;
$("api-key").value = state.apiKey || "";

function sidebarHTML() {
  const chats = state.chats.map((c) => `<button class="chat-item ${c.id === state.activeId ? "active" : ""}" data-open="${c.id}"><span>${escapeHtml(c.title || "New chat")}</span><span class="del" data-del="${c.id}" title="Delete">x</span></button>`).join("");
  return `<div class="brand"><div class="logo">${starSvg(16)}</div><div><h1>Grok Web</h1><small>Installable chat app</small></div></div><button class="new-chat" data-new>+ New chat</button><div class="chat-list">${chats}</div><div class="install-banner"><span>Add Grok to your home screen</span><button data-install>Install</button></div><div class="side-foot"><button class="ghost" data-settings><span class="dot ${state.apiKey ? "on" : ""}"></span>${state.apiKey ? "API key connected" : "Connect API key"}</button></div>`;
}

function renderSidebars() {
  $("desktop-sidebar").innerHTML = sidebarHTML();
  $("drawer").innerHTML = sidebarHTML();
  bindSide($("desktop-sidebar"));
  bindSide($("drawer"));
  document.querySelectorAll(".install-banner").forEach((el) => el.classList.toggle("show", !!deferredPrompt));
}

function bindSide(root) {
  root.querySelector("[data-new]")?.addEventListener("click", newChat);
  root.querySelector("[data-settings]")?.addEventListener("click", openSettings);
  root.querySelector("[data-install]")?.addEventListener("click", installApp);
  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.dataset.del) return;
      state.activeId = btn.dataset.open;
      saveState();
      closeDrawer();
      render();
    });
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      state.chats = state.chats.filter((c) => c.id !== id);
      if (!state.chats.length) state.chats.push({ id: uid(), title: "New chat", messages: [], createdAt: Date.now() });
      if (state.activeId === id) state.activeId = state.chats[0].id;
      saveState();
      render();
    });
  });
}

function renderStage() {
  const chat = activeChat();
  const stage = $("stage");
  if (!chat.messages.length) {
    stage.innerHTML = `<div class="hero"><div class="hero-mark">${starSvg(28)}</div><h2>What do you want to know?</h2><p>A public Grok chat you can open in the browser or install like an app. Connect an xAI key once, then talk from any device you save it on.</p><div class="chips">${STARTERS.map((s) => `<button class="chip" data-fill="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div></div>`;
    stage.querySelectorAll("[data-fill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("input").value = btn.dataset.fill;
        $("input").focus();
      });
    });
    return;
  }
  stage.innerHTML = `<div class="thread">${chat.messages.map(messageHTML).join("")}</div>`;
  stage.scrollTop = stage.scrollHeight;
}

function messageHTML(m) {
  const who = m.role === "user" ? "You" : "Grok";
  const body = m.role === "assistant" ? renderMarkdown(m.content || "") : escapeHtml(m.content || "");
  const streaming = m.streaming ? " cursor" : "";
  const err = m.error ? `<div class="err">${escapeHtml(m.error)}</div>` : "";
  return `<div class="msg"><div class="avatar ${m.role}">${m.role === "user" ? "N" : starSvg(14)}</div><div class="bubble"><div class="who">${who}</div><div class="content${streaming}">${body}</div>${err}</div></div>`;
}

function render() {
  modelSelect.value = state.model;
  renderSidebars();
  renderStage();
}

function newChat() {
  const chat = { id: uid(), title: "New chat", messages: [], createdAt: Date.now() };
  state.chats.unshift(chat);
  state.activeId = chat.id;
  saveState();
  closeDrawer();
  render();
  $("input").focus();
}
function openSettings() {
  $("settings").classList.add("show");
  $("overlay").classList.add("show");
  closeDrawer();
}
function closeModal() {
  $("settings").classList.remove("show");
  $("overlay").classList.remove("show");
}
function openDrawer() {
  $("drawer").classList.add("open");
  $("overlay").classList.add("show");
}
function closeDrawer() {
  $("drawer").classList.remove("open");
  if (!$("settings").classList.contains("show")) $("overlay").classList.remove("show");
}

$("menu-btn").addEventListener("click", openDrawer);
$("new-mobile").addEventListener("click", newChat);
$("overlay").addEventListener("click", () => { closeDrawer(); closeModal(); });
$("save-settings").addEventListener("click", () => {
  state.apiKey = $("api-key").value.trim();
  state.model = $("default-model").value;
  saveState();
  closeModal();
  render();
});
modelSelect.addEventListener("change", () => {
  state.model = modelSelect.value;
  saveState();
});

const input = $("input");
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("form").requestSubmit();
  }
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  if (!state.apiKey) { openSettings(); return; }
  const chat = activeChat();
  if (chat.title === "New chat") chat.title = text.slice(0, 42);
  chat.messages.push({ role: "user", content: text });
  const assistant = { role: "assistant", content: "", streaming: true };
  chat.messages.push(assistant);
  input.value = "";
  input.style.height = "auto";
  saveState();
  render();
  await streamReply(chat, assistant);
});

async function streamReply(chat, assistant) {
  abortCtl?.abort();
  abortCtl = new AbortController();
  const payload = {
    model: state.model,
    stream: true,
    messages: [
      { role: "system", content: "You are Grok, xAI's helpful, witty assistant. Be clear and useful. Keep answers tight unless the user wants depth." },
      ...chat.messages.filter((m) => !m.streaming && !m.error).map((m) => ({ role: m.role, content: m.content }))
    ]
  };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.apiKey },
      body: JSON.stringify(payload),
      signal: abortCtl.signal
    });
    if (!res.ok) throw new Error(prettyError(res.status, await res.text()));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || "";
          if (token) { assistant.content += token; renderStage(); }
        } catch (e) {}
      }
    }
    if (!assistant.content) assistant.content = "No response came back from that model. Try Grok 4 Fast.";
  } catch (err) {
    if (err.name !== "AbortError") assistant.error = err.message || String(err);
  } finally {
    assistant.streaming = false;
    saveState();
    render();
  }
}

function prettyError(status, body) {
  if (status === 401 || status === 403) return "That API key was rejected. Check it in console.x.ai and paste it again.";
  if (status === 429) return "xAI rate-limited this key. Wait a moment and try again.";
  try {
    const j = JSON.parse(body);
    return j.error?.message || j.error || body.slice(0, 180);
  } catch (e) {
    return body.slice(0, 180) || "Request failed (" + status + ")";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}
function renderMarkdown(text) {
  const escaped = escapeHtml(text);
  const withCode = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  return withCode.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "</p><p>").replace(/^(.*)$/s, "<p>$1</p>");
}
function starSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 7.3L21 11l-7.3 1.7L12 20l-1.7-7.3L3 11l7.3-1.7z"/></svg>`;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  renderSidebars();
});
async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  renderSidebars();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");

render();
if (!state.apiKey) setTimeout(openSettings, 400);
