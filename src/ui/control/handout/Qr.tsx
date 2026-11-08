import { encode } from 'uqr';

/** A QR code as SVG: dark modules on white, with a quiet zone. Only ever on private screens. */
export function Qr({ text, label }: { readonly text: string; readonly label: string }) {
  const qr = encode(text, { ecc: 'M', border: 4 });
  let d = '';
  qr.data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <svg class="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={label} data-url={text} shape-rendering="crispEdges">
      <rect width={qr.size} height={qr.size} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
