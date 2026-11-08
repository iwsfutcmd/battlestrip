import { toSegments, type MessageKey, type MessageValues } from '../../i18n/index.ts';
import { useTranslator } from './locale-state.ts';

export interface MsgProps {
  readonly id: MessageKey;
  readonly values?: MessageValues;
}

/**
 * Render a catalog message. Placeholders the formatter isolated become
 * `<bdi>` elements, so names in any script never reorder the text around them.
 */
export function Msg({ id, values }: MsgProps) {
  const t = useTranslator();
  const segments = toSegments(t.formatToParts(id, values));
  return (
    <>
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          s.text
        ) : s.dir === 'auto' ? (
          <bdi key={i}>{s.text}</bdi>
        ) : (
          <bdi key={i} dir={s.dir}>
            {s.text}
          </bdi>
        ),
      )}
    </>
  );
}
