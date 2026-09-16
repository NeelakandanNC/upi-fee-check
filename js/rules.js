// UPI MDR rules, per NPCI FAQ dated 15 Sep 2026 (effective 15 Oct 2026).
// MDR is paid by the merchant. Consumers always pay ₹0 (FAQ Q15–Q19, Q34).

export const EFFECTIVE_DATE = '15 Oct 2026';
export const THRESHOLD = 2000;        // "above ₹2,000" — exactly ₹2,000 is free (Q35 table)
export const STANDARD_RATE = 0.004;   // Q3
export const CAPITAL_RATE = 0.0002;   // Q37
export const CAP = 300;               // Q3, Q32, Q37
export const FLAT_FEE = 5;            // Q33, Q39–Q41

export const CATEGORIES = {
  standard:  { label: 'Shopping & services', rule: '0.4%, max ₹300' },
  fuel:      { label: 'Fuel',                rule: 'Flat ₹5' },
  insurance: { label: 'Insurance',           rule: 'Flat ₹5' },
  utility:   { label: 'Electricity, water, gas', rule: 'Flat ₹5' },
  telecom:   { label: 'Telecom',             rule: 'Flat ₹5' },
  railways:  { label: 'Railways',            rule: 'Flat ₹5' },
  // Q42 says "flat-fee structures or capped processing rates" without a number; we assume ₹5.
  education: { label: 'Education',           rule: 'Flat ₹5 (assumed)' },
  capital:   { label: 'Mutual funds & stocks', rule: '0.02%, max ₹300' },
  mandate:   { label: 'AutoPay / mandate',   rule: 'Free' },
};

export const KINDS = {
  p2m: 'Merchant',
  p2p: 'Person',
  received: 'Received',
};

/** Fee the merchant pays for one transaction. */
export function merchantFee({ amount, kind, category }) {
  if (kind !== 'p2m') return 0;                 // P2P and self-transfers are free (Q16)
  if (!(amount > THRESHOLD)) return 0;          // ≤ ₹2,000 is free (Q2)
  switch (category) {
    case 'mandate':
      return 0;                                 // Q22
    case 'capital':
      return Math.min(amount * CAPITAL_RATE, CAP);
    case 'fuel':
    case 'insurance':
    case 'utility':
    case 'telecom':
    case 'railways':
    case 'education':
      return FLAT_FEE;
    default:
      return Math.min(amount * STANDARD_RATE, CAP);
  }
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const formatINR = (n) => '₹' + inr.format(Math.round(n * 100) / 100);
