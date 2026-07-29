import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({ directory: true, title: "Arbeitsordner wählen" });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function listWorkspaceFiles(workspace: string): Promise<string[]> {
  return await invoke<string[]>("list_workspace_files", { workspace });
}

export async function writeWorkspaceFile(
  workspace: string,
  filename: string,
  content: string
): Promise<string> {
  return await invoke<string>("workspace_write_file", { workspace, filename, content });
}

export async function readWorkspaceFile(workspace: string, filename: string): Promise<string> {
  return await invoke<string>("workspace_read_file", { workspace, filename });
}

export async function deleteWorkspaceFile(workspace: string, filename: string): Promise<void> {
  await invoke("workspace_delete_file", { workspace, filename });
}

export interface WorkspaceCommand {
  action: "create" | "edit" | "delete";
  filename: string;
  content?: string;
}

function isWorkspaceCommand(value: unknown): value is WorkspaceCommand {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).filename === "string" &&
    ["create", "edit", "delete"].includes((value as Record<string, unknown>).action as string)
  );
}

export interface WorkspaceResponse {
  reply: string;
  actions: WorkspaceCommand[];
}

/** Parses a workspace-mode Gemini response into its chat reply and file actions. The API is
 * asked for Structured Output matching WORKSPACE_RESPONSE_SCHEMA (see gemini.ts), so `text` here
 * is expected to always be valid JSON of the form {"reply": string, "actions": [...]}; this still
 * degrades gracefully (whole text becomes the reply) if that's ever not the case. */
export function parseWorkspaceResponse(text: string): WorkspaceResponse {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === "object") {
      const reply = typeof (parsed as Record<string, unknown>).reply === "string" ? (parsed as { reply: string }).reply : "";
      const actionsRaw = (parsed as Record<string, unknown>).actions;
      const actions = Array.isArray(actionsRaw) ? actionsRaw.filter(isWorkspaceCommand) : [];
      if (reply || actions.length) return { reply, actions };
    }
  } catch {
    // Not JSON (shouldn't happen with Structured Output, but degrade gracefully).
  }
  return { reply: text, actions: [] };
}
