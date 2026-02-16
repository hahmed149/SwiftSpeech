import { describe, it, expect } from "vitest";
import { IPC, TIMING, TRIGGER_KEYCODE } from "../src/shared/constants";

describe("IPC constants", () => {
  it("has all required channel names", () => {
    expect(IPC.START_RECORDING).toBe("ss:start-recording");
    expect(IPC.STOP_RECORDING).toBe("ss:stop-recording");
    expect(IPC.AUDIO_CHUNK).toBe("ss:audio-chunk");
    expect(IPC.PIPELINE_STATUS).toBe("ss:pipeline-status");
    expect(IPC.TOGGLE_RECORDING).toBe("ss:toggle-recording");
    expect(IPC.AUDIO_DEVICES).toBe("ss:audio-devices");
    expect(IPC.SELECT_DEVICE).toBe("ss:select-device");
  });
});

describe("TIMING constants", () => {
  it("has valid sample rate", () => {
    expect(TIMING.SAMPLE_RATE).toBe(16000);
  });

  it("has valid hold grace period", () => {
    expect(TIMING.HOLD_GRACE_MS).toBeGreaterThan(50);
    expect(TIMING.HOLD_GRACE_MS).toBeLessThan(500);
  });
});

describe("TRIGGER_KEYCODE", () => {
  it("defaults to Right Option", () => {
    expect(TRIGGER_KEYCODE).toBe(3640);
  });
});
