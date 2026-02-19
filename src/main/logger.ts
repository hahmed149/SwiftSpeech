import { app } from "electron";
import { appendFileSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { arch, release } from "os";

const LOG_DIR = join(app.getPath("userData"), "logs");
const MAX_LOG_AGE_DAYS = 7;
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file

let currentLogPath: string;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function ensureLogDir(): void {
  mkdirSync(LOG_DIR, { recursive: true });
}

function getLogPath(): string {
  if (!currentLogPath) {
    ensureLogDir();
    currentLogPath = join(LOG_DIR, `swift-speech-${todayStamp()}.log`);
  }
  return currentLogPath;
}

/** Remove log files older than MAX_LOG_AGE_DAYS. */
function pruneOldLogs(): void {
  try {
    const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const file of readdirSync(LOG_DIR)) {
      if (!file.startsWith("swift-speech-") || !file.endsWith(".log")) continue;
      const filePath = join(LOG_DIR, file);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          unlinkSync(filePath);
        }
      } catch {}
    }
  } catch {}
}

export function log(msg: string): void {
  const line = `[${ts()}] ${msg}\n`;
  try {
    const logPath = getLogPath();
    // Rotate if current file is too large
    try {
      const stat = statSync(logPath);
      if (stat.size > MAX_LOG_SIZE_BYTES) {
        const rotated = logPath.replace(".log", `-${Date.now()}.log`);
        try { renameSync(logPath, rotated); } catch {}
      }
    } catch {} // file doesn't exist yet — fine
    appendFileSync(logPath, line);
  } catch {}
  console.log(`[swift-speech] ${msg}`);
}

export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : String(err ?? "");
  log(`ERROR: ${msg}${detail ? ` — ${detail}` : ""}`);
}

/** Write session start marker with system diagnostics. */
export function logSessionStart(): void {
  ensureLogDir();
  pruneOldLogs();

  const version = app.getVersion();
  const packaged = app.isPackaged ? "packaged" : "dev";
  const electronVersion = process.versions.electron;

  log("═══════════════════════════════════════════════");
  log(`Swift Speech v${version} (${packaged})`);
  log(`Electron ${electronVersion}, Node ${process.version}`);
  log(`macOS ${release()}, ${arch()}`);
  log(`Logs: ${LOG_DIR}`);
  log(`UserData: ${app.getPath("userData")}`);
  log("═══════════════════════════════════════════════");
}

export function getLogDir(): string {
  ensureLogDir();
  return LOG_DIR;
}
