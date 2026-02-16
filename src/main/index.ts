import { app, ipcMain } from "electron";
import { createTray, updateAudioDevices } from "./tray";
import { createPopover, togglePopover, showPopover, hidePopoverAfter, getPopover } from "./window";
import { setupIpcHandlers, sendToggle } from "./ipc-handlers";
import { UiohookManager } from "./shortcut/uiohook-manager";
import { checkResources } from "./resource-paths";
import { detectBackend } from "./transcription/llm-proofread";
import { ensureOllamaReady } from "./ollama-setup";
import { loadSettings, saveSettings } from "./settings";
import { log, logError, LOG_PATH_DISPLAY } from "./logger";
import { IPC, TIMING } from "../shared/constants";
import type { AudioDeviceInfo } from "../shared/types";

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Hide dock icon (menu bar app)
app.dock?.hide();

let uiohookManager: UiohookManager | null = null;
let tray: Electron.Tray | null = null;

app.whenReady().then(() => {
  log("Swift Speech starting");
  log(`Log file: ${LOG_PATH_DISPLAY}`);

  const resources = checkResources();
  if (!resources.whisper || !resources.model) {
    logError(
      `Missing resources. Run: npm run setup\n` +
      `  whisper binary: ${resources.whisper ? "OK" : "MISSING"}\n` +
      `  model file: ${resources.model ? "OK" : "MISSING"}`
    );
  } else {
    log("Resources OK (whisper binary + model)");
  }

  const settings = loadSettings();
  const popover = createPopover();

  // Handle audio device list from renderer
  ipcMain.on(IPC.AUDIO_DEVICES, (_event, devices: AudioDeviceInfo[]) => {
    log(`Audio devices: ${devices.map((d) => d.label).join(", ")}`);
    updateAudioDevices(devices);
  });

  tray = createTray(
    () => togglePopover(),
    settings.triggerKeycode,
    settings.micDeviceId,
    (keycode) => {
      saveSettings({ triggerKeycode: keycode });
      uiohookManager?.setTriggerKeycode(keycode);
      log(`Hotkey updated to keycode ${keycode}`);
    },
    (deviceId) => {
      saveSettings({ micDeviceId: deviceId });
      log(`Mic updated to ${deviceId ?? "System Default"}`);
      // Tell renderer to switch mic
      const win = getPopover();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.SELECT_DEVICE, deviceId ?? "");
      }
    },
  );

  setupIpcHandlers(
    () => getPopover(),
    (status) => {
      const delay = status === "error" ? TIMING.ERROR_HIDE_MS : TIMING.DONE_HIDE_MS;
      hidePopoverAfter(delay);
    },
  );

  // Hold-to-record keyboard shortcut
  uiohookManager = new UiohookManager(settings.triggerKeycode, (event) => {
    if (event === "hold-start") {
      log("Hold detected — starting recording");
      showPopover();
      sendToggle(() => getPopover(), true);
    } else if (event === "hold-end") {
      log("Hold released — stopping recording");
      sendToggle(() => getPopover(), false);
    }
  });

  try {
    uiohookManager.start();
  } catch (err) {
    logError("Failed to start keyboard hook (Accessibility permission needed?)", err);
  }

  // Ensure Ollama + model are ready (install if needed)
  ensureOllamaReady()
    .then(() => detectBackend())
    .then((b) => log(`Proofreading: ${b}`))
    .catch((err) => logError("Ollama setup failed", err));

  log("Swift Speech ready");
});

app.on("will-quit", () => {
  uiohookManager?.stop();
});

app.on("window-all-closed", (e: Event) => {
  e.preventDefault();
});
