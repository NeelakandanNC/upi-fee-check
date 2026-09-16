// On-device extraction: PDFs via pdf.js, screenshots/scanned pages via Tesseract.js.
// Nothing leaves the browser.

import { classify } from './classify.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

let pdfjsPromise;
function loadPdfjs() {
  pdfjsPromise ??= import(PDFJS).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return lib;
  });
  return pdfjsPromise;
}

let workerPromise;
function loadOcr() {
  workerPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT;
    s.onload = () => resolve(window.Tesseract.createWorker('eng'));
    s.onerror = () => reject(new Error('Could not load the OCR engine. Check your connection.'));
    document.head.append(s);
  });
  return workerPromise;
}

async function ocr(image, onProgress) {
  onProgress?.('Reading text from image…');
  const worker = await loadOcr();
  const { data } = await worker.recognize(image);
  return data.text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/* ---------- PDF ---------- */

async function pdfLines(file, { askPassword, onProgress }) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  task.onPassword = async (update, reason) => {
    const wrong = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD;
    const pw = await askPassword(file.name, wrong);
    if (pw == null) task.destroy();
    else update(pw);
  };
  const doc = await task.promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(`Reading page ${p} of ${doc.numPages}…`);
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    if (items.filter((i) => i.str.trim()).length < 5) {
      // Scanned page: render and OCR it.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      lines.push(...(await ocr(canvas, onProgress)));
      continue;
    }
    // Group text runs into visual rows by y position.
    const rows = new Map();
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(it);
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, row]) => {
        row.sort((a, b) => a.transform[4] - b.transform[4]);
        lines.push(row.map((i) => i.str.trim()).join('  '));
      });
  }
  return lines;
}

/* ---------- Parsing ---------- */

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const DATE_RE = new RegExp(
  String.raw`\b(\d{1,2}[\/\-.](\d{1,2}|${MONTHS})[\/\-.](\d{4}|\d{2})|\d{1,2}\s+(${MONTHS})[a-z]*,?\s+\d{2,4}|(${MONTHS})[a-z]*\s+\d{1,2},?\s+\d{4})\b`,
  'i'
);
// Statement amounts carry decimals; this keeps 12-digit UTR numbers out.
const STMT_AMOUNT_RE = /(?<![\d/])(?:₹|rs\.?|inr)?\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})(?![\d])/gi;

const toNum = (s) => parseFloat(s.replace(/[^\d.]/g, ''));
const hasAmount = (s) => { STMT_AMOUNT_RE.lastIndex = 0; return STMT_AMOUNT_RE.test(s); };
const DATE_RE_G = new RegExp(DATE_RE.source, 'gi');
const AMOUNTS_ONLY_RE = /^[\s₹,.\d]*(cr|dr)?[\s₹,.\d]*$/i;

function statementRows(lines) {
  const rows = [];
  let cur = null;
  for (const line of lines) {
    if (DATE_RE.test(line)) {           // rows without any amount are dropped later
      cur = { text: line, extra: 0 };
      rows.push(cur);
    } else if (cur && cur.extra < 3 && !DATE_RE.test(line) && (!hasAmount(line) || AMOUNTS_ONLY_RE.test(line))) {
      cur.text += ' ' + line;          // wrapped narration or a balance pushed to the next line
      cur.extra++;
    } else {
      cur = null;
    }
  }
  return rows;
}

function parseStatement(lines) {
  const out = [];
  let prevBalance = null;
  for (const { text } of statementRows(lines)) {
    const amounts = [...text.matchAll(STMT_AMOUNT_RE)].map((m) => toNum(m[1]));
    const nonZero = amounts.filter((a) => a > 0);
    if (!nonZero.length) continue;

    let amount = nonZero[0];
    let balance = null;
    let direction = null;

    if (amounts.length >= 3) {
      // Withdrawal | Deposit | Balance with a 0.00 placeholder.
      balance = amounts[amounts.length - 1];
      const [w, d] = amounts.slice(-3, -1);
      if (w > 0 && !(d > 0)) { amount = w; direction = 'debit'; }
      else if (d > 0 && !(w > 0)) { amount = d; direction = 'credit'; }
    } else if (amounts.length === 2) {
      [amount, balance] = amounts;
    }

    if (!direction && prevBalance != null && balance != null) {
      if (Math.abs(prevBalance - amount - balance) < 0.02) direction = 'debit';
      else if (Math.abs(prevBalance + amount - balance) < 0.02) direction = 'credit';
    }
    if (!direction) {
      if (/UPI\/CR|\bCR\b|\bcredit(ed)?\b|\bdeposit\b|received/i.test(text)) direction = 'credit';
      else direction = 'debit';
    }
    if (balance != null) prevBalance = balance;

    if (!/\bUPI\b/i.test(text)) continue;   // only UPI rows matter
    out.push({
      date: (text.match(DATE_RE) || [''])[0],
      description: text.replace(DATE_RE_G, '').replace(STMT_AMOUNT_RE, '').replace(/\s+/g, ' ').trim(),
      amount,
      direction,
    });
  }
  return out;
}

// UPI app screenshots (GPay / PhonePe / Paytm history or receipts).
// Tesseract rarely reads ₹ correctly: it comes back as [, {, %, = or even an extra 1/0.
const GLYPH = String.raw`₹|rs\.?|inr|[\[{(%=¥?]`;
const SHOT_AMOUNT_RE = new RegExp(String.raw`^([+-])?\s*(${GLYPH}|f|z)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(cr|dr)?$`, 'i');
const TRAIL_RE = new RegExp(String.raw`^(.*?\S)\s*([+-])?\s*(${GLYPH})\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(cr|dr)?$`, 'i');
const SHOT_INLINE_RE = /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{1,7}(?:\.\d{1,2})?)/i;
const GROUPED = /^(\d{1,3}(,\d{3})*|\d{1,2}(,\d{2})*,\d{3}|\d+)(\.\d{1,2})?$/;
const NOISE = /^(paid|received|sent|debited|credited|completed|successful|success|pending|failed|upi|today|yesterday|to|from|view|details|share|transaction|history|split|payments?)\b.*$/i;

/** Clean an OCR'd amount. `glyph` is what OCR saw in place of ₹ (if anything). */
function readAmount(raw, glyph) {
  let digits = raw.replace(/^0+(?=\d)/, '');
  let unsure = digits !== raw || !GROUPED.test(digits);
  const misread = glyph != null && !/^(₹|rs\.?|inr)$/i.test(glyph);
  // "₹3,640" often becomes "[13,640": if dropping a leading 1/2/7 still leaves a valid number, flag it.
  if (misread && /^[127]/.test(digits) && GROUPED.test(digits.slice(1)) && digits.includes(',')) unsure = true;
  return { amount: toNum(digits), amountUnsure: unsure };
}

function parseScreenshot(lines) {
  const out = [];
  let prevAmountIdx = -1;
  lines.forEach((line, i) => {
    let m, sign = '', name = '', parsed;
    if ((m = line.match(SHOT_AMOUNT_RE))) {
      sign = m[1] || (m[4] && m[4].toLowerCase() === 'cr' ? '+' : '');
      parsed = readAmount(m[3], m[2] ?? null);
      // A bare number with no currency sign needs "paid/received" nearby to count as money.
      if (!m[1] && !m[2] && !/paid|received|sent/i.test(lines.slice(Math.max(0, i - 3), i).join(' '))) return;
    } else if ((m = line.match(TRAIL_RE))) {
      name = m[1];
      sign = m[2] || (m[5] && m[5].toLowerCase() === 'cr' ? '+' : '');
      parsed = readAmount(m[4], m[3]);
    } else if ((m = line.match(SHOT_INLINE_RE))) {
      name = line.replace(SHOT_INLINE_RE, '');
      sign = /^\s*\+/.test(line) ? '+' : '';
      parsed = readAmount(m[1], '₹');
    } else return;
    if (!(parsed.amount > 0) || /\d:\d{2}/.test(line) || DATE_RE.test(line)) return;

    // Only look back as far as the previous transaction.
    const before = lines.slice(Math.max(0, i - 3, prevAmountIdx + 1), i);
    prevAmountIdx = i;

    const window = [...before, line].join(' ');
    const credit = sign === '+' || /received from|credited|\breceived\b/i.test(window);
    const strip = (l) => l.replace(/^(paid to|sent to|received from|to|from)\s*/i, '').replace(/[+\-]\s*$/, '').trim();
    name = strip(name);
    if (!(name.length > 2 && !NOISE.test(name))) {
      name = [...before].reverse().map(strip)
        .find((l) => l.length > 2 && !NOISE.test(l) && !DATE_RE.test(l) && !SHOT_AMOUNT_RE.test(l)) || 'Unknown';
    }
    const date = (lines.slice(i, i + 2).join(' ').match(DATE_RE) || window.match(DATE_RE) || [''])[0];
    const vpa = window.match(/[\w.\-]+@[a-z]+/i);
    out.push({
      date,
      description: name + (vpa ? ` (${vpa[0]})` : ''),
      amount: parsed.amount,
      amountUnsure: parsed.amountUnsure,
      direction: credit ? 'credit' : 'debit',
    });
  });
  return out;
}

/* ---------- Public API ---------- */

let seq = 0;

export async function extractFile(file, opts = {}) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let rows;
  if (isPdf) {
    const lines = await pdfLines(file, opts);
    rows = parseStatement(lines);
    if (!rows.length) rows = parseScreenshot(lines); // e.g. an exported receipt PDF
  } else {
    const lines = await ocr(file, opts.onProgress);
    rows = parseScreenshot(lines);
    if (!rows.length) rows = parseStatement(lines);
  }
  return rows.map((r) => ({ id: ++seq, source: file.name, ...r, ...classify(r.description, r.direction) }));
}

export { parseStatement, parseScreenshot };
