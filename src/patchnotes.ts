export interface PatchNoteEntry {
  version: string;
  de: string[];
  en: string[];
}

export const PATCH_NOTES: PatchNoteEntry[] = [
  {
    version: "0.8.1",
    de: [
      "Linux: möglicher Fix für weißes Fenster mit „could not connect to localhost“ auch außerhalb von Flatpak (AppImage, native Installation) - WebKitGTKs interne Sandbox wird jetzt auch dort deaktiviert (WEBKIT_FORCE_SANDBOX=0)",
      "Frontend nutzt jetzt relative statt absolute Asset-Pfade (defensive Absicherung)",
    ],
    en: [
      "Linux: possible fix for a blank window with \"could not connect to localhost\" outside of Flatpak too (AppImage, native install) - WebKitGTK's internal sandbox is now disabled there as well (WEBKIT_FORCE_SANDBOX=0)",
      "Frontend now uses relative instead of absolute asset paths (defensive hardening)",
    ],
  },
  {
    version: "0.8.0",
    de: [
      "Neu: Präzise Datei-Bearbeitung per Suchen/Ersetzen statt vollständigem Datei-Überschreiben - schützt bestehenden Code (CSS, Animationen, Logik) vor versehentlichem Löschen/Vereinfachen",
      "Neu: „Architect Mode\" - NovaTree kann komplett neue Projektstrukturen mit mehreren Dateien in einem eigenen Unterordner in einem Zug anlegen",
      "Neu: Bilder per Einfügen (Strg+V) oder Drag & Drop in den Chat anhängen - werden automatisch verkleinert/komprimiert und an Gemini mitgeschickt",
      "Robustere JSON-Verarbeitung: abgeschnittene/fehlerhafte Antworten (z. B. bei Erreichen des Ausgabe-Limits) werden jetzt automatisch repariert, statt als Rohtext im Chat zu landen",
    ],
    en: [
      "New: precise file edits via search/replace instead of overwriting the whole file - protects existing code (CSS, animations, logic) from accidental deletion/simplification",
      "New: \"Architect Mode\" - NovaTree can scaffold a whole new project structure with multiple files in its own subfolder in one go",
      "New: attach images to the chat via paste (Ctrl+V) or drag & drop - automatically downscaled/compressed before being sent to Gemini",
      "More robust JSON handling: truncated/malformed responses (e.g. from hitting the output limit) are now automatically repaired instead of leaking as raw text into the chat",
    ],
  },
  {
    version: "0.7.0",
    de: [
      "Neu: Granulare Sicherheit für den KI-Dateizugriff im Workspace-Ordner (Einstellungen → „KI-Dateizugriff“)",
      "Drei Modi: Immer nachfragen, Teil-Autonom (einzeln pro Aktionstyp konfigurierbar), Voll-Autonom",
      "Beim Löschen fragt NovaTree jetzt mit einer deutlichen Warnung nach, bevor eine Datei unwiderruflich entfernt wird (wenn aktiviert)",
      "Beim Erstellen/Bearbeiten zeigt NovaTree einen Diff (Monacos nativer Diff-Editor) zwischen aktuellem und vorgeschlagenem Inhalt, bevor die Datei geschrieben wird (wenn aktiviert)",
    ],
    en: [
      "New: granular security for AI file access in the workspace folder (Settings → \"AI file access\")",
      "Three modes: always ask, partially autonomous (configurable per action type), fully autonomous",
      "On delete, NovaTree now asks for confirmation with a clear warning before a file is permanently removed (if enabled)",
      "On create/edit, NovaTree shows a diff (Monaco's native diff editor) between the current and proposed content before writing the file (if enabled)",
    ],
  },
  {
    version: "0.6.1",
    de: [
      "Neu: Smarter API-Key-Import - Button „API-Schlüssel holen“ in den Einstellungen öffnet Google AI Studio im Standard-Browser",
      "Sobald du dort einen Schlüssel kopierst, erkennt NovaTree ihn automatisch aus der Zwischenablage und trägt ihn ein (nur während das Einstellungsfenster offen ist)",
    ],
    en: [
      "New: smart API key import - a \"Get API key\" button in Settings opens Google AI Studio in the default browser",
      "As soon as you copy a key there, NovaTree automatically detects it from the clipboard and fills it in (only while the settings window is open)",
    ],
  },
  {
    version: "0.6.0",
    de: [
      "App aus Markenrechtsgründen von „NovaTwin\" in „NovaTree\" umbenannt (App-ID, Repository, Datenablage, Schlüsselbund-Eintrag)",
      "Hinweis: Chats/Einstellungen aus älteren Versionen werden dadurch nicht automatisch übernommen, der API-Schlüssel muss einmalig neu eingetragen werden",
      "Fehler behoben: über die Büroklammer angehängte Dateien ließen sich nicht im Live-Editor öffnen - jetzt sowohl direkt in der Anhang-Vorschau als auch nach dem Senden anklickbar",
      "Sperre für Dateien im Live-Editor gilt jetzt über die gesamte Dauer einer Anfrage (nicht nur den kurzen Schreibvorgang), damit das Schloss-Symbol tatsächlich sichtbar wird",
    ],
    en: [
      "App renamed from \"NovaTwin\" to \"NovaTree\" for trademark reasons (app ID, repository, data storage, keychain entry)",
      "Note: chats/settings from older versions are not carried over automatically because of this, the API key needs to be re-entered once",
      "Fixed: files attached via the paperclip couldn't be opened in the live editor - now clickable both in the attachment preview and after sending",
      "The live editor's file lock now spans the whole duration of a request (not just the brief disk write) so the lock icon is actually visible",
    ],
  },
  {
    version: "0.5.1",
    de: [
      "Fehler behoben: Chats umbenennen funktionierte nicht zuverlässig - jetzt per Rechtsklick auf einen Chat mit Menü für Umbenennen/Löschen",
      "Fehler behoben: Live-Editor ließ sich nicht ausblenden (ein CSS-Konflikt überschrieb das Verstecken)",
      "Klapp-Griff mit Pfeil-Symbol (‹/›) am Rand der Editor-Spalte ersetzt das bisherige, wenig eindeutige Umschalt-Icon - immer sichtbar, unabhängig vom Workspace-Ordner",
      "Sichtbarer Speichern-Button für eigene Änderungen im Editor (zusätzlich zu Strg+S, Tooltip zeigt den Shortcut)",
      "An eine Nachricht angehängte Einzeldateien lassen sich jetzt ebenfalls per Klick im Live-Editor öffnen, auch ohne verknüpften Workspace-Ordner",
    ],
    en: [
      "Fixed: renaming chats didn't work reliably - now via right-click on a chat with a rename/delete menu",
      "Fixed: the live editor couldn't be hidden (a CSS rule-order conflict overrode the hide state)",
      "A collapse handle with an arrow icon (‹/›) on the edge of the editor column replaces the previous, unclear toggle icon - always visible, independent of any workspace folder",
      "Visible save button for your own edits in the editor (in addition to Ctrl+S, tooltip shows the shortcut)",
      "Files attached to a single message can now also be opened in the live editor by clicking them, even without a linked workspace folder",
    ],
  },
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
