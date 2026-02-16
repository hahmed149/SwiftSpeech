import { Tray, Menu, nativeImage, app } from "electron";
import { join } from "path";
import type { AudioDeviceInfo } from "../shared/types";

let tray: Tray | null = null;
let currentDevices: AudioDeviceInfo[] = [];
let currentMicDeviceId: string | null = null;
let currentKeycode = 3640;
let onKeycodeChangeFn: ((keycode: number) => void) | null = null;
let onMicChangeFn: ((deviceId: string | null) => void) | null = null;

const HOTKEY_OPTIONS: { label: string; keycode: number }[] = [
  { label: "Right Option (\u2325)", keycode: 3640 },
  { label: "Right Command (\u2318)", keycode: 3676 },
  { label: "Right Control (\u2303)", keycode: 3613 },
  { label: "Left Control", keycode: 29 },
  { label: "Left Option", keycode: 56 },
];

function loadTrayIcon(): nativeImage {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "tray", "icon.png")
    : join(__dirname, "..", "..", "assets", "icons", "tray", "icon.png");
  return nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
}

function rebuildMenu(): void {
  if (!tray) return;

  const hotkeyLabel = HOTKEY_OPTIONS.find((o) => o.keycode === currentKeycode)?.label ?? `keycode ${currentKeycode}`;

  const micItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: "System Default",
      type: "radio",
      checked: currentMicDeviceId === null,
      click: () => {
        currentMicDeviceId = null;
        onMicChangeFn?.(null);
        rebuildMenu();
      },
    },
    ...currentDevices.map((dev) => ({
      label: dev.label || "Unknown Microphone",
      type: "radio" as const,
      checked: currentMicDeviceId === dev.deviceId,
      click: () => {
        currentMicDeviceId = dev.deviceId;
        onMicChangeFn?.(dev.deviceId);
        rebuildMenu();
      },
    })),
  ];

  const menu = Menu.buildFromTemplate([
    { label: `Hold ${hotkeyLabel} to record`, enabled: false },
    { label: "Release to transcribe + paste", enabled: false },
    { type: "separator" },
    { label: "Hotkey", enabled: false },
    ...HOTKEY_OPTIONS.map((opt) => ({
      label: opt.label,
      type: "radio" as const,
      checked: opt.keycode === currentKeycode,
      click: () => {
        currentKeycode = opt.keycode;
        onKeycodeChangeFn?.(opt.keycode);
        rebuildMenu();
      },
    })),
    { type: "separator" },
    { label: "Microphone", enabled: false },
    ...micItems,
    { type: "separator" },
    { label: "Quit Swift Speech", click: () => app.quit() },
  ]);

  tray.on("right-click", () => tray?.popUpContextMenu(menu));
}

export function updateAudioDevices(devices: AudioDeviceInfo[]): void {
  currentDevices = devices;
  rebuildMenu();
}

export function createTray(
  onClick: () => void,
  initialKeycode: number,
  initialMicDeviceId: string | null,
  onKeycodeChange: (keycode: number) => void,
  onMicChange: (deviceId: string | null) => void,
): Tray {
  currentKeycode = initialKeycode;
  currentMicDeviceId = initialMicDeviceId;
  onKeycodeChangeFn = onKeycodeChange;
  onMicChangeFn = onMicChange;

  tray = new Tray(loadTrayIcon());
  tray.setToolTip("Swift Speech");
  tray.on("click", onClick);

  rebuildMenu();

  return tray;
}
