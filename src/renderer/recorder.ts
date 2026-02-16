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
  const stream = await navigator.mediaDevices.getUserMedia({ audio: getAudioConstraints() });
  const track = stream.getAudioTracks()[0];
  tritri.log(`[recorder] mic acquired: ${track?.label}, state=${track?.readyState}`);
  return stream;
}

async function enumerateAndSendDevices(): Promise<void> {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs: AudioDeviceInfo[] = allDevices
      .filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
    tritri.sendAudioDevices(audioInputs);
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
  const currentTrack = mediaStream?.getAudioTracks()[0];
  tritri.log(`[recorder] devicechange fired, recording=${isRecording}, track=${currentTrack?.readyState ?? "none"}, ctx=${audioContext?.state ?? "none"}`);

  // Re-enumerate devices so the tray menu stays up to date
  enumerateAndSendDevices();

  if (!audioContext) return;

  // If we have a pinned device and the track is still live, don't touch it
  if (currentTrack && currentTrack.readyState === "live") return;

  tritri.log("[recorder] track dead, re-acquiring mic");
  try {
    mediaStream = await acquireMic();
    wireSource(mediaStream);

    const track = mediaStream.getAudioTracks()[0];
    if (track) {
      track.onended = () => {
        tritri.log(`[recorder] track.onended fired, state=${track.readyState}`);
        handleDeviceChange();
      };
    }
  } catch (err) {
    tritri.log(`[recorder] mic re-acquire failed: ${err}`);
  }
}

/**
 * Pre-initialize mic and audio graph on app launch.
 */
export async function warmUp(): Promise<void> {
  if (warmReady) return;
  try {
    mediaStream = await acquireMic();

    audioContext = new AudioContext({ sampleRate: TIMING.SAMPLE_RATE });
    tritri.log(`[recorder] warm-up: AudioContext created, state=${audioContext.state}, sampleRate=${audioContext.sampleRate}`);

    audioContext.onstatechange = () => {
      tritri.log(`[recorder] AudioContext state changed to: ${audioContext?.state}`);
    };

    buildAudioGraph(mediaStream);

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    const track = mediaStream.getAudioTracks()[0];
    if (track) {
      track.onended = () => {
        tritri.log(`[recorder] track.onended fired, state=${track.readyState}`);
        handleDeviceChange();
      };
    }

    warmReady = true;
    tritri.log("[recorder] warm-up complete — mic is hot");

    // Send initial device list to main for tray menu
    await enumerateAndSendDevices();
  } catch (err) {
    tritri.log(`[recorder] warm-up failed: ${err}`);
  }
}

/**
 * Switch to a specific mic device (or "" for system default).
 */
export async function selectDevice(deviceId: string): Promise<void> {
  pinnedDeviceId = deviceId || null;
  tritri.log(`[recorder] device pinned: ${pinnedDeviceId ?? "System Default"}`);

  if (!audioContext) return;

  // Stop old tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
  }

  // Acquire the new device
  try {
    mediaStream = await acquireMic();
    wireSource(mediaStream);

    const track = mediaStream.getAudioTracks()[0];
    if (track) {
      track.onended = () => {
        tritri.log(`[recorder] track.onended fired, state=${track.readyState}`);
        handleDeviceChange();
      };
    }
  } catch (err) {
    tritri.log(`[recorder] selectDevice failed: ${err}`);
  }
}

/**
 * Start recording — if already warmed up, this is instant.
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

    // Verify mic track is still alive — re-acquire if ended
    const currentTrack = mediaStream?.getAudioTracks()[0];
    if (!currentTrack || currentTrack.readyState !== "live") {
      tritri.log(`[recorder] track dead (${currentTrack?.readyState ?? "none"}), re-acquiring mic`);
      mediaStream = await acquireMic();
      wireSource(mediaStream);
      const track = mediaStream.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          tritri.log(`[recorder] track.onended fired, state=${track.readyState}`);
          handleDeviceChange();
        };
      }
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
