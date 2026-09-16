// Rule-based classification of a UPI narration: person vs merchant, and fee category.
// No model calls — users can correct anything in the results table.

const CATEGORY_KEYWORDS = [
  ['mandate',   /\b(mandate|autopay|auto ?pay|standing instruction)\b/i],
  ['capital',   /\b(zerodha|groww|upstox|angel ?one|angel ?broking|dhan\b|paytm ?money|kuvera|smallcase|iccl|indian clearing|nse ?clearing|bse ?star|mutual ?fund|\bamc\b|cams\b|kfin|coin by|5paisa|motilal|sharekhan|icici ?securities|hdfc ?securities|kotak ?securities|mf ?utilit)/i],
  ['fuel',      /\b(petrol|fuel|diesel|filling ?station|service ?station|hpcl|bpcl|iocl|indian ?oil|bharat ?petroleum|hindustan ?petroleum|nayara|shell ?india|jio-?bp|petro)/i],
  ['insurance', /\b(insurance|\blic\b|life ?ins|policybazaar|hdfc ?life|icici ?pru|sbi ?life|max ?life|star ?health|care ?health|niva ?bupa|acko\b|go ?digit|bajaj ?allianz|tata ?aia|tata ?aig|premium)/i],
  ['utility',   /\b(electricity|bescom|tangedco|tneb|msedcl|mahadiscom|bses\b|tata ?power|adani ?electricity|torrent ?power|cesc\b|kseb|apspdcl|tsspdcl|uppcl|jvvnl|water ?(board|supply)|jal ?board|bwssb|piped ?gas|indraprastha ?gas|\bigl\b|mahanagar ?gas|\bmgl\b|gail ?gas|gujarat ?gas|bill ?desk|bbps)/i],
  ['telecom',   /\b(airtel|reliance ?jio|\bjio\b|vodafone|vi ?(postpaid|prepaid)|bsnl|mtnl|act ?fibernet|hathway|recharge|tata ?play)/i],
  ['railways',  /\b(irctc|indian ?railways|railway|rail ?ticket)/i],
  ['education', /\b(school|college|university|vidyalaya|vidyapeeth|academy|institute|tuition|coaching|exam ?fee|admission|byju|unacademy)/i],
];

// VPA handles and name fragments that strongly suggest a merchant.
const MERCHANT_VPA = /(paytmqr|paytm-\d|bharatpe|\bq\d{6,}@|@okbiz|gpay-\d|razorpay|rzp|\bpayu|cashfree|billdesk|pinelabs|ezetap|mswipe|@yespay|@ikwik|\.rzp@|merchant|@axisbank.*(irctc|bill)|@hdfcbank.*(mab|merchant)|@icici.*(ims|merchant)|@ptybl|@pty)/i;
const MERCHANT_NAME = /\b(pvt|private|ltd|limited|llp|inc|store|stores|mart|supermarket|enterprises?|traders?|trading|services|solutions|technologies|retail|foods?|restaurant|cafe|hotel|bakery|pharma|pharmacy|medical|hospital|clinic|jewell?ers?|textiles?|electronics|motors|agency|agencies|industries|swiggy|zomato|zepto|blinkit|bigbasket|amazon|flipkart|myntra|nykaa|ajio|uber|ola|rapido|dmart|reliance ?(retail|smart|fresh|digital)|tata|croma|decathlon|ikea|bookmyshow|makemytrip|goibibo|cleartrip|netflix|spotify|apple ?services|google ?(play|cloud|one)|starbucks|dominos|mcdonald|kfc|pizza ?hut|burger ?king)\b/i;

export function detectCategory(text) {
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(text)) return cat;
  return 'standard';
}

/**
 * @param {string} text  narration / counterparty text
 * @param {'debit'|'credit'} direction
 * @returns {{kind:'p2m'|'p2p'|'received', category:string, confident:boolean}}
 */
export function classify(text, direction = 'debit') {
  if (direction === 'credit') return { kind: 'received', category: 'standard', confident: true };

  const category = detectCategory(text);
  if (category === 'mandate') return { kind: 'p2m', category, confident: true };

  // Explicit markers used by some banks (e.g. Axis "UPI/P2M/…", "UPI/P2A/…").
  if (/\bP2M\b/i.test(text)) return { kind: 'p2m', category, confident: true };
  if (/\b(P2P|P2A|self ?transfer|own ?account)\b/i.test(text)) return { kind: 'p2p', category, confident: true };

  if (category !== 'standard') return { kind: 'p2m', category, confident: true };
  if (MERCHANT_VPA.test(text) || MERCHANT_NAME.test(text)) return { kind: 'p2m', category, confident: true };

  // Unknown counterparty: assume a person (₹0) but flag it for review.
  return { kind: 'p2p', category, confident: false };
}
