import { net } from "electron";
import { exec, spawn } from "child_process";
import { existsSync } from "fs";
import { log, logError } from "./logger";

const OLLAMA_API = "http://localhost:11434";
const REQUIRED_MODEL = "gemma3";

async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await net.fetch(`${OLLAMA_API}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function findOllamaBinary(): string | null {
  const paths = [
    "/usr/local/bin/ollama",
    "/opt/homebrew/bin/ollama",
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function waitForOllama(seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isOllamaRunning()) return true;
  }
  return false;
}

async function startOllama(binary: string): Promise<void> {
  log(`Starting Ollama server: ${binary}`);
  const proc = spawn(binary, ["serve"], { detached: true, stdio: "ignore" });
  proc.unref();
  if (!(await waitForOllama(15))) {
    throw new Error("Ollama server did not start within 15s");
  }
  log("Ollama server started");
}

async function launchOllamaApp(): Promise<void> {
  log("Launching Ollama.app...");
  await execAsync("open -a Ollama");
  if (!(await waitForOllama(15))) {
    throw new Error("Ollama.app did not start within 15s");
  }
  log("Ollama.app started");
}

async function installOllama(): Promise<void> {
  log("Installing Ollama...");
  // Download macOS app bundle
  await execAsync(
    "curl -fsSL -o /tmp/Ollama-darwin.zip https://ollama.com/download/Ollama-darwin.zip",
    180_000,
  );
  log("Ollama downloaded, extracting...");
  await execAsync("unzip -oq /tmp/Ollama-darwin.zip -d /tmp/Ollama-extract");
  // Move to /Applications — try direct first, fall back to admin prompt
  try {
    await execAsync("mv -f /tmp/Ollama-extract/Ollama.app /Applications/");
  } catch {
    log("Direct move failed, requesting admin privileges...");
    await execAsync(
      `osascript -e 'do shell script "mv -f /tmp/Ollama-extract/Ollama.app /Applications/" with administrator privileges'`,
    );
  }
  await execAsync("rm -rf /tmp/Ollama-darwin.zip /tmp/Ollama-extract");
  log("Ollama installed to /Applications/Ollama.app");
}

async function hasModel(model: string): Promise<boolean> {
  try {
    const res = await net.fetch(`${OLLAMA_API}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data: any = await res.json();
    const names: string[] = (data.models ?? []).map((m: any) => m.name as string);
    return names.some((n) => n.startsWith(model));
  } catch {
    return false;
  }
}

async function pullModel(model: string): Promise<void> {
  log(`Pulling model ${model} (this may take a few minutes)...`);
  const res = await net.fetch(`${OLLAMA_API}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: false }),
    signal: AbortSignal.timeout(600_000), // 10 min for large downloads
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to pull model: ${body.slice(0, 200)}`);
  }
  log(`Model ${model} ready`);
}

/**
 * Ensure Ollama is running with the required model.
 * Installs Ollama and pulls the model if needed.
 */
export async function ensureOllamaReady(): Promise<void> {
  // 1. Already running?
  if (await isOllamaRunning()) {
    log("Ollama is running");
  } else {
    // 2. Binary exists? Start it.
    const binary = findOllamaBinary();
    if (binary) {
      await startOllama(binary);
    } else if (existsSync("/Applications/Ollama.app")) {
      // 3. App installed but not running? Launch it.
      await launchOllamaApp();
    } else {
      // 4. Not installed. Download and install.
      await installOllama();
      await launchOllamaApp();
    }
  }

  // 5. Ensure the required model is available
  if (await hasModel(REQUIRED_MODEL)) {
    log(`Model ${REQUIRED_MODEL} is available`);
  } else {
    await pullModel(REQUIRED_MODEL);
  }
}

function execAsync(cmd: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}
