import { ipcMain, BrowserWindow } from "electron";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { IPC, TIMING } from "../shared/constants";
import { PipelineStatus } from "../shared/types";
import { float32ToInt16, writeWav } from "./audio-file";
import { transcribe } from "./transcription/whisper-runner";
import { proofreadWithLLM } from "./transcription/llm-proofread";
import { pasteText } from "./clipboard-paste";
import { log, logError } from "./logger";

let audioChunks: Float32Array[] = [];
let isRecording = false;
let recordingStartedAt = 0;
let chunkCount = 0;

function sendStatus(win: BrowserWindow | null, status: PipelineStatus): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.PIPELINE_STATUS, status);
  }
}

export function setupIpcHandlers(
  getWindow: () => BrowserWindow | null,
  onPipelineComplete: (status: "done" | "error") => void,
): void {
  // Renderer log forwarding
  ipcMain.on(IPC.RENDERER_LOG, (_event, msg: string) => {
    log(`[renderer] ${msg}`);
  });

  ipcMain.on(IPC.START_RECORDING, () => {
    isRecording = true;
    recordingStartedAt = Date.now();
    audioChunks = [];
    chunkCount = 0;
    log("Recording started");
    sendStatus(getWindow(), { stage: "recording" });
  });

  ipcMain.on(IPC.AUDIO_CHUNK, (_event, chunkArray: number[]) => {
    if (!isRecording) return;
    audioChunks.push(new Float32Array(chunkArray));
    chunkCount++;
    // Log every 50 chunks (~13s at 4096 buffer/16kHz) to track audio flow
    if (chunkCount % 50 === 0) {
      log(`[audio] ${chunkCount} chunks received (${((chunkCount * 4096) / TIMING.SAMPLE_RATE).toFixed(1)}s)`);
    }
  });

  ipcMain.on(IPC.STOP_RECORDING, async () => {
    if (!isRecording) return;
    isRecording = false;

    const duration = Date.now() - recordingStartedAt;
    const pipelineStart = Date.now();
    log(`Recording stopped (${duration}ms, ${audioChunks.length} chunks)`);

    const win = getWindow();
    const wavPath = join(tmpdir(), `ss-${Date.now()}.wav`);

    try {
      const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);

      // Discard very short recordings
      const minSamples = TIMING.SAMPLE_RATE * (TIMING.MIN_RECORDING_MS / 1000);
      if (totalLength < minSamples) {
        log(`Recording too short (${totalLength} samples < ${minSamples} min), discarding`);
        sendStatus(win, { stage: "idle" });
        onPipelineComplete("done");
        return;
      }

      // Merge chunks
      let t0 = Date.now();
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      audioChunks = [];

      // Write WAV
      const int16 = float32ToInt16(merged);
      writeWav(wavPath, int16);
      log(`[timing] WAV encode: ${Date.now() - t0}ms (${int16.length} samples)`);

      // Transcribe
      sendStatus(win, { stage: "transcribing" });
      t0 = Date.now();
      const rawText = await transcribe(wavPath);
      log(`[timing] Whisper transcribe: ${Date.now() - t0}ms`);

      if (!rawText.trim()) {
        log("No speech detected");
        sendStatus(win, { stage: "error" });
        onPipelineComplete("error");
        return;
      }

      // Proofread with LLM (required)
      log(`[whisper] raw transcription: "${rawText}"`);
      sendStatus(win, { stage: "cleaning" });
      t0 = Date.now();
      const cleaned = await proofreadWithLLM(rawText);
      if (!cleaned) {
        log("[error] LLM proofreading unavailable — cannot proceed");
        sendStatus(win, { stage: "error" });
        onPipelineComplete("error");
        return;
      }
      log(`[timing] LLM proofread: ${Date.now() - t0}ms`);
      log(`[llm] input  (${rawText.length} chars): "${rawText}"`);
      log(`[llm] output (${cleaned.length} chars): "${cleaned}"`);
      log(`[final] pasted text: "${cleaned}"`);;

      // Paste
      sendStatus(win, { stage: "pasting" });
      t0 = Date.now();
      await pasteText(cleaned);
      log(`[timing] Paste: ${Date.now() - t0}ms`);

      sendStatus(win, { stage: "done" });
      log(`[timing] Total pipeline: ${Date.now() - pipelineStart}ms`);
      onPipelineComplete("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logError("Pipeline failed", err);
      sendStatus(win, { stage: "error" });
      onPipelineComplete("error");
    } finally {
      if (existsSync(wavPath)) {
        try { unlinkSync(wavPath); } catch {}
      }
    }
  });
}

export function sendToggle(getWindow: () => BrowserWindow | null, shouldRecord: boolean): void {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.TOGGLE_RECORDING, shouldRecord);
  }
}
