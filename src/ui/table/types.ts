import type { GameStats, PlayerId, PlayerView } from '../../engine/index.ts';
import type { WritingMode } from '../../i18n/direction.ts';
import type { LabelSystemId } from '../../i18n/labels.ts';

export interface TableSettings {
  /** The game language: a negotiated BCP 47 tag (keeps -u-nu- etc.). */
  readonly locale: string;
  /** Row label system, already fitted to the board (never mixed within an axis). */
  readonly labels: LabelSystemId;
  /** Optional second system for mixed-language tables. */
  readonly labels2: LabelSystemId | null;
  readonly writingMode: WritingMode;
  /** The dramatic pause between a call and its results. */
  readonly beatMs: number;
  readonly speech: boolean;
}

export interface PublicSeat {
  readonly id: PlayerId;
  readonly name: string;
  /** Glyph and colour index. */
  readonly identity: number;
  readonly kind: 'human' | 'bot';
}

export type TableStage = 'lobby' | 'handout' | 'placement' | 'playing' | 'over';

/**
 * Everything the shared screen may know. It is built from
 * viewFor(state, 'spectator') only, so it can be posted to another window
 * without leaking a fleet.
 */
export interface PublicTable {
  readonly stage: TableStage;
  readonly settings: TableSettings;
  readonly seats: readonly PublicSeat[];
  readonly gameCode: string;
  readonly view: PlayerView | null;
  /** Players who have their fleet image (ticks on the roster during setup). */
  readonly ready: readonly PlayerId[];
  /** The latest call's beat: results stay hidden until `revealed`. */
  readonly reveal: { readonly turn: number; readonly revealed: boolean } | null;
  /** A bot that is "choosing…". */
  readonly choosing: PlayerId | null;
  readonly stats: GameStats | null;
  /** M5: the placement page URL the TV shows as a QR code (public: game parameters only). */
  readonly invite: string | null;
}
