export type HoldEvent = "hold-start" | "hold-end";

export class HoldDetector {
  private targetDown = false;
  private tainted = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isHolding = false;

  constructor(
    private targetKeycode: number,
    private callback: (event: HoldEvent) => void,
    private graceMs: number,
  ) {}

  setTargetKeycode(keycode: number): void {
    this.targetKeycode = keycode;
    // Reset state when keycode changes
    this.targetDown = false;
    this.tainted = false;
    this.isHolding = false;
    this.clearTimer();
  }

  onKeyDown(keycode: number): void {
    if (keycode === this.targetKeycode) {
      if (this.targetDown) return; // ignore key repeat
      this.targetDown = true;
      this.tainted = false;
      this.timerId = setTimeout(() => {
        if (this.targetDown && !this.tainted) {
          this.isHolding = true;
          this.callback("hold-start");
        }
      }, this.graceMs);
    } else if (this.targetDown) {
      this.tainted = true;
      this.clearTimer();
    }
  }

  onKeyUp(keycode: number): void {
    if (keycode !== this.targetKeycode) return;
    this.targetDown = false;
    this.clearTimer();
    if (this.isHolding) {
      this.isHolding = false;
      this.callback("hold-end");
    }
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  destroy(): void {
    this.clearTimer();
  }
}
