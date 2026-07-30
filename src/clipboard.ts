import { readText } from "@tauri-apps/plugin-clipboard-manager";

// Google AI Studio keys start with "AIzaSy" and are 39 characters long; a loose length check
// keeps this future-proof against minor length changes on Google's end.
const API_KEY_PATTERN = /^AIzaSy\S{28,}$/;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let lastSeenClipboardText = "";

/** Polls the clipboard (only while called, e.g. while the settings modal is open) for a
 * Google AI Studio API key and invokes onKeyFound once when a new one appears. */
export function startClipboardPolling(onKeyFound: (key: string) => void): void {
  if (pollHandle) return;
  pollHandle = setInterval(async () => {
    try {
      const text = (await readText()).trim();
      if (!text || text === lastSeenClipboardText) return;
      lastSeenClipboardText = text;
      if (API_KEY_PATTERN.test(text)) {
        onKeyFound(text);
      }
    } catch {
      // Clipboard access denied/unavailable - fail silently, manual paste still works.
    }
  }, 1000);
}

export function stopClipboardPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  lastSeenClipboardText = "";
}
