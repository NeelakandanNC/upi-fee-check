import { extractFile, parseStatement } from './extract.js';
import { classify } from './classify.js';
import { CATEGORIES, KINDS, THRESHOLD, merchantFee, formatINR } from './rules.js';
import { countTo } from './anim.js';

const $ = (sel) => document.querySelector(sel);

let transactions = [];
let filter = 'all';

/* ---------- Password prompt ---------- */

function askPassword(name, wrong) {
  const dialog = $('#pw-dialog');
  const input = $('#pw-input');
  $('#pw-text').textContent = wrong
    ? `That password didn't work for ${name}. Try again.`
    : `${name} is password-protected. Enter the statement password (it stays on your device).`;
  input.value = '';
  dialog.showModal();
  input.focus();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok' && input.value ? input.value : null);
    }, { once: true });
  });
}

/* ---------- File handling ---------- */

function setBusy(msg) {
  $('#progress').hidden = !msg;
  if (msg) $('#progress-text').textContent = msg;
}

function showError(msg) {
  $('#error').hidden = !msg;
  $('#error').textContent = msg || '';
}

async function handleFiles(files) {
  files = [...files].filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/') || /\.pdf$/i.test(f.name));
  if (!files.length) { showError('Please upload a PDF or an image (PNG, JPG).'); return; }
  showError('');
  const found = [];
  const failed = [];
  for (const [i, file] of files.entries()) {
    const prefix = files.length > 1 ? `File ${i + 1} of ${files.length}: ` : '';
    try {
      setBusy(prefix + `Opening ${file.name}…`);
      const rows = await extractFile(file, { askPassword, onProgress: (m) => setBusy(prefix + m) });
      found.push(...rows);
    } catch (err) {
      console.error(err);
      failed.push(err?.name === 'PasswordException' ? `${file.name} (locked)` : file.name);
    }
  }
  setBusy(null);
  if (!found.length) {
    showError(
      (failed.length ? `Couldn't read ${failed.join(', ')}. ` : '') +
      "We didn't find any UPI payments. Try a clearer screenshot, or a bank statement PDF downloaded from net banking."
    );
    return;
  }
  if (failed.length) showError(`Skipped ${failed.join(', ')}.`);
  showResults(found);
}

/* ---------- Sample data ---------- */

const SAMPLE = `Date  Narration  Ref No  Value Dt  Withdrawal Amt  Deposit Amt  Closing Balance
01/10/26  Opening Balance  01/10/26  82,450.00
02/10/26  UPI-SWIGGY LIMITED-swiggy.rzp@axisbank-UTIB0000  428811100001  02/10/26  486.00  0.00  81,964.00
03/10/26  UPI-AMMA-amma.k@oksbi-SBIN0001234-rent  428811100002  03/10/26  25,000.00  0.00  56,964.00
04/10/26  UPI-HP PETROL PUMP KORAMANGALA-q81234567@ybl  428811100003  04/10/26  3,200.00  0.00  53,764.00
05/10/26  UPI-RAVI KUMAR-ravi.k@okaxis-UTIB-dinner split  428811100004  05/10/26  0.00  1,850.00  55,614.00
06/10/26  UPI-CROMA INFINITI RETAIL LTD-croma.pay@hdfcbank  428811100005  06/10/26  34,990.00  0.00  20,624.00
07/10/26  NEFT-ACME TECHNOLOGIES-SALARY OCT  07/10/26  0.00  1,20,000.00  1,40,624.00
08/10/26  UPI-INDIAN CLEARING CORP-iccl.mf@hdfcbank-SIP  428811100006  08/10/26  10,000.00  0.00  1,30,624.00
09/10/26  UPI-BESCOM ELECTRICITY-bescom@billdesk  428811100007  09/10/26  2,430.00  0.00  1,28,194.00
10/10/26  UPI-BLUE TOKAI COFFEE-paytmqr1x2y3z@paytm  428811100008  10/10/26  380.00  0.00  1,27,814.00
11/10/26  UPI-SHREE GANESH TRADERS-gpay-11223344@okbizaxis  428811100009  11/10/26  86,500.00  0.00  41,314.00
12/10/26  UPI-LIC OF INDIA-licpremium@axisbank  428811100010  12/10/26  12,600.00  0.00  28,714.00
13/10/26  UPI-PRIYA NAIR-priya.n@okicici-ICIC-trip  428811100011  13/10/26  6,000.00  0.00  22,714.00
14/10/26  UPI-SUNIL VEG VENDOR-9876543210@ybl  428811100012  14/10/26  2,200.00  0.00  20,514.00
15/10/26  UPI-MANDATE-NETFLIX ENTERTAINMENT-netflix@hdfcbank  428811100013  15/10/26  649.00  0.00  19,865.00
16/10/26  UPI-IRCTC-irctc.pay@axisbank-TATKAL  428811100014  16/10/26  4,120.00  0.00  15,745.00`;

function loadSample() {
  const rows = parseStatement(SAMPLE.split('\n'));
  let id = 100000;
  showResults(rows.map((r) => ({ id: ++id, source: 'Sample statement', ...r, ...classify(r.description, r.direction) })));
}

/* ---------- Results ---------- */

function showResults(rows) {
  transactions = rows;
  filter = 'all';
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.filter === 'all'));
  $('#results').hidden = false;
  render();
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const option = (value, label, selected) =>
  `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function render() {
  const withFee = transactions.map((t) => ({ ...t, fee: merchantFee(t) }));
  const debits = withFee.filter((t) => t.kind !== 'received');
  const p2p = debits.filter((t) => t.kind === 'p2p');
  const feeable = withFee.filter((t) => t.fee > 0);
  const total = feeable.reduce((s, t) => s + t.fee, 0);
  const unsure = withFee.filter((t) => !t.confident && t.kind === 'p2p' && t.amount > THRESHOLD);
  const badAmounts = withFee.filter((t) => t.amountUnsure);
  const needsLook = (t) => t.amountUnsure || (!t.confident && t.kind !== 'received');

  countTo($('#s-count'), withFee.length);
  countTo($('#s-p2p'), p2p.length);
  countTo($('#s-feeable'), feeable.length);
  countTo($('#s-merchant'), total, { format: formatINR });

  // Breakdown by category.
  const byCat = {};
  feeable.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.fee; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  $('#stack').innerHTML = cats.length
    ? cats.map(([c, v], i) => `<span style="width:${(v / total) * 100}%;animation-delay:${i * 80}ms" title="${CATEGORIES[c].label}: ${formatINR(v)}"></span>`).join('')
    : '<span class="stack-empty">No merchant fees in these payments</span>';
  $('#stack-legend').innerHTML = cats
    .map(([c, v]) => `<li><i></i>${CATEGORIES[c].label} · <strong>${formatINR(v)}</strong> <span class="zero">(${CATEGORIES[c].rule})</span></li>`)
    .join('');

  const banner = $('#review-banner');
  const notes = [];
  if (unsure.length) notes.push(`we guessed <strong>${unsure.length}</strong> payment${unsure.length > 1 ? 's' : ''} above ₹2,000 went to a person`);
  if (badAmounts.length) notes.push(`<strong>${badAmounts.length}</strong> amount${badAmounts.length > 1 ? 's' : ''} from screenshots may be misread`);
  banner.hidden = !notes.length;
  if (notes.length) {
    banner.innerHTML = `<span>Quick check: ${notes.join(', and ')}. Fix anything that's wrong right in the table.</span>
      <button class="chip" type="button" data-jump="check">Show them</button>`;
  }

  const visible = withFee.filter((t) =>
    filter === 'fee' ? t.fee > 0 : filter === 'check' ? needsLook(t) : true
  );
  $('#tx-body').innerHTML = visible.length
    ? visible.map((t) => {
        const unsureRow = needsLook(t);
        const flag = t.amountUnsure ? 'check amount' : 'check type';
        const catDisabled = t.kind !== 'p2m' ? ' disabled' : '';
        return `<tr data-id="${t.id}" class="${t.fee > 0 ? 'has-fee' : ''} ${unsureRow ? 'is-unsure' : ''}">
          <td>${esc(t.date || '—')}</td>
          <td class="desc" title="${esc(t.description)}">${esc(t.description)}${unsureRow ? `<span class="flag">${flag}</span>` : ''}<small>${esc(t.source)}</small></td>
          <td class="num"><label class="amt">${t.kind === 'received' ? '+' : ''}₹<input data-field="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${t.amount}" aria-label="Amount" /></label></td>
          <td><select data-field="kind" aria-label="Type">${Object.entries(KINDS).map(([k, l]) => option(k, l, t.kind)).join('')}</select></td>
          <td><select data-field="category" aria-label="Category"${catDisabled}>${Object.entries(CATEGORIES).map(([k, c]) => option(k, c.label, t.category)).join('')}</select></td>
          <td class="num zero">₹0</td>
          <td class="num fee ${t.fee ? '' : 'zero'}">${formatINR(t.fee)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" class="zero" style="text-align:center;padding:28px">Nothing here.</td></tr>`;
}

function setFilter(f) {
  filter = f;
  document.querySelectorAll('.filters .chip').forEach((c) => c.classList.toggle('is-on', c.dataset.filter === f));
  render();
}

/* ---------- Wiring ---------- */

export function initCalculator() {
  const dz = $('#dropzone');
  const input = $('#file-input');

  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
  dz.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  // Paste a screenshot straight from the clipboard.
  window.addEventListener('paste', (e) => {
    if (document.querySelector('#view-pay').hidden) return;
    const files = [...e.clipboardData.files];
    if (files.length) handleFiles(files);
  });

  $('#sample-btn').addEventListener('click', loadSample);
  $('#reset-btn').addEventListener('click', () => {
    $('#results').hidden = true;
    transactions = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.querySelector('.filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) setFilter(chip.dataset.filter);
  });
  $('#review-banner').addEventListener('click', (e) => {
    if (e.target.closest('[data-jump]')) setFilter('check');
  });

  $('#tx-body').addEventListener('change', (e) => {
    const field = e.target.closest('[data-field]');
    if (!field) return;
    const id = Number(field.closest('tr').dataset.id);
    const t = transactions.find((x) => x.id === id);
    if (field.dataset.field === 'amount') {
      t.amount = Math.max(0, Number(field.value) || 0);
      t.amountUnsure = false;
    } else {
      t[field.dataset.field] = field.value;
      t.confident = true;   // the user has reviewed it
    }
    render();
  });
}
