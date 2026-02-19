import { systemPreferences } from "electron";
import { net } from "electron";
import { checkResources } from "./resource-paths";
import { log } from "./logger";
import { notify } from "./notifications";

export interface HealthStatus {
  mic: "ok" | "no-permission" | "unknown";
  whisper: boolean;
  model: boolean;
  ollama: boolean;
  ollamaModel: string | null;
}

let lastStatus: HealthStatus | null = null;

export function getHealthStatus(): HealthStatus | null {
  return lastStatus;
}

export async function runHealthCheck(): Promise<HealthStatus> {
  const resources = checkResources();

  // Check mic permission
  let mic: HealthStatus["mic"] = "unknown";
  try {
    const mediaStatus = systemPreferences.getMediaAccessStatus("microphone");
    mic = mediaStatus === "granted" ? "ok" : "no-permission";
  } catch {
    mic = "unknown";
  }

  // Check Ollama
  let ollama = false;
  let ollamaModel: string | null = null;
  try {
    const res = await net.fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      ollama = true;
      const data: any = await res.json();
      const models: string[] = (data.models ?? []).map((m: any) => m.name as string);
      ollamaModel = models[0] ?? null;
    }
  } catch {}

  const status: HealthStatus = {
    mic,
    whisper: resources.whisper,
    model: resources.model,
    ollama,
    ollamaModel,
  };

  lastStatus = status;
  log(`[health] mic=${mic}, whisper=${resources.whisper}, model=${resources.model}, ollama=${ollama}, ollamaModel=${ollamaModel}`);

  // Send notifications for problems
  const problems: string[] = [];

  if (mic === "no-permission") {
    problems.push("Microphone permission denied");
  }

  if (!resources.whisper || !resources.model) {
    const missing = [];
    if (!resources.whisper) missing.push("whisper binary");
    if (!resources.model) missing.push("speech model");
    problems.push(`Missing: ${missing.join(", ")} — reinstall the app`);
  }

  if (!ollama) {
    problems.push("Ollama not running — LLM proofreading unavailable");
  } else if (!ollamaModel) {
    problems.push("No Ollama model installed");
  }

  if (problems.length > 0) {
    notify("Swift Speech — Setup Issue", problems.join("\n"));
  }

  return status;
}
