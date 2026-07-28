import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import { AppSettings, Chat, DEFAULT_SYSTEM_PROMPT, QuotaState } from "./types";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load("novatwin.json");
  }
  return storePromise;
}

export async function loadSettings(): Promise<AppSettings> {
  const store = await getStore();
  const systemPrompt = (await store.get<string>("systemPrompt")) ?? DEFAULT_SYSTEM_PROMPT;
  const safetyThreshold = (await store.get<string>("safetyThreshold")) ?? "BLOCK_MEDIUM_AND_ABOVE";
  return { systemPrompt, safetyThreshold };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  await store.set("systemPrompt", settings.systemPrompt);
  await store.set("safetyThreshold", settings.safetyThreshold);
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
