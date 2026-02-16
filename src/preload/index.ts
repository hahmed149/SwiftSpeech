import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/constants";
import type { PipelineStatus, TritriAPI, AudioDeviceInfo } from "../shared/types";

let toggleCallback: ((shouldRecord: boolean) => void) | null = null;
let selectDeviceCallback: ((deviceId: string) => void) | null = null;

const api: TritriAPI = {
  startRecording() {
    ipcRenderer.send(IPC.START_RECORDING);
  },
  stopRecording() {
    ipcRenderer.send(IPC.STOP_RECORDING);
  },
  sendAudioChunk(chunk: Float32Array) {
    ipcRenderer.send(IPC.AUDIO_CHUNK, Array.from(chunk));
  },
  log(msg: string) {
    ipcRenderer.send(IPC.RENDERER_LOG, msg);
  },
  sendAudioDevices(devices: AudioDeviceInfo[]) {
    ipcRenderer.send(IPC.AUDIO_DEVICES, devices);
  },
  onSelectDevice(callback: (deviceId: string) => void) {
    selectDeviceCallback = callback;
  },
  onPipelineStatus(callback: (status: PipelineStatus) => void) {
    const handler = (_event: Electron.IpcRendererEvent, status: PipelineStatus) => {
      callback(status);
    };
    ipcRenderer.on(IPC.PIPELINE_STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC.PIPELINE_STATUS, handler);
    };
  },
  onToggle(callback: (shouldRecord: boolean) => void) {
    toggleCallback = callback;
  },
};

contextBridge.exposeInMainWorld("tritri", api);

ipcRenderer.on(IPC.TOGGLE_RECORDING, (_event, shouldRecord: boolean) => {
  if (toggleCallback) toggleCallback(shouldRecord);
});

ipcRenderer.on(IPC.SELECT_DEVICE, (_event, deviceId: string) => {
  if (selectDeviceCallback) selectDeviceCallback(deviceId);
});
