import type { DesktopCore } from "../shared/contracts";
declare global {
  interface Window {
    desktop: DesktopCore;
  }
}
