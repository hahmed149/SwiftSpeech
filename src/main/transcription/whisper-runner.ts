import { spawn } from "child_process";
import { getWhisperBinaryPath, getModelPath, getLibDir } from "../resource-paths";
import { log, logError } from "../logger";

export function transcribe(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const whisperPath = getWhisperBinaryPath();
    const modelPath = getModelPath();
    const libDir = getLibDir();

    const args = [
      "-m", modelPath,
      "-f", wavPath,
      "-nt",              // no timestamps
      "-l", "en",         // language
      "-np",              // no prints (suppress logs, output transcription only)
      "--prompt", "Use proper punctuation, capitalization, and sentence structure. Format numbered lists clearly.",
    ];

    log(`Whisper: ${whisperPath} ${args.join(" ")}`);

    let stdout = "";
    let stderr = "";

    const proc = spawn(whisperPath, args, {
      env: { ...process.env, DYLD_LIBRARY_PATH: libDir },
    });

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      logError("Failed to start whisper", err);
      reject(new Error(`Failed to start whisper: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        logError(`Whisper exited with code ${code}`, stderr);
        reject(new Error(`Whisper exited with code ${code}: ${stderr.slice(0, 200)}`));
      } else {
        const text = stdout.trim().replace(/\[BLANK_AUDIO\]/g, "").trim();
        log(`Whisper result (${text.length} chars): "${text.slice(0, 80)}"`);
        resolve(text);
      }
    });
  });
}
