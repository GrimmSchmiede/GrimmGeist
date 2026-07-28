import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const bannerEl = document.getElementById("update-banner")!;
const bannerTextEl = document.getElementById("update-banner-text")!;
const installBtnEl = document.getElementById("update-install-btn") as HTMLButtonElement;
const dismissBtnEl = document.getElementById("update-dismiss-btn")!;

let pendingUpdate: Update | null = null;

function showBanner(version: string) {
  bannerTextEl.textContent = `Update verfügbar: Version ${version}`;
  bannerEl.classList.remove("hidden");
}

function hideBanner() {
  bannerEl.classList.add("hidden");
}

async function installUpdate() {
  if (!pendingUpdate) return;
  installBtnEl.disabled = true;
  installBtnEl.textContent = "Wird installiert…";
  try {
    await pendingUpdate.downloadAndInstall();
    await relaunch();
  } catch (err) {
    installBtnEl.disabled = false;
    installBtnEl.textContent = "Jetzt installieren";
    alert(`Update konnte nicht installiert werden: ${err}`);
  }
}

/** Checks the GitHub release feed for a newer signed build and shows a banner if one is found. */
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (update?.available) {
      pendingUpdate = update;
      showBanner(update.version);
    }
  } catch (err) {
    // No network / no releases yet / running an unsigned dev build: fail silently.
    console.debug("Update-Check fehlgeschlagen:", err);
  }
}

installBtnEl.addEventListener("click", installUpdate);
dismissBtnEl.addEventListener("click", hideBanner);
