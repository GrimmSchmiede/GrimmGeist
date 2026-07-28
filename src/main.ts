import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  loadSettings,
  saveSettings,
  loadChats,
  saveChats,
  loadQuota,
  saveQuota,
  loadApiKey,
  saveApiKey,
} from "./storage";
import { historyToContents, sendToGemini, stripCodeFences } from "./gemini";
import { checkForUpdates } from "./updater";
import {
  AppSettings,
  AttachedFile,
  Chat,
  ChatMessage,
  DAILY_REQUEST_LIMIT,
  PER_MINUTE_REQUEST_LIMIT,
  QuotaState,
} from "./types";

// ---- State ----
let chats: Chat[] = [];
let activeChatId: string | null = null;
let settings: AppSettings;
let apiKey: string | null = null;
let quota: QuotaState = { date: "", count: 0 };
let pendingAttachments: AttachedFile[] = [];
const requestTimestamps: number[] = [];

// ---- DOM ----
const chatListEl = document.getElementById("chat-list")!;
const messagesEl = document.getElementById("messages")!;
const modelSelectEl = document.getElementById("model-select") as HTMLSelectElement;
const tokenUsageEl = document.getElementById("token-usage")!;
const quotaUsageEl = document.getElementById("quota-usage")!;
const attachmentsEl = document.getElementById("attachments")!;
const promptInputEl = document.getElementById("prompt-input") as HTMLTextAreaElement;
const sendBtnEl = document.getElementById("send-btn") as HTMLButtonElement;
const attachBtnEl = document.getElementById("attach-btn")!;
const newChatBtnEl = document.getElementById("new-chat-btn")!;

const settingsModalEl = document.getElementById("settings-modal")!;
const settingsBtnEl = document.getElementById("settings-btn")!;
const settingsCloseEl = document.getElementById("settings-close")!;
const settingsSaveEl = document.getElementById("settings-save")!;
const apiKeyInputEl = document.getElementById("api-key-input") as HTMLInputElement;
const systemPromptInputEl = document.getElementById("system-prompt-input") as HTMLTextAreaElement;
const safetySelectEl = document.getElementById("safety-select") as HTMLSelectElement;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMessageBody(text: string): string {
  const parts = text.split(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g);
  // String.split with capture groups returns [plain, lang, code, plain, lang, code, ..., plain]
  let html = "";
  for (let i = 0; i < parts.length; i += 3) {
    html += escapeHtml(parts[i] ?? "");
    const code = parts[i + 2];
    if (code !== undefined) {
      html += `<pre>${escapeHtml(code)}</pre>`;
    }
  }
  return html;
}

function activeChat(): Chat | null {
  return chats.find((c) => c.id === activeChatId) ?? null;
}

function persist() {
  saveChats(chats);
}

function renderChatList() {
  chatListEl.innerHTML = "";
  for (const chat of [...chats].sort((a, b) => b.createdAt - a.createdAt)) {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (chat.id === activeChatId ? " active" : "");
    item.innerHTML = `<span class="chat-title">${escapeHtml(chat.title)}</span><button class="delete-chat" title="Löschen">✕</button>`;
    item.querySelector(".chat-title")!.addEventListener("click", () => selectChat(chat.id));
    item.querySelector(".delete-chat")!.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    chatListEl.appendChild(item);
  }
}

function renderMessages() {
  const chat = activeChat();
  messagesEl.innerHTML = "";
  if (!chat) return;

  chat.messages.forEach((msg, idx) => {
    const el = document.createElement("div");
    el.className = `message ${msg.role}` + (msg.pending ? " pending" : "") + (msg.error ? " error" : "");

    const roleLabel = msg.role === "user" ? "Du" : "NovaTwin";
    let filesHtml = "";
    if (msg.files && msg.files.length) {
      filesHtml = `<div class="file-actions">${msg.files
        .map((f) => `<span class="file-tag">📎 ${escapeHtml(f.name)}</span>`)
        .join("")}</div>`;
    }

    el.innerHTML = `
      <span class="role-label">${roleLabel}</span>
      <div class="bubble">${renderMessageBody(msg.text || (msg.pending ? "…" : ""))}</div>
      ${filesHtml}
    `;

    // Offer "Datei aktualisieren" for model responses that follow a user message with attachments
    if (msg.role === "model" && !msg.pending && !msg.error) {
      const prevUser = chat.messages[idx - 1];
      if (prevUser && prevUser.role === "user" && prevUser.files && prevUser.files.length) {
        const actions = document.createElement("div");
        actions.className = "file-actions";
        for (const file of prevUser.files) {
          const btn = document.createElement("button");
          btn.className = "update-file-btn";
          btn.textContent = `Datei aktualisieren: ${file.name}`;
          btn.addEventListener("click", async () => {
            try {
              const newContent = stripCodeFences(msg.text);
              await invoke("write_text_file", { path: file.path, content: newContent });
              btn.textContent = `Aktualisiert: ${file.name}`;
              btn.classList.add("done");
            } catch (err) {
              alert(`Fehler beim Schreiben der Datei: ${err}`);
            }
          });
          actions.appendChild(btn);
        }
        el.appendChild(actions);
      }
    }

    messagesEl.appendChild(el);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateHeader() {
  const chat = activeChat();
  tokenUsageEl.textContent = `Tokens: ${chat?.totalTokens ?? 0}`;
  modelSelectEl.value = chat?.model ?? "gemini-2.5-flash";

  const nearLimit = quota.count >= DAILY_REQUEST_LIMIT * 0.9;
  quotaUsageEl.textContent = `Anfragen heute: ${quota.count} / ${DAILY_REQUEST_LIMIT}`;
  quotaUsageEl.classList.toggle("warn", nearLimit);
}

function renderAttachments() {
  attachmentsEl.innerHTML = "";
  pendingAttachments.forEach((file, idx) => {
    const badge = document.createElement("div");
    badge.className = "attachment-badge";
    badge.innerHTML = `<span>📎 ${escapeHtml(file.name)}</span><button title="Entfernen">✕</button>`;
    badge.querySelector("button")!.addEventListener("click", () => {
      pendingAttachments.splice(idx, 1);
      renderAttachments();
    });
    attachmentsEl.appendChild(badge);
  });
}

function selectChat(id: string) {
  activeChatId = id;
  renderChatList();
  renderMessages();
  updateHeader();
}

function deleteChat(id: string) {
  chats = chats.filter((c) => c.id !== id);
  if (activeChatId === id) {
    activeChatId = chats[0]?.id ?? null;
    if (!activeChatId) createNewChat();
  }
  persist();
  renderChatList();
  renderMessages();
  updateHeader();
}

function createNewChat() {
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: "Neuer Chat",
    model: modelSelectEl.value || "gemini-2.5-flash",
    messages: [],
    createdAt: Date.now(),
    totalTokens: 0,
  };
  chats.push(chat);
  activeChatId = chat.id;
  persist();
  renderChatList();
  renderMessages();
  updateHeader();
}

async function attachFiles() {
  const selected = await open({ multiple: true, title: "Datei anhängen" });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const path of paths) {
    try {
      const result = await invoke<{ path: string; name: string; content: string }>(
        "read_text_file",
        { path }
      );
      pendingAttachments.push(result);
    } catch (err) {
      alert(`Datei konnte nicht gelesen werden: ${err}`);
    }
  }
  renderAttachments();
}

function withinRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length < PER_MINUTE_REQUEST_LIMIT;
}

async function sendMessage() {
  const text = promptInputEl.value.trim();
  if (!text && pendingAttachments.length === 0) return;

  if (!apiKey) {
    alert("Bitte zuerst einen Google AI Studio API-Schlüssel in den Einstellungen hinterlegen.");
    openSettings();
    return;
  }

  if (quota.date === todayStr() && quota.count >= DAILY_REQUEST_LIMIT) {
    alert("Tageslimit von 1000 Anfragen erreicht. Bitte morgen erneut versuchen.");
    return;
  }

  if (!withinRateLimit()) {
    alert("Rate-Limit erreicht: maximal 15 Anfragen pro Minute. Bitte kurz warten.");
    return;
  }

  const chat = activeChat();
  if (!chat) return;

  const userMessage: ChatMessage = {
    role: "user",
    text,
    files: pendingAttachments.length ? [...pendingAttachments] : undefined,
  };
  chat.messages.push(userMessage);

  if (chat.title === "Neuer Chat" && text) {
    chat.title = text.slice(0, 40);
  }

  const pendingMessage: ChatMessage = { role: "model", text: "", pending: true };
  chat.messages.push(pendingMessage);

  pendingAttachments = [];
  promptInputEl.value = "";
  autoGrowTextarea();
  renderAttachments();
  renderChatList();
  renderMessages();

  requestTimestamps.push(Date.now());

  try {
    const contents = historyToContents(chat.messages.slice(0, -1));
    const result = await sendToGemini(apiKey, chat.model, settings.systemPrompt, settings.safetyThreshold, contents);

    pendingMessage.text = result.text;
    pendingMessage.pending = false;
    pendingMessage.usage = {
      promptTokens: result.promptTokens,
      candidatesTokens: result.candidatesTokens,
    };
    chat.totalTokens += result.promptTokens + result.candidatesTokens;

    if (quota.date !== todayStr()) {
      quota = { date: todayStr(), count: 0 };
    }
    quota.count += 1;
    await saveQuota(quota);
  } catch (err) {
    pendingMessage.pending = false;
    pendingMessage.error = true;
    pendingMessage.text = `Fehler: ${err instanceof Error ? err.message : err}`;
  }

  persist();
  renderMessages();
  updateHeader();
}

function autoGrowTextarea() {
  promptInputEl.style.height = "auto";
  promptInputEl.style.height = `${Math.min(promptInputEl.scrollHeight, 200)}px`;
}

// ---- Settings modal ----
function openSettings() {
  apiKeyInputEl.value = apiKey ?? "";
  systemPromptInputEl.value = settings.systemPrompt;
  safetySelectEl.value = settings.safetyThreshold;
  settingsModalEl.classList.remove("hidden");
}

function closeSettings() {
  settingsModalEl.classList.add("hidden");
}

async function saveSettingsFromModal() {
  const newKey = apiKeyInputEl.value.trim();
  if (newKey !== (apiKey ?? "")) {
    await saveApiKey(newKey);
    apiKey = newKey || null;
  }
  settings = {
    systemPrompt: systemPromptInputEl.value,
    safetyThreshold: safetySelectEl.value,
  };
  await saveSettings(settings);
  closeSettings();
}

// ---- Init ----
async function init() {
  settings = await loadSettings();
  apiKey = await loadApiKey();
  chats = await loadChats();
  quota = await loadQuota();
  if (quota.date !== todayStr()) {
    quota = { date: todayStr(), count: 0 };
  }

  if (chats.length === 0) {
    createNewChat();
  } else {
    activeChatId = [...chats].sort((a, b) => b.createdAt - a.createdAt)[0].id;
  }

  renderChatList();
  renderMessages();
  updateHeader();

  newChatBtnEl.addEventListener("click", createNewChat);
  attachBtnEl.addEventListener("click", attachFiles);
  sendBtnEl.addEventListener("click", sendMessage);
  promptInputEl.addEventListener("input", autoGrowTextarea);
  promptInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  modelSelectEl.addEventListener("change", () => {
    const chat = activeChat();
    if (chat) {
      chat.model = modelSelectEl.value;
      persist();
    }
  });

  settingsBtnEl.addEventListener("click", openSettings);
  settingsCloseEl.addEventListener("click", closeSettings);
  settingsSaveEl.addEventListener("click", saveSettingsFromModal);
  settingsModalEl.addEventListener("click", (e) => {
    if (e.target === settingsModalEl) closeSettings();
  });

  checkForUpdates();
}

init();
