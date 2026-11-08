import type { PublicTable } from './types.ts';

/**
 * Two-window mode: the control window owns the game and posts the public
 * table; display windows ask for it on load. Only PublicTable crosses the
 * channel, so a display window never holds a fleet.
 */
export type ChannelMessage = { readonly type: 'table'; readonly table: PublicTable } | { readonly type: 'hello' } | { readonly type: 'bye' };

const NAME = 'battlestrip-table';

export function openChannel(onMessage: (m: ChannelMessage) => void): { post: (m: ChannelMessage) => void; close: () => void } {
  if (typeof BroadcastChannel === 'undefined') return { post: () => undefined, close: () => undefined };
  const ch = new BroadcastChannel(NAME);
  ch.addEventListener('message', (e: MessageEvent<ChannelMessage>) => onMessage(e.data));
  return { post: (m) => ch.postMessage(m), close: () => ch.close() };
}
