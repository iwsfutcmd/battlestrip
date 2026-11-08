import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Glyph } from '../../common/identity.tsx';
import { Msg } from '../../common/Msg.tsx';
import { acceptFleetCode, beginPlay, notice, ready, session } from '../store.ts';

interface DetectedBarcode {
  readonly rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: readonly string[] }) => BarcodeDetectorLike;

const detectorCtor = (): BarcodeDetectorCtor | undefined => (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

/**
 * M5 on the laptop: everyone scans the TV's QR code, places their ships on
 * their phone, and brings back a fleet code. Codes are typed or shown to the
 * webcam (BarcodeDetector, where the browser has it).
 */
export function Placement() {
  const s = session.value;
  const inputId = useId();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  if (!s) return null;
  const humans = s.seats.map((seat, i) => ({ seat, i })).filter((x) => x.seat.kind === 'human');
  const allReady = humans.every((h) => ready.value.includes(h.seat.id));

  return (
    <section class="handout placement">
      <h2>
        <Msg id="placement.heading" />
      </h2>
      <p>
        <Msg id="placement.scanTv" />
      </p>
      <ul class="placement-seats">
        {humans.map(({ seat, i }) => (
          <li key={seat.id} class={ready.value.includes(seat.id) ? 'is-ready' : ''}>
            <Glyph identity={i} /> <bdi>{s.names[i]}</bdi>{' '}
            <span class="muted">
              {ready.value.includes(seat.id) ? (
                <>
                  <span aria-hidden="true">✓ </span>
                  <Msg id="roster.ready" />
                </>
              ) : (
                <Msg id="placement.waiting" />
              )}
            </span>
          </li>
        ))}
      </ul>
      <form
        class="call-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (acceptFleetCode(code)) setCode('');
        }}
      >
        <label for={inputId}>
          <Msg id="placement.codeLabel" />
        </label>
        <div class="call-row">
          <input id={inputId} class="code-input code" type="text" dir="ltr" autocomplete="off" spellcheck={false} value={code} onInput={(e) => setCode(e.currentTarget.value)} />
          <button type="submit" class="primary">
            <Msg id="placement.enter" />
          </button>
        </div>
      </form>
      {detectorCtor() && (
        <button type="button" onClick={() => setScanning(!scanning)}>
          <Msg id={scanning ? 'placement.stopScan' : 'placement.scan'} />
        </button>
      )}
      {scanning && <Scanner onCode={(text) => acceptFleetCode(text) !== null} />}
      {notice.value && (
        <p class={notice.value.tone === 'error' ? 'error' : 'info'} role={notice.value.tone === 'error' ? 'alert' : 'status'}>
          <Msg id={notice.value.key} values={notice.value.values} />
        </p>
      )}
      <button type="button" class="primary big" disabled={!allReady} onClick={beginPlay}>
        <Msg id="handout.start" />
      </button>
    </section>
  );
}

/** The webcam, polled for QR codes. Stops the camera when unmounted. */
function Scanner({ onCode }: { readonly onCode: (text: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const Ctor = detectorCtor();
    if (!Ctor) return undefined;
    const detector = new Ctor({ formats: ['qr_code'] });
    let stream: MediaStream | undefined;
    let stopped = false;
    let last = '';
    const tick = async (): Promise<void> => {
      const v = video.current;
      if (stopped || !v) return;
      try {
        const [hit] = await detector.detect(v);
        if (hit && hit.rawValue !== last) {
          last = hit.rawValue;
          onCode(hit.rawValue);
        }
      } catch {
        // A frame that can't be read yet; keep polling.
      }
      setTimeout(() => void tick(), 250);
    };
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        void tick();
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return <video ref={video} class="scanner" muted playsInline />;
}
