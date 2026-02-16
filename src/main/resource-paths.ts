import { app } from "electron";
import { join } from "path";
import { existsSync } from "fs";

function isPackaged(): boolean {
  return app.isPackaged;
}

export function getWhisperBinaryPath(): string {
  if (isPackaged()) {
    return join(process.resourcesPath, "whisper", "whisper-cli");
  }
  return join(__dirname, "..", "..", "resources", "whisper", "whisper-cli");
}

export function getLibDir(): string {
  if (isPackaged()) {
    return join(process.resourcesPath, "lib");
  }
  return join(__dirname, "..", "..", "resources", "lib");
}

export function getModelPath(): string {
  if (isPackaged()) {
    return join(process.resourcesPath, "models", "ggml-base.en.bin");
  }
  return join(__dirname, "..", "..", "resources", "models", "ggml-base.en.bin");
}

export function checkResources(): { whisper: boolean; model: boolean } {
  return {
    whisper: existsSync(getWhisperBinaryPath()),
    model: existsSync(getModelPath()),
  };
}
