export interface PatchNoteEntry {
  version: string;
  de: string[];
  en: string[];
}

export const PATCH_NOTES: PatchNoteEntry[] = [
  {
    version: "0.5.0",
    de: [
      "Neu: Live-Editor (Monaco/VS-Code-Engine) als eigene Spalte zwischen Chat-Verlauf und Chat-Fenster, ein-/ausblendbar über das Symbol in der Workspace-Leiste",
      "Datei aus der Workspace-Dateiliste anklicken, um sie mit Syntax-Highlighting im Editor zu öffnen (Tab-Leiste mit Schließen-Button)",
      "Während NovaTwin eine geöffnete Datei bearbeitet, wird der zugehörige Tab automatisch gesperrt (🔒) und danach live mit dem neuen Inhalt aktualisiert",
      "Eigene Änderungen im Editor mit Strg+S direkt speichern",
      "Dateien in der Workspace-Liste zeigen jetzt einen Zeiger-Cursor beim Hovern, damit klar ist, dass sie anklickbar sind",
      "Fehler behoben: von NovaTwin erstellter Code landete manchmal komplett in einer einzigen Zeile statt normal formatiert",
    ],
    en: [
      "New: live editor (Monaco/VS Code engine) as its own column between the chat list and the chat window, toggleable via the icon in the workspace bar",
      "Click a file in the workspace file list to open it in the editor with syntax highlighting (tab bar with close button)",
      "While NovaTwin edits an open file, its tab is automatically locked (🔒) and then live-updated with the new content once done",
      "Save your own edits in the editor directly with Ctrl+S",
      "Workspace file list entries now show a pointer cursor on hover to make clear they're clickable",
      "Fixed: code NovaTwin generated sometimes ended up entirely on a single line instead of properly formatted",
    ],
  },
  {
    version: "0.4.0",
    de: [
      "Chat-Namen umbenennbar (Doppelklick in der Seitenleiste)",
      "Fehler behoben: sehr lange Chat-Namen verdeckten den Löschen-Button",
      "Sprachumschalter Deutsch/Englisch in der Titelleiste",
      "Patch-Notes-Fenster (dieses hier) über die Versionsnummer in der Titelleiste",
      "Animierte „NovaTwin denkt nach“-Anzeige mit Timer während der Antwort generiert wird",
      "Gemini legt bei mehreren Dateien jetzt sinnvolle Unterordner an, statt alles ins Wurzelverzeichnis zu schreiben",
      "Bei „Modell überlastet“-Fehlern (hohe Nachfrage) versucht die App es automatisch mehrfach erneut und weicht danach auf ein anderes Modell aus, statt sofort abzubrechen",
      "Sprachumschalter nutzt jetzt echte Vektor-Flaggen (SVG) statt Emoji",
    ],
    en: [
      "Chats can now be renamed (double-click in the sidebar)",
      "Fixed: very long chat names hid the delete button",
      "German/English language switcher in the titlebar",
      "Patch notes window (this one) via the version number in the titlebar",
      "Animated \"NovaTwin is thinking\" indicator with a live timer while a reply is generated",
      "Gemini now creates sensible subfolders for multi-file requests instead of dumping everything in one folder",
      "\"Model overloaded\" (high demand) errors now trigger automatic retries and fall back to another model instead of failing immediately",
      "Language switcher now uses real vector flags (SVG) instead of emoji",
    ],
  },
  {
    version: "0.3.8",
    de: [
      "Release-Pipeline: Windows- und Linux-Build laufen jetzt nacheinander statt parallel (behebt einen Race-Condition-Fehler beim Release-Anlegen)",
    ],
    en: [
      "Release pipeline: Windows and Linux builds now run sequentially instead of in parallel (fixes a race condition when creating the release)",
    ],
  },
  {
    version: "0.3.7",
    de: ["Flatpak-Runtime auf org.gnome.Platform//50 angehoben, zusätzliche Keyring-Berechtigung"],
    en: ["Bumped Flatpak runtime to org.gnome.Platform//50, added keyring filesystem permission"],
  },
  {
    version: "0.3.6",
    de: ["Flatpak: weißes Fenster (\"could not connect to localhost\") durch Deaktivieren von WebKitGTKs interner Sandbox behoben"],
    en: ["Flatpak: fixed blank window (\"could not connect to localhost\") by disabling WebKitGTK's internal sandbox"],
  },
  {
    version: "0.3.5",
    de: ["Eigenes App-Icon in Titelleiste, Fenster- und Desktop-Icons aller Plattformen"],
    en: ["Custom app icon in the titlebar, window and desktop icons on all platforms"],
  },
  {
    version: "0.3.4",
    de: [
      "Workspace-Datei-Aktionen nutzen jetzt Googles Structured-Output-Modus (zuverlässiger als reines Prompt-JSON)",
      "Gemini erklärt jetzt kurz, was gemacht wurde und was als Nächstes sinnvoll ist",
    ],
    en: [
      "Workspace file actions now use Google's Structured Output mode (more reliable than plain-prompt JSON)",
      "Gemini now briefly explains what it did and what to do next",
    ],
  },
  {
    version: "0.3.3",
    de: ["Mehrere Datei-Aktionen (create/edit/delete) in einer einzigen Gemini-Antwort möglich"],
    en: ["Multiple file actions (create/edit/delete) possible in a single Gemini response"],
  },
  {
    version: "0.3.2",
    de: ["Flatpak-Build für Linux hinzugefügt (org.gnome.Platform-Runtime)"],
    en: ["Added Flatpak build for Linux (org.gnome.Platform runtime)"],
  },
  {
    version: "0.3.1",
    de: ["Weißes/schwarzes Fenster unter Linux behoben (WebKitGTK-Compositing-Workaround)"],
    en: ["Fixed blank/black window on Linux (WebKitGTK compositing workaround)"],
  },
  {
    version: "0.3.0",
    de: [
      "Eigene Titelleiste im App-Design mit Versionsanzeige",
      "Workspace-Ordner pro Chat: Gemini kann Dateien darin autonom erstellen/bearbeiten/löschen",
    ],
    en: [
      "Custom in-app titlebar with version display",
      "Per-chat workspace folder: Gemini can autonomously create/edit/delete files in it",
    ],
  },
  {
    version: "0.2.0",
    de: [
      "Modelle auf gemini-flash-latest / gemini-3.1-flash-lite umgestellt (alte Modelle von Google gesperrt)",
      "Automatischer Cooldown-Timer bei Kontingent-Fehlern (HTTP 429)",
    ],
    en: [
      "Switched models to gemini-flash-latest / gemini-3.1-flash-lite (old models blocked by Google)",
      "Automatic cooldown timer on quota errors (HTTP 429)",
    ],
  },
  {
    version: "0.1.0",
    de: ["Erste Version: Chat-UI, Datei-Anhang, sicherer API-Key-Speicher, Auto-Updater"],
    en: ["Initial release: chat UI, file attachments, secure API key storage, auto-updater"],
  },
];
