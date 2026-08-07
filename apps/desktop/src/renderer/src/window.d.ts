import type { GtrzDesktopApi } from '@gtrz/contracts';

declare global {
  interface Window {
    readonly gtrz: GtrzDesktopApi;
  }
}

export {};
