import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './theme.css';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import App from './App.jsx';
import { installRipple } from './lib/ripple.js';
import { setupServiceWorker } from './lib/pwa.js';

// Windows browsers can't render flag emoji (🇺🇸 shows as "US"). This adds a tiny,
// self-hosted flag-only font when (and only when) the browser needs it.
polyfillCountryFlagEmojis('Twemoji Country Flags', '/fonts/TwemojiCountryFlags.woff2');

installRipple();
setupServiceWorker();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
