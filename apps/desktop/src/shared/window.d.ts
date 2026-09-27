import type { MuneemApi } from '@muneem/contracts';
import type { PushEvents } from './events.js';

declare global {
  interface Window {
    muneem: MuneemApi & {
      events: { on<K extends keyof PushEvents>(channel: K, cb: (payload: PushEvents[K]) => void): () => void };
    };
  }
}
export {};
