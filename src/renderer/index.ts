import type { TritriAPI, PipelineStatus } from "../shared/types";
import { warmUp, startRecording, stopRecording, selectDevice } from "./recorder";
import { startWaveform, stopWaveform } from "./waveform";

declare const tritri: TritriAPI;

const iconEl = document.getElementById("icon") as HTMLDivElement;

// Preload sound effects
const startSound = new Audio("start.mp3");
const stopSound = new Audio("stop.mp3");

let recording = false;

// Pre-initialize mic on app launch for instant recording start
warmUp();

// Handle mic device selection from tray menu
tritri.onSelectDevice((deviceId: string) => {
  selectDevice(deviceId);
});

// Listen for pipeline status updates from main process
tritri.onPipelineStatus((status: PipelineStatus) => {
  if (status.stage !== "recording") {
    stopWaveform(iconEl);
  }

  switch (status.stage) {
    case "recording":
      // Waveform handles itself
      break;
    case "transcribing":
    case "cleaning":
    case "pasting":
      iconEl.textContent = "";
      iconEl.className = "spinner";
      break;
    case "done":
      stopSound.currentTime = 0;
      stopSound.play().catch(() => {});
      iconEl.textContent = "";
      iconEl.className = "";
      recording = false;
      break;
    case "error":
    case "idle":
      iconEl.textContent = "";
      iconEl.className = "";
      recording = false;
      break;
  }
});

// Handle toggle from main process (keyboard shortcut)
tritri.onToggle(async (shouldRecord: boolean) => {
  if (shouldRecord && !recording) {
    recording = true;
    startSound.currentTime = 0;
    startSound.play().catch(() => {});
    const analyser = await startRecording();
    if (analyser) {
      startWaveform(iconEl, analyser);
    } else {
      recording = false;
    }
  } else if (!shouldRecord && recording) {
    recording = false;
    stopWaveform(iconEl);
    stopRecording();
  }
});
