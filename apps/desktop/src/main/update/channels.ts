import { UPDATE_CHANNELS, type UpdateChannel } from '@muneem/contracts';
import { getMeta, setMeta, type Db } from '@muneem/db-sqlite';

export const DEFAULT_UPDATE_BASE_URL = 'https://updates.muneem.app';
const CHANNEL_KEY = 'update_channel';

// Each channel is its own folder on the update host, with its own latest.yml.
export function channelFeedUrl(baseUrl: string, channel: UpdateChannel): string {
  return `${baseUrl.replace(/\/+$/u, '')}/${channel}`;
}

export function channelManifestUrl(baseUrl: string, channel: UpdateChannel): string {
  return `${channelFeedUrl(baseUrl, channel)}/latest.yml`;
}

export interface ChannelStore { get(): UpdateChannel; set(channel: UpdateChannel): void }

// The channel belongs to this installation, not the business, so it lives in app_meta and never syncs.
export function metaChannelStore(db: () => Db, fallback: UpdateChannel): ChannelStore {
  return {
    get: () => {
      const v = getMeta(db(), CHANNEL_KEY);
      return v && (UPDATE_CHANNELS as readonly string[]).includes(v) ? v as UpdateChannel : fallback;
    },
    set: (channel) => setMeta(db(), CHANNEL_KEY, channel),
  };
}

// A prerelease build starts on the channel its version names; everything else on stable.
export function defaultChannelFor(version: string): UpdateChannel {
  if (/-dev\b/u.test(version)) return 'dev';
  return /-(beta|rc)\b/u.test(version) ? 'beta' : 'stable';
}
