import { TIMING } from "../shared/constants";
import type { AudioDeviceInfo } from "../shared/types";

declare const tritri: import("../shared/types").TritriAPI;

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let processorNode: ScriptProcessorNode | null = null;
let gainNode: GainNode | null = null;
let isRecording = false;
let processCallbackCount = 0;
let lastProcessLogAt = 0;
let warmReady = false;
let pinnedDeviceId: string | null = null;

function getAudioConstraints(): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    sampleRate: TIMING.SAMPLE_RATE,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: true,
  };
  if (pinnedDeviceId) {
    constraints.deviceId = { exact: pinnedDeviceId };
  }
  return constraints;
}

async function acquireMic(): Promise<MediaStream> {
  const label = pinnedDeviceId ? `device=${pinnedDeviceId.slice(0, 16)}...` : "default";
  tritri.log(`[recorder] acquiring mic (${label})...`);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
    const track = stream.getAudioTracks()[0];
    tritri.log(`[recorder] mic acquired: ${track?.label}, state=${track?.readyState}`);
    return stream;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    tritri.log(`[recorder] mic acquisition failed: ${msg}`);
    tritri.sendMicError(msg);
    throw err;
  }
}

async function enumerateAndSendDevices(): Promise<void> {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs: AudioDeviceInfo[] = allDevices
      .filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
    tritri.log(`[recorder] enumerated ${audioInputs.length} audio devices: ${audioInputs.map((d) => d.label).join(", ") || "(none)"}`);
    tritri.sendAudioDevices(audioInputs);

    if (audioInputs.length === 0) {
      tritri.sendMicError("NotFoundError: No microphones detected");
    }
  } catch (err) {
    tritri.log(`[recorder] enumerateDevices failed: ${err}`);
  }
}

function buildAudioGraph(stream: MediaStream): void {
  if (!audioContext) return;

  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;

  const bufferSize = 4096;
  processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

  processorNode.onaudioprocess = (e) => {
    if (!isRecording) return;
    processCallbackCount++;

    const inputData = e.inputBuffer.getChannelData(0);
    const chunk = new Float32Array(inputData.length);
    chunk.set(inputData);
    tritri.sendAudioChunk(chunk);

    const now = Date.now();
    if (now - lastProcessLogAt >= 2000) {
      const track = mediaStream?.getAudioTracks()[0];
      tritri.log(`[recorder] audio flowing: ${processCallbackCount} callbacks, track=${track?.readyState ?? "none"}, ctx=${audioContext?.state ?? "none"}`);
      lastProcessLogAt = now;
    }
  };

  gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  processorNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  wireSource(stream);
}

function wireSource(stream: MediaStream): void {
  if (!audioContext || !analyserNode || !processorNode) return;

  if (sourceNode) {
    try { sourceNode.disconnect(); } catch {}
  }

  sourceNode = audioContext.createMediaStreamSource(stream);
  sourceNode.connect(analyserNode);
  sourceNode.connect(processorNode);
  tritri.log(`[recorder] source wired, ctx state=${audioContext.state}`);
}

async function handleDeviceChange(): Promise<void> {
  tritri.log(`[recorder] devicechange fired, recording=${isRecording}`);

  // Re-enumerate devices so the tray menu stays up to date
  enumerateAndSendDevices();
}

/**
 * Pre-initialize AudioContext on app launch (but do NOT acquire mic yet).
 */
export async function warmUp(): Promise<void> {
  if (warmReady) return;
  try {
    audioContext = new AudioContext({ sampleRate: TIMING.SAMPLE_RATE });
    tritri.log(`[recorder] warm-up: AudioContext created, state=${audioContext.state}, sampleRate=${audioContext.sampleRate}`);

    audioContext.onstatechange = () => {
      tritri.log(`[recorder] AudioContext state changed to: ${audioContext?.state}`);
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    warmReady = true;
    tritri.log("[recorder] warm-up complete — ready (mic not yet acquired)");

    // Send initial device list to main for tray menu (requires brief mic access)
    // Use a temporary stream just to get device labels, then release it
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());
      await enumerateAndSendDevices();
    } catch (err) {
      tritri.log(`[recorder] device enumeration failed: ${err}`);
      await enumerateAndSendDevices(); // Still try without labels
    }
  } catch (err) {
    tritri.log(`[recorder] warm-up failed: ${err}`);
  }
}

/**
 * Switch to a specific mic device (or "" for system default).
 * The new device will be used on the next recording.
 */
export function selectDevice(deviceId: string): void {
  pinnedDeviceId = deviceId || null;
  tritri.log(`[recorder] device pinned: ${pinnedDeviceId ?? "System Default"}`);
}

/**
 * Start recording — acquires mic on demand.
 */
export async function startRecording(): Promise<AnalyserNode | null> {
  try {
    processCallbackCount = 0;
    lastProcessLogAt = Date.now();

    if (!warmReady) {
      await warmUp();
    }

    if (!audioContext) {
      tritri.log("[recorder] startRecording failed: no audio context");
      return null;
    }

    // Resume AudioContext if browser suspended it while window was hidden
    if (audioContext.state === "suspended") {
      tritri.log("[recorder] resuming suspended AudioContext");
      await audioContext.resume();
    }

    // Acquire mic now (on-demand)
    tritri.log("[recorder] acquiring mic for recording...");
    mediaStream = await acquireMic();
    buildAudioGraph(mediaStream);

    const track = mediaStream.getAudioTracks()[0];
    if (track) {
      track.onended = () => {
        tritri.log(`[recorder] track.onended fired, state=${track.readyState}`);
      };
    }

    if (!analyserNode) {
      tritri.log("[recorder] startRecording failed: no analyser node");
      return null;
    }

    isRecording = true;
    tritri.startRecording();
    tritri.log("[recorder] recording started");
    return analyserNode;
  } catch (err) {
    tritri.log(`[recorder] startRecording failed: ${err}`);
    isRecording = false;
    return null;
  }
}

export function stopRecording(): void {
  tritri.log(`[recorder] stopRecording called, callbacks=${processCallbackCount}`);
  isRecording = false;
  tritri.stopRecording();

  // Release the mic immediately
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    mediaStream = null;
    tritri.log("[recorder] mic released");
  }

  // Disconnect the source node
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch {}
    sourceNode = null;
  }
}

export function teardown(): void {
  isRecording = false;
  warmReady = false;

  navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  sourceNode = null;
  analyserNode = null;
  processorNode = null;
  gainNode = null;
}
