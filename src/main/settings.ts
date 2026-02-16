import { app } from "electron";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { TRIGGER_KEYCODE } from "../shared/constants";

export interface Settings {
  triggerKeycode: number;
  micDeviceId: string | null;
}

const SETTINGS_PATH = join(app.getPath("userData"), "settings.json");

const DEFAULTS: Settings = {
  triggerKeycode: TRIGGER_KEYCODE,
  micDeviceId: null,
};

export function loadSettings(): Settings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveSettings(settings: Partial<Settings>): void {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
}
