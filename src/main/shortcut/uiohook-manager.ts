import { uIOhook } from "uiohook-napi";
import { HoldDetector, HoldEvent } from "./hold-detector";
import { log } from "../logger";
import { TIMING } from "../../shared/constants";

// Modifier keycodes to log (helps user discover their preferred key)
const MODIFIER_CODES = new Set([29, 3613, 56, 3640, 42, 54, 3675, 3676, 58]);

export class UiohookManager {
  private detector: HoldDetector;
  private started = false;
  private loggedKeycodes = new Set<number>();

  constructor(triggerKeycode: number, callback: (event: HoldEvent) => void) {
    this.detector = new HoldDetector(triggerKeycode, callback, TIMING.HOLD_GRACE_MS);
    log(`Trigger key: keycode ${triggerKeycode} (hold to record, release to transcribe)`);
  }

  setTriggerKeycode(keycode: number): void {
    this.detector.setTargetKeycode(keycode);
    log(`Trigger key changed: keycode ${keycode}`);
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    uIOhook.on("keydown", (e) => {
      // Log modifier / unknown keycodes once to help key discovery
      if (MODIFIER_CODES.has(e.keycode) || e.keycode === 0 || e.keycode > 60000) {
        if (!this.loggedKeycodes.has(e.keycode)) {
          this.loggedKeycodes.add(e.keycode);
          log(`Key discovered: keycode ${e.keycode}`);
        }
      }
      this.detector.onKeyDown(e.keycode);
    });

    uIOhook.on("keyup", (e) => {
      this.detector.onKeyUp(e.keycode);
    });

    uIOhook.start();
    log("Keyboard hook started");
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    uIOhook.stop();
    this.detector.destroy();
    log("Keyboard hook stopped");
  }
}
