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

export async function deleteWorkspaceFile(workspace: string, filename: string): Promise<void> {
  await invoke("workspace_delete_file", { workspace, filename });
}

export interface WorkspaceCommand {
  action: "create" | "edit" | "delete";
  filename: string;
  content?: string;
}

/** Parses a Gemini response as a workspace file-action command, per the JSON protocol in the
 * workspace system-prompt addition. Returns null for any normal chat text (not an error). */
export function tryParseWorkspaceCommand(text: string): WorkspaceCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.filename === "string" &&
      ["create", "edit", "delete"].includes(parsed.action)
    ) {
      return parsed as WorkspaceCommand;
    }
  } catch {
    // Not JSON: treat as normal chat text.
  }
  return null;
}
