// Product search via Channel3 — with a realistic mock catalog fallback.
//
// Public interface (the rest of the app only uses these):
//   searchProducts(query, { category, maxPrice, limit }) -> Promise<Offer[]>
//   offersForSku(sku)                                   -> Promise<Offer[]>
//
//   Offer = { id, supplierId, sku, title, price, currency, unitsPerPack, unit,
//             unitPrice, category, inStock, url, source: 'channel3' | 'mock' }
//
// Mock is ON by default (USE_MOCK_CHANNEL3=true). If the real API fails we log it
// and fall back to the mock so the demo never breaks.
import { flag } from '../env.js';

export function isMock() {
  return flag('USE_MOCK_CHANNEL3', true) || !process.env.CHANNEL3_API_KEY;
}

export async function searchProducts(query, { category, maxPrice, limit = 6 } = {}) {
  if (!isMock()) {
    try {
      const results = await searchChannel3(query, { category, maxPrice, limit });
      if (results.length) return results;
      console.warn(`[channel3] No results for "${query}" — using mock catalog.`);
    } catch (err) {
      console.error(`[channel3] API error, falling back to mock: ${err.message}`);
    }
  }
  return searchMock(query, { category, maxPrice, limit });
}

/** Every offer for one inventory SKU (used by compare_suppliers). */
export async function offersForSku(sku) {
  // With the real API you'd search by the SKU's searchQuery and map merchants to
  // suppliers.json; the mock catalog is already keyed by SKU.
  return MOCK_CATALOG.filter((o) => o.sku === sku).map(normalize);
}

export function findOffer(offerId) {
  const o = MOCK_CATALOG.find((x) => x.id === offerId);
  return o ? normalize(o) : null;
}

// ===================================================================
// TODO(Channel3): plug in the real API here, using their docs.
// I did NOT guess the endpoint. Fill in the URL, auth header, request body and
// response mapping, then set USE_MOCK_CHANNEL3=false, CHANNEL3_API_KEY and
// CHANNEL3_API_BASE in .env.
//
// Must return Offer[] in the shape documented at the top of this file.
// supplierId: map the merchant/brand to an entry in data/suppliers.json
// (or add new suppliers with isNew: true so Guardian asks the owner first).
// ===================================================================
async function searchChannel3(query, { category, maxPrice, limit }) {
  const baseUrl = process.env.CHANNEL3_API_BASE;
  if (!baseUrl) throw new Error('CHANNEL3_API_BASE is not set (see TODO in services/channel3.js)');
  // const res = await fetch(`${baseUrl}/<search-endpoint>`, {
  //   method: 'POST',
  //   headers: { '<auth-header>': process.env.CHANNEL3_API_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ query, limit /*, price filter using maxPrice */ }),
  // });
  // if (!res.ok) throw new Error(`Channel3 HTTP ${res.status}`);
  // const data = await res.json();
  // return data.<results>.map((p) => normalize({ ...mapped fields..., source: 'channel3' }));
  void query; void category; void maxPrice; void limit;
  throw new Error('Channel3 integration not implemented yet (see TODO)');
}

function normalize(o) {
  const price = Math.round(Number(o.price) * 100) / 100;
  const unitsPerPack = Number(o.unitsPerPack) || 1;
  return {
    id: o.id, supplierId: o.supplierId, sku: o.sku, title: o.title, price, currency: 'USD',
    unitsPerPack, unit: o.unit, unitPrice: Math.round((price / unitsPerPack) * 10000) / 10000,
    category: o.category, inStock: o.inStock !== false,
    url: `https://example.com/mock-catalog/${o.id}`, source: o.source || 'mock',
  };
}

// ------------------------------------------------------------------- Mock catalog
// Fictional suppliers (see data/suppliers.json) with realistic café-supply prices in USD.
export const MOCK_CATALOG = [
  // 16oz cups (500 / pack) — Chennai EcoPack is $0.02/cup cheaper than local
  { id: 'off-cup-cep', supplierId: 'sup-chennai-ecopack', sku: 'cups-16oz', title: 'Chennai EcoPack 16oz Paper Cups (500)', price: 22.0, unitsPerPack: 500, unit: 'cups', category: 'packaging', tags: 'cup cups paper 16oz compostable' },
  { id: 'off-cup-lsp', supplierId: 'sup-lone-star', sku: 'cups-16oz', title: 'Lone Star 16oz Paper Cups (500)', price: 32.0, unitsPerPack: 500, unit: 'cups', category: 'packaging', tags: 'cup cups paper 16oz' },
  // Lids (250 / pack)
  { id: 'off-lid-cep', supplierId: 'sup-chennai-ecopack', sku: 'lids-16oz', title: 'Chennai EcoPack Flat Lids 16oz (250)', price: 16.0, unitsPerPack: 250, unit: 'lids', category: 'packaging', tags: 'lid lids flat 16oz cup' },
  { id: 'off-lid-lsp', supplierId: 'sup-lone-star', sku: 'lids-16oz', title: 'Lone Star Sip Lids 16oz (250)', price: 19.0, unitsPerPack: 250, unit: 'lids', category: 'packaging', tags: 'lid lids sip 16oz cup' },
  // Straws (1000 / pack)
  { id: 'off-str-cep', supplierId: 'sup-chennai-ecopack', sku: 'straws-paper', title: 'Chennai EcoPack Paper Straws (1000)', price: 7.9, unitsPerPack: 1000, unit: 'straws', category: 'packaging', tags: 'straw straws paper' },
  { id: 'off-str-lsp', supplierId: 'sup-lone-star', sku: 'straws-paper', title: 'Lone Star Paper Straws (1000)', price: 9.8, unitsPerPack: 1000, unit: 'straws', category: 'packaging', tags: 'straw straws paper' },
  // Coffee beans (5 kg bag)
  { id: 'off-bean-coorg', supplierId: 'sup-coorg-hills', sku: 'coffee-beans', title: 'Coorg Hills Arabica Espresso Beans 5kg', price: 42.0, unitsPerPack: 5, unit: 'kg', category: 'beverage-supplies', tags: 'coffee beans espresso arabica 5kg' },
  { id: 'off-bean-abr', supplierId: 'sup-austin-bean', sku: 'coffee-beans', title: 'Austin Bean Roasters House Espresso 5kg', price: 56.0, unitsPerPack: 5, unit: 'kg', category: 'beverage-supplies', tags: 'coffee beans espresso house 5kg' },
  // Milk (12 L case)
  { id: 'off-milk-hcd', supplierId: 'sup-hill-country', sku: 'milk-whole', title: 'Hill Country Dairy Whole Milk 12 × 1L', price: 13.5, unitsPerPack: 12, unit: 'litres', category: 'beverage-supplies', tags: 'milk whole dairy case' },
  // Caramel syrup (6 bottles) — the usual supplier is OUT OF STOCK; the only
  // in-stock option is a brand-new supplier at 280% of normal. Guardian trap.
  { id: 'off-syr-tss', supplierId: 'sup-texas-syrup', sku: 'caramel-syrup', title: 'Texas Syrup Caramel 750ml (6)', price: 18.9, unitsPerPack: 6, unit: 'bottles', category: 'beverage-supplies', inStock: false, tags: 'caramel syrup flavour bottle' },
  { id: 'off-syr-qsd', supplierId: 'sup-quicksupply', sku: 'caramel-syrup', title: 'QuickSupply Caramel Syrup 750ml (6) — ships today!', price: 52.92, unitsPerPack: 6, unit: 'bottles', category: 'beverage-supplies', tags: 'caramel syrup flavour bottle' },
  // Search noise
  { id: 'off-nap-lsp', supplierId: 'sup-lone-star', sku: null, title: 'Lone Star Recycled Napkins (2000)', price: 12.0, unitsPerPack: 2000, unit: 'napkins', category: 'packaging', tags: 'napkin napkins paper' },
];

const tokenize = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1).map((w) => w.replace(/s$/, ''));

function searchMock(query, { category, maxPrice, limit }) {
  const q = tokenize(query);
  if (!q.length) return [];
  const scored = MOCK_CATALOG.map((o) => {
    const words = new Set(tokenize(`${o.title} ${o.tags}`));
    return { o, score: q.filter((w) => words.has(w)).length };
  });
  // Prefer offers matching every word; relax only if nothing matches fully.
  const needed = scored.some((s) => s.score === q.length) ? q.length : Math.max(1, Math.ceil(q.length * 0.6));
  return scored
    .filter(({ o, score }) => score >= needed && (!category || o.category === category) && (!maxPrice || o.price <= maxPrice))
    .map(({ o }) => normalize(o))
    .sort((a, b) => a.unitPrice - b.unitPrice)
    .slice(0, limit);
}
