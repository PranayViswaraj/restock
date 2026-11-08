import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR code image for a URL (e.g. "approve from your phone"). */
export default function QrCode({ url, size = 112, label }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [url, size]);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block rounded-xl bg-white p-1.5 ring-1 ring-line" title={url} aria-label={label || `Open ${url}`}>
      {src ? <img src={src} width={size} height={size} alt={label || 'QR code'} /> : <div className="skeleton" style={{ width: size, height: size }} />}
    </a>
  );
}
