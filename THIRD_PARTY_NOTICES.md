# Third-party notices

Restock is released under the [MIT License](LICENSE). It uses the free and open-source software and assets listed below. Every one is free to use. No paid fonts, icons, images or sounds are included.

## Assets shipped with the app

| Asset | Source | License | Notes |
|---|---|---|---|
| Twemoji Country Flags font (`client/public/fonts/TwemojiCountryFlags.woff2`) | [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill), a subset of Twemoji | Flag art: **CC-BY 4.0** © Twitter, Inc. and other contributors ([Twemoji](https://github.com/twitter/twemoji)). Code: MIT © TalkJS | Full license text: [client/public/fonts/LICENSE-TwemojiCountryFlags.md](client/public/fonts/LICENSE-TwemojiCountryFlags.md). Loaded only on browsers that can't draw flag emoji (Windows). |
| Inter font | [@fontsource/inter](https://fontsource.org/fonts/inter) | SIL Open Font License 1.1 | Self-hosted, bundled by Vite. |
| Lucide icons | [lucide-react](https://lucide.dev) | ISC | |
| Restock logo, favicon and app icons (`client/public/favicon.svg`, `client/public/icons/*`) | Made for this project from simple shapes | MIT (this repo) | |
| Payment-routes "world" dots | Generated in code from rough ellipses (`PaymentRoutes.jsx`) | MIT (this repo) | No map artwork is shipped. |
| UI sounds | Synthesized at runtime with the Web Audio API (`lib/sound.js`) | MIT (this repo) | No audio files. |

## Libraries (client)

| Package | License |
|---|---|
| react, react-dom | MIT |
| vite, @vitejs/plugin-react | MIT |
| tailwindcss, @tailwindcss/vite | MIT |
| framer-motion | MIT |
| ag-grid-community, ag-grid-react (Community edition) | MIT |
| ag-charts-community, ag-charts-react (Community edition) | MIT |
| canvas-confetti | ISC |
| qrcode | MIT |
| country-flag-emoji-polyfill | MIT (code) / CC-BY 4.0 (flag art) |
| @fontsource/inter | OFL-1.1 |
| lucide-react | ISC |

## Libraries (server)

| Package | License |
|---|---|
| express | MIT |
| helmet | MIT |
| zod | MIT |
| @google/genai | Apache-2.0 |
| node-cron | ISC |
| vitest (dev) | MIT |

## Tooling (dev only)

| Package | License |
|---|---|
| eslint, @eslint/js, globals | MIT |
| prettier | MIT |

## Services (not redistributed)

- **PayPal REST APIs and JS SDK** (sandbox): used under PayPal's developer terms. PayPal and the PayPal logo are trademarks of PayPal, Inc. They're used only to show the integration, through PayPal's own Smart Buttons. Restock isn't affiliated with or endorsed by PayPal.
- **Google Gemini API / Groq API** (free tiers): used under their terms of service.
