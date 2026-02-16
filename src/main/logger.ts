import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LOG_DIR = join(homedir(), "Library", "Logs");
const LOG_PATH = join(LOG_DIR, "swift-speech.log");

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function log(msg: string): void {
  const line = `[${ts()}] ${msg}\n`;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, line);
  } catch {}
  console.log(`[swift-speech] ${msg}`);
}

export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : String(err ?? "");
  log(`ERROR: ${msg}${detail ? ` — ${detail}` : ""}`);
}

export const LOG_PATH_DISPLAY = LOG_PATH;
