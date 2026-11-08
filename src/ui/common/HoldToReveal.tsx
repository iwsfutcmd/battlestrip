import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { MessageKey } from '../../i18n/index.ts';
import { Msg } from './Msg.tsx';

/**
 * Hidden until pressed and held (pointer, or Space/Enter held down), so a
 * neighbour can't read it over your shoulder. `always` keeps it visible.
 */
export function HoldToReveal({ labelId, always = false, children }: { readonly labelId: MessageKey; readonly always?: boolean; readonly children: ComponentChildren }) {
  const [held, setHeld] = useState(false);
  const shown = always || held;
  const hide = (): void => setHeld(false);
  return (
    <div class={`hold ${shown ? 'is-shown' : ''}`}>
      {!always && (
        <button
          type="button"
          class="hold-button"
          aria-pressed={held ? 'true' : 'false'}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setHeld(true);
          }}
          onPointerUp={hide}
          onPointerCancel={hide}
          onLostPointerCapture={hide}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setHeld(true);
            }
          }}
          onKeyUp={hide}
          onBlur={hide}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Msg id={labelId} />
        </button>
      )}
      <div class="hold-content" hidden={!shown}>
        {shown && children}
      </div>
    </div>
  );
}
