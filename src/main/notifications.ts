import { Notification } from "electron";
import { log } from "./logger";

export function notify(title: string, body: string): void {
  log(`[notify] ${title}: ${body}`);
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.show();
}
