export type PipelineStatus =
  | { stage: "idle" }
  | { stage: "recording" }
  | { stage: "transcribing" }
  | { stage: "cleaning" }
  | { stage: "pasting" }
  | { stage: "done" }
  | { stage: "error"; message?: string };

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

export interface TritriAPI {
  startRecording(): void;
  stopRecording(): void;
  sendAudioChunk(chunk: Float32Array): void;
  log(msg: string): void;
  sendAudioDevices(devices: AudioDeviceInfo[]): void;
  sendMicError(error: string): void;
  onSelectDevice(callback: (deviceId: string) => void): void;
  onPipelineStatus(callback: (status: PipelineStatus) => void): () => void;
  onToggle(callback: (shouldRecord: boolean) => void): void;
}
