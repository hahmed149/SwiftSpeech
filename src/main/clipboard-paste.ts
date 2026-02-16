import { clipboard } from "electron";
import { execFile } from "child_process";

export function pasteText(text: string): Promise<void> {
  clipboard.writeText(text);

  return new Promise((resolve, reject) => {
    const script = `
      tell application "System Events"
        keystroke "v" using command down
      end tell
    `;
    execFile("osascript", ["-e", script], (error) => {
      if (error) {
        reject(new Error(`Paste failed: ${error.message}. Ensure Accessibility permissions are granted.`));
      } else {
        resolve();
      }
    });
  });
}
