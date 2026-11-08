// The three agent roles. Only SCOUT is an LLM; GUARDIAN and TREASURER are code.
// "The AI decides. The code guards the money. PayPal moves it."
export const ROLES = {
  scout: { name: 'Scout', kind: 'AI', color: 'violet', job: 'Reads sales, forecasts stock, compares suppliers, proposes purchases.' },
  guardian: { name: 'Guardian', kind: 'Code', color: 'amber', job: 'Checks every proposal against the signed mandate. Its verdict is final.' },
  treasurer: { name: 'Treasurer', kind: 'Code + PayPal', color: 'emerald', job: 'Protects cash, pays via PayPal, records receipts.' },
  owner: { name: 'Pranay', kind: 'Owner', color: 'sky', job: 'Signs the mandate, approves, can pause everything.' },
  system: { name: 'System', kind: 'System', color: 'slate', job: 'Housekeeping.' },
};

// Order the rule-based Scout (and Demo mode) handles urgent items in.
// WHY fixed: Guardian's cash and weekly checks depend on what was bought first,
// so a fixed order makes the demo story identical every time:
// local auto-buy -> cross-border buy -> cash delay -> blocked trap -> approval.
export const DEMO_PRIORITY = ['milk-whole', 'cups-16oz', 'coffee-beans', 'caramel-syrup', 'lids-16oz', 'straws-paper'];
