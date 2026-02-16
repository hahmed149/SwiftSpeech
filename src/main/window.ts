import { BrowserWindow, screen } from "electron";
import { join } from "path";

let popover: BrowserWindow | null = null;
let hideTimerId: ReturnType<typeof setTimeout> | null = null;

const POPOVER_WIDTH = 160;
const POPOVER_HEIGHT = 28;
const TOP_OFFSET = 8;

export function createPopover(): BrowserWindow {
  popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    backgroundThrottling: false,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  popover.loadFile(join(__dirname, "..", "renderer", "index.html"));
  return popover;
}

export function showPopover(): void {
  if (!popover) return;
  cancelAutoHide();

  // Center horizontally on the primary display, near the top
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw } = display.workArea;
  const x = Math.round(dx + dw / 2 - POPOVER_WIDTH / 2);
  const y = dy + TOP_OFFSET;

  popover.setPosition(x, y, false);
  popover.show();
}

export function togglePopover(): void {
  if (!popover) return;
  if (popover.isVisible()) {
    popover.hide();
    cancelAutoHide();
  } else {
    showPopover();
  }
}

export function hidePopoverAfter(ms: number): void {
  cancelAutoHide();
  hideTimerId = setTimeout(() => {
    popover?.hide();
    hideTimerId = null;
  }, ms);
}

function cancelAutoHide(): void {
  if (hideTimerId) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }
}

export function getPopover(): BrowserWindow | null {
  return popover;
}
