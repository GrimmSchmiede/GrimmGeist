import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import {
  AppSettings,
  Chat,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_SYSTEM_PROMPT,
  Language,
  QuotaState,
  SecuritySettings,
} from "./types";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load("novatree.json");
  }
  return storePromise;
}

export async function loadSettings(): Promise<AppSettings> {
  const store = await getStore();
  const systemPrompt = (await store.get<string>("systemPrompt")) ?? DEFAULT_SYSTEM_PROMPT;
  const safetyThreshold = (await store.get<string>("safetyThreshold")) ?? "BLOCK_MEDIUM_AND_ABOVE";
  const language = (await store.get<Language>("language")) ?? "de";
  const storedSecurity = await store.get<SecuritySettings>("security");
  const security: SecuritySettings = storedSecurity
    ? { ...DEFAULT_SECURITY_SETTINGS, ...storedSecurity, requireApprovalFor: { ...DEFAULT_SECURITY_SETTINGS.requireApprovalFor, ...storedSecurity.requireApprovalFor } }
    : DEFAULT_SECURITY_SETTINGS;
  return { systemPrompt, safetyThreshold, language, security };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set("systemPrompt", settings.systemPrompt);
  await store.set("safetyThreshold", settings.safetyThreshold);
  await store.set("language", settings.language);
  await store.set("security", settings.security);
  await store.save();
}

export async function loadChats(): Promise<Chat[]> {
  const store = await getStore();
  return (await store.get<Chat[]>("chats")) ?? [];
}

export async function saveChats(chats: Chat[]): Promise<void> {
  const store = await getStore();
  await store.set("chats", chats);
  await store.save();
}

export async function loadQuota(): Promise<QuotaState> {
  const store = await getStore();
  return (await store.get<QuotaState>("quota")) ?? { date: "", count: 0 };
}

export async function saveQuota(quota: QuotaState): Promise<void> {
  const store = await getStore();
  await store.set("quota", quota);
  await store.save();
}

export async function loadApiKey(): Promise<string | null> {
  return await invoke<string | null>("load_api_key");
}

export async function saveApiKey(key: string): Promise<void> {
  await invoke("save_api_key", { key });
}

export async function loadWorkspaceDisclaimerAccepted(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>("workspaceDisclaimerAccepted")) ?? false;
}

export async function saveWorkspaceDisclaimerAccepted(): Promise<void> {
  const store = await getStore();
  await store.set("workspaceDisclaimerAccepted", true);
  await store.save();
}

export async function loadLastSeenVersion(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>("lastSeenVersion")) ?? null;
}

export async function saveLastSeenVersion(version: string): Promise<void> {
  const store = await getStore();
  await store.set("lastSeenVersion", version);
  await store.save();
}
