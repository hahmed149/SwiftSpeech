export const IPC = {
  START_RECORDING: "ss:start-recording",
  STOP_RECORDING: "ss:stop-recording",
  AUDIO_CHUNK: "ss:audio-chunk",
  PIPELINE_STATUS: "ss:pipeline-status",
  TOGGLE_RECORDING: "ss:toggle-recording",
  RENDERER_LOG: "ss:renderer-log",
  AUDIO_DEVICES: "ss:audio-devices",
  SELECT_DEVICE: "ss:select-device",
  MIC_ERROR: "ss:mic-error",
} as const;

export const TIMING = {
  HOLD_GRACE_MS: 150,
  MIN_RECORDING_MS: 400,
  SAMPLE_RATE: 16000,
  DONE_HIDE_MS: 2000,
  ERROR_HIDE_MS: 3000,
} as const;

// Default trigger key (Right Option). Configurable via tray menu > Hotkey.
export const TRIGGER_KEYCODE = 3640;
