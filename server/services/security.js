// Security headers (helmet) with a Content-Security-Policy that allows exactly what
// Restock needs: its own files, the PayPal JS SDK (Smart Buttons), and nothing else.
//
// The one inline <script> in index.html (sets the theme before first paint) is
// allowed by its SHA-256 hash, computed from the built file at startup, so no
// 'unsafe-inline' is needed for scripts.
//
// Escape hatch: SECURITY_CSP=false turns the CSP off (other headers stay on).
import fs from 'node:fs';
import crypto from 'node:crypto';
import helmet from 'helmet';
import { flag } from '../env.js';

/** Pure: sha256 CSP sources for every inline <script> (without src) in an HTML string. */
export function inlineScriptHashes(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!m[1].trim()) continue;
    out.push(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  return out;
}

const PAYPAL = ['https://*.paypal.com', 'https://*.paypalobjects.com'];

export function securityHeaders({ indexHtmlPath }) {
  let hashes = [];
  try { hashes = inlineScriptHashes(fs.readFileSync(indexHtmlPath, 'utf8')); } catch { /* no build yet (dev) */ }
  const csp = flag('SECURITY_CSP', true)
    ? {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", ...hashes, ...PAYPAL],
        // framer-motion, AG Grid and the PayPal SDK set inline styles.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', ...PAYPAL],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", ...PAYPAL],
        'frame-src': PAYPAL,
        'worker-src': ["'self'", 'blob:'], // canvas-confetti / AG Charts use blob workers
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'", ...PAYPAL],
        'frame-ancestors': ["'self'"],
        'upgrade-insecure-requests': null, // local http + phone-on-LAN testing must keep working
      },
    }
    : false;
  return helmet({
    contentSecurityPolicy: csp,
    // PayPal checkout opens popups that must be able to talk back to this page.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    // Local/LAN testing runs on plain http; Render adds HTTPS itself.
    strictTransportSecurity: false,
  });
}
