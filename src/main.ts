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
import { GeminiApiError, historyToContents, sendToGemini, stripCodeFences } from "./gemini";
import { checkForUpdates } from "./updater";
import { initTitlebar } from "./titlebar";
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  pickWorkspaceFolder,
  tryParseWorkspaceCommand,
  writeWorkspaceFile,
} from "./workspace";
import {
  AppSettings,
  AttachedFile,
  Chat,
  ChatMessage,
  DAILY_REQUEST_LIMIT,
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  PER_MINUTE_REQUEST_LIMIT,
  QuotaState,
  buildWorkspaceSystemPromptAddition,
} from "./types";

// ---- State ----
let chats: Chat[] = [];
let activeChatId: string | null = null;
let settings: AppSettings;
let apiKey: string | null = null;
let quota: QuotaState = { date: "", count: 0 };
let pendingAttachments: AttachedFile[] = [];
const requestTimestamps: number[] = [];
let cooldownTimer: ReturnType<typeof setInterval> | null = null;
let cooldownUntil = 0;
let workspaceFilesExpanded = false;

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
const cooldownNoticeEl = document.getElementById("cooldown-notice")!;
const workspacePickBtnEl = document.getElementById("workspace-pick-btn")!;
const workspacePathEl = document.getElementById("workspace-path")!;
const workspaceToggleBtnEl = document.getElementById("workspace-toggle-btn")!;
const workspaceDetachBtnEl = document.getElementById("workspace-detach-btn")!;
const workspaceFilesEl = document.getElementById("workspace-files")!;

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

function populateModelSelect() {
  modelSelectEl.innerHTML = "";
  for (const option of MODEL_OPTIONS) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    if (option.disabled) {
      el.disabled = true;
      if (option.disabledReason) el.title = option.disabledReason;
    }
    modelSelectEl.appendChild(el);
  }
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

    const bubbleHtml = msg.workspaceAction
      ? ""
      : `<div class="bubble">${renderMessageBody(msg.text || (msg.pending ? "…" : ""))}</div>`;

    let workspaceActionHtml = "";
    if (msg.workspaceAction) {
      const wa = msg.workspaceAction;
      const actionLabel = { create: "erstellt", edit: "bearbeitet", delete: "gelöscht" }[wa.action];
      workspaceActionHtml = wa.success
        ? `<div class="workspace-action-note success">Datei ${actionLabel}: ${escapeHtml(wa.filename)}</div>`
        : `<div class="workspace-action-note failed">Aktion „${wa.action}" für ${escapeHtml(wa.filename)} fehlgeschlagen: ${escapeHtml(wa.error ?? "")}</div>`;
    }

    el.innerHTML = `
      <span class="role-label">${roleLabel}</span>
      ${bubbleHtml}
      ${workspaceActionHtml}
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

  // Ältere Chats können noch ein inzwischen entferntes/deaktiviertes Modell (z. B. "gemini-2.5-flash")
  // referenzieren; auf das aktuelle Standardmodell migrieren, statt eine leere Auswahl anzuzeigen.
  if (chat && !MODEL_OPTIONS.some((o) => o.value === chat.model && !o.disabled)) {
    chat.model = DEFAULT_MODEL;
    persist();
  }
  modelSelectEl.value = chat?.model ?? DEFAULT_MODEL;

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

function renderWorkspaceBar() {
  const chat = activeChat();
  const path = chat?.workspacePath;
  workspacePathEl.textContent = path ?? "Kein Arbeitsordner verknüpft";
  workspacePathEl.classList.toggle("linked", !!path);
  workspacePathEl.title = path ?? "";
  workspaceToggleBtnEl.classList.toggle("hidden", !path);
  workspaceDetachBtnEl.classList.toggle("hidden", !path);
  workspaceToggleBtnEl.textContent = workspaceFilesExpanded ? "▴" : "▾";

  if (!path) {
    workspaceFilesEl.classList.add("hidden");
    workspaceFilesExpanded = false;
  }
}

async function renderWorkspaceFiles() {
  const chat = activeChat();
  if (!chat?.workspacePath) return;
  workspaceFilesEl.innerHTML = "Lade Dateien…";
  try {
    const files = await listWorkspaceFiles(chat.workspacePath);
    workspaceFilesEl.innerHTML = files.length
      ? files.map((f) => `<div class="workspace-file-entry">${escapeHtml(f)}</div>`).join("")
      : "<div class=\"workspace-file-entry\">(Ordner ist leer)</div>";
  } catch (err) {
    workspaceFilesEl.textContent = `Fehler beim Lesen des Ordners: ${err}`;
  }
}

async function pickWorkspace() {
  const chat = activeChat();
  if (!chat) return;
  const folder = await pickWorkspaceFolder();
  if (!folder) return;
  chat.workspacePath = folder;
  persist();
  renderWorkspaceBar();
  workspaceFilesExpanded = true;
  workspaceFilesEl.classList.remove("hidden");
  workspaceToggleBtnEl.textContent = "▴";
  await renderWorkspaceFiles();
}

function detachWorkspace() {
  const chat = activeChat();
  if (!chat) return;
  chat.workspacePath = undefined;
  persist();
  renderWorkspaceBar();
}

async function toggleWorkspaceFiles() {
  workspaceFilesExpanded = !workspaceFilesExpanded;
  workspaceFilesEl.classList.toggle("hidden", !workspaceFilesExpanded);
  workspaceToggleBtnEl.textContent = workspaceFilesExpanded ? "▴" : "▾";
  if (workspaceFilesExpanded) await renderWorkspaceFiles();
}

function selectChat(id: string) {
  activeChatId = id;
  renderChatList();
  renderMessages();
  updateHeader();
  renderWorkspaceBar();
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
  renderWorkspaceBar();
}

function createNewChat() {
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: "Neuer Chat",
    model: modelSelectEl.value || DEFAULT_MODEL,
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
  renderWorkspaceBar();
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

function isInCooldown(): boolean {
  return Date.now() < cooldownUntil;
}

function startCooldown(seconds: number) {
  cooldownUntil = Date.now() + seconds * 1000;
  sendBtnEl.disabled = true;
  cooldownNoticeEl.classList.remove("hidden");

  const tick = () => {
    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = null;
      sendBtnEl.disabled = false;
      sendBtnEl.textContent = "➤";
      cooldownNoticeEl.classList.add("hidden");
      return;
    }
    sendBtnEl.textContent = `${remaining}s`;
    cooldownNoticeEl.textContent = `Kontingent-Limit erreicht. Bitte warte ${remaining}s, bevor du erneut sendest.`;
  };

  if (cooldownTimer) clearInterval(cooldownTimer);
  tick();
  cooldownTimer = setInterval(tick, 500);
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

  if (isInCooldown()) {
    // Server-seitiges Kontingent-Limit aktiv: keine automatischen oder manuellen Wiederholungsversuche zulassen.
    return;
  }

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
    let systemPrompt = settings.systemPrompt;
    if (chat.workspacePath) {
      try {
        const files = await listWorkspaceFiles(chat.workspacePath);
        systemPrompt += buildWorkspaceSystemPromptAddition(files);
      } catch (err) {
        console.debug("Workspace-Dateiliste konnte nicht gelesen werden:", err);
      }
    }

    const contents = historyToContents(chat.messages.slice(0, -1));
    const result = await sendToGemini(apiKey, chat.model, systemPrompt, settings.safetyThreshold, contents);

    const workspaceCommand = chat.workspacePath ? tryParseWorkspaceCommand(result.text) : null;

    if (workspaceCommand && chat.workspacePath) {
      try {
        if (workspaceCommand.action === "delete") {
          await deleteWorkspaceFile(chat.workspacePath, workspaceCommand.filename);
        } else {
          await writeWorkspaceFile(chat.workspacePath, workspaceCommand.filename, workspaceCommand.content ?? "");
        }
        pendingMessage.workspaceAction = {
          action: workspaceCommand.action,
          filename: workspaceCommand.filename,
          success: true,
        };
      } catch (err) {
        pendingMessage.workspaceAction = {
          action: workspaceCommand.action,
          filename: workspaceCommand.filename,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      if (workspaceFilesExpanded) await renderWorkspaceFiles();
    } else {
      pendingMessage.text = result.text;
    }

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

    if (err instanceof GeminiApiError && err.status === 429) {
      startCooldown(err.retryAfterSeconds ?? 40);
    }
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
  populateModelSelect();

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
  renderWorkspaceBar();

  newChatBtnEl.addEventListener("click", createNewChat);
  workspacePickBtnEl.addEventListener("click", pickWorkspace);
  workspaceDetachBtnEl.addEventListener("click", detachWorkspace);
  workspaceToggleBtnEl.addEventListener("click", toggleWorkspaceFiles);
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
  initTitlebar();
}

init();
