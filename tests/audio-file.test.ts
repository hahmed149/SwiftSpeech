import { describe, it, expect } from "vitest";
import { float32ToInt16, writeWav } from "../src/main/audio-file";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("float32ToInt16", () => {
  it("converts silence (zeros)", () => {
    const input = new Float32Array([0, 0, 0]);
    const output = float32ToInt16(input);
    expect(output).toEqual(new Int16Array([0, 0, 0]));
  });

  it("converts max positive", () => {
    const input = new Float32Array([1.0]);
    const output = float32ToInt16(input);
    expect(output[0]).toBe(32767); // 0x7FFF
  });

  it("converts max negative", () => {
    const input = new Float32Array([-1.0]);
    const output = float32ToInt16(input);
    expect(output[0]).toBe(-32768); // -0x8000
  });

  it("clamps values above 1.0", () => {
    const input = new Float32Array([1.5]);
    const output = float32ToInt16(input);
    expect(output[0]).toBe(32767);
  });

  it("clamps values below -1.0", () => {
    const input = new Float32Array([-1.5]);
    const output = float32ToInt16(input);
    expect(output[0]).toBe(-32768);
  });

  it("handles typical audio values", () => {
    const input = new Float32Array([0.5, -0.5, 0.25, -0.25]);
    const output = float32ToInt16(input);
    expect(output[0]).toBe(16383);   // 0.5 * 0x7FFF ≈ 16383
    expect(output[1]).toBe(-16384);  // -0.5 * 0x8000 = -16384
  });
});

describe("writeWav", () => {
  const testPath = join(tmpdir(), `tritri-test-${Date.now()}.wav`);

  it("writes a valid WAV file", () => {
    const samples = new Int16Array([0, 100, -100, 32767, -32768]);
    writeWav(testPath, samples, 16000);

    expect(existsSync(testPath)).toBe(true);

    const buffer = readFileSync(testPath);

    // Check RIFF header
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");

    // Check fmt chunk
    expect(buffer.toString("ascii", 12, 16)).toBe("fmt ");
    expect(buffer.readUInt16LE(20)).toBe(1);     // PCM format
    expect(buffer.readUInt16LE(22)).toBe(1);     // 1 channel
    expect(buffer.readUInt32LE(24)).toBe(16000); // sample rate

    // Check data chunk
    expect(buffer.toString("ascii", 36, 40)).toBe("data");
    expect(buffer.readUInt32LE(40)).toBe(samples.length * 2); // data size

    // Check file size
    expect(buffer.length).toBe(44 + samples.length * 2);

    // Cleanup
    unlinkSync(testPath);
  });

  it("writes correct PCM data", () => {
    const samples = new Int16Array([1234, -5678]);
    writeWav(testPath, samples, 16000);

    const buffer = readFileSync(testPath);
    expect(buffer.readInt16LE(44)).toBe(1234);
    expect(buffer.readInt16LE(46)).toBe(-5678);

    unlinkSync(testPath);
  });
});
