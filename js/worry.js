import { merchantFee, formatINR } from './rules.js';
import { countTo, reducedMotion } from './anim.js';

const $ = (sel) => document.querySelector(sel);

/* ---------- Data (all from official sources) ---------- */

const PERSONAS = [
  { label: '₹60 chai', amount: 60, kind: 'p2m', category: 'standard', rule: 'Payments of ₹2,000 or less carry no fee for anyone.' },
  { label: '₹5,000 to mum', amount: 5000, kind: 'p2p', category: 'standard', rule: 'Person-to-person transfers carry no fee at any amount, including to yourself.' },
  { label: '₹2,000 groceries', amount: 2000, kind: 'p2m', category: 'standard', rule: 'Exactly ₹2,000 still has no fee. The fee starts above ₹2,000.' },
  { label: '₹25,000 phone', amount: 25000, kind: 'p2m', category: 'standard', rule: '0.4% of ₹25,000.' },
  { label: '₹85,000 fridge', amount: 85000, kind: 'p2m', category: 'standard', rule: '0.4% would be ₹340, but the fee is capped at ₹300.' },
  { label: '₹3,000 petrol', amount: 3000, kind: 'p2m', category: 'fuel', rule: 'Fuel has a flat ₹5 fee above ₹2,000.' },
  { label: '₹2,400 electricity', amount: 2400, kind: 'p2m', category: 'utility', rule: 'Utility bills have a flat ₹5 fee above ₹2,000.' },
  { label: '₹10,000 SIP', amount: 10000, kind: 'p2m', category: 'capital', rule: 'Mutual funds and stocks: 0.02%, capped at ₹300.' },
  { label: '₹649 Netflix AutoPay', amount: 649, kind: 'p2m', category: 'mandate', rule: 'AutoPay mandates carry no prescribed fee.' },
  { label: 'Street vendor, ₹5,000 sale', amount: 5000, kind: 'p2p', category: 'standard', rule: 'No fee for small vendors receiving under ₹1 lakh a month (P2PM).' },
];

const BARS = [
  { label: 'Credit card', note: '1.5% – 2.5%', value: 250, from: 150, text: '₹150 – ₹250', cls: 'is-range' },
  { label: 'Debit card', note: 'up to 0.9%', value: 90, text: 'up to ₹90' },
  { label: 'UPI', note: '0.4%', value: 40, text: '₹40', cls: 'is-blue' },
  { label: 'UPI · fuel, bills, insurance', note: 'flat', value: 5, text: '₹5', cls: 'is-blue', tiny: true },
];

const COLUMNS = [
  { label: 'FY22 subsidy', value: 1389 },
  { label: 'FY23 subsidy', value: 2210 },
  { label: 'FY24 subsidy', value: 3631 },
  { label: 'FY25 subsidy*', value: 1046 },
  { label: 'Yearly running cost', value: 20000, cost: true, prefix: '~' },
];

const MYTHS = [
  { myth: 'Every UPI payment will now have a fee.', fact: 'No.', detail: 'Only payments to merchants above ₹2,000. More than 95 in 100 shop payments have no fee.', src: 'NPCI FAQ Q2, Q3' },
  { myth: 'Big payments will cost thousands in fees.', fact: 'Capped.', detail: 'The fee is 0.4% and stops at ₹300, however large the payment.', src: 'NPCI FAQ Q32' },
  { myth: 'Sending money to family will cost money.', fact: 'Free.', detail: 'Person-to-person transfers of any amount carry no fee.', src: 'NPCI FAQ Q16' },
  { myth: 'GPay and PhonePe will add a platform fee.', fact: 'Not allowed.', detail: 'UPI apps are explicitly barred from charging platform fees on UPI payments.', src: 'NPCI FAQ Q17' },
  { myth: 'My SIP and Netflix AutoPay will cost more.', fact: 'No.', detail: 'UPI mandates and AutoPay carry no prescribed fee.', src: 'NPCI FAQ Q22' },
  { myth: 'There\'s a monthly cap on free UPI payments.', fact: 'No cap.', detail: 'There are no monthly quotas on free UPI for consumers. Bank daily limits are for security only.', src: 'NPCI FAQ Q20' },
];

/* ---------- Builders ---------- */

function buildHundred() {
  const grid = $('#hundred');
  const feeIdx = new Set([45, 67, 78, 89, 99]);
  const free = ['₹20 chai', '₹40 bus', '₹150 auto', '₹230 veggies', '₹90 samosa', '₹450 dinner', '₹1,200 groceries', '₹60 parking', '₹800 medicines', '₹1,999 shoes'];
  const fee = [['₹4,500 headphones', 18], ['₹12,000 rent deposit at a PG', 48], ['₹25,000 phone', 100], ['₹60,000 laptop', 240], ['₹90,000 TV', 300]];
  let f = 0;
  const cells = [];
  for (let i = 0; i < 100; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    if (feeIdx.has(i)) {
      const [label, cost] = fee[f++];
      b.dataset.fee = '1';
      b.dataset.text = `${label}: ${formatINR(cost)} fee.`;
    } else {
      b.dataset.text = `${free[i % free.length]}: no fee.`;
    }
    b.setAttribute('aria-label', b.dataset.text);
    cells.push(b);
    grid.append(b);
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    grid.querySelectorAll('.is-picked').forEach((x) => x.classList.remove('is-picked'));
    b.classList.add('is-picked');
    $('#grid-readout').textContent = b.dataset.text;
  });
  return cells;
}

function buildPersonas() {
  const tabs = $('#persona-tabs');
  tabs.innerHTML = PERSONAS.map((p, i) => `<button type="button" role="tab" data-i="${i}">${p.label}</button>`).join('');
  const pick = (i) => {
    const p = PERSONAS[i];
    tabs.querySelectorAll('button').forEach((b, j) => {
      b.classList.toggle('is-on', j === i);
      b.setAttribute('aria-selected', j === i);
    });
    countTo($('#pc-amount'), p.amount, { format: formatINR, duration: 500 });
    countTo($('#pc-fee'), merchantFee(p), { format: formatINR, duration: 700 });
    $('#pc-rule').textContent = p.rule;
    if (window.gsap && !reducedMotion()) {
      gsap.fromTo('#pc-rule', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 });
    }
  };
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pick(Number(b.dataset.i));
  });
  pick(3);
}

function buildCurve() {
  const svg = $('#curve');
  const W = 640, H = 360, L = 56, R = 20, T = 20, B = 44;
  const maxX = 100000, maxY = 320;
  const x = (v) => L + (v / maxX) * (W - L - R);
  const y = (v) => H - B - (v / maxY) * (H - T - B);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    svg.append(n);
    return n;
  };

  [0, 100, 200, 300].forEach((v) => {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'gridline' });
    el('text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end' }, '₹' + v);
  });
  [0, 25000, 50000, 75000, 100000].forEach((v) => {
    el('text', { x: x(v), y: H - B + 22, 'text-anchor': 'middle' }, v === 0 ? '₹0' : '₹' + v / 1000 + 'k');
  });
  el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'axis' });
  el('line', { x1: L, x2: L, y1: T, y2: y(0), class: 'axis' });

  const std = el('path', { class: 'l-std', d: `M${x(0)},${y(0)} L${x(2000)},${y(0)} L${x(2000)},${y(8)} L${x(75000)},${y(300)} L${x(maxX)},${y(300)}` });
  const flat = el('path', { class: 'l-flat', d: `M${x(0)},${y(0)} L${x(2000)},${y(0)} L${x(2000)},${y(5)} L${x(maxX)},${y(5)}` });
  const cap = el('path', { class: 'l-cap', d: `M${x(2000)},${y(0.4)} L${x(maxX)},${y(20)}` });

  el('text', { x: x(75000), y: y(300) - 12, 'text-anchor': 'middle', class: 'annot' }, 'Capped at ₹300 from ₹75,000');
  el('text', { x: x(2000) + 8, y: y(0) - 56, class: 'annot' }, '↙ fee starts above ₹2,000');

  const guide = el('line', { class: 'marker-line', y1: T, y2: y(0) });
  const dot = el('circle', { r: 8, class: 'marker' });

  const range = $('#curve-range');
  const update = () => {
    const amt = Number(range.value);
    const fStd = merchantFee({ amount: amt, kind: 'p2m', category: 'standard' });
    guide.setAttribute('x1', x(amt)); guide.setAttribute('x2', x(amt));
    dot.setAttribute('cx', x(amt)); dot.setAttribute('cy', y(fStd));
    $('#curve-amt').textContent = formatINR(amt);
    $('#c-std').textContent = formatINR(fStd);
    $('#c-flat').textContent = formatINR(merchantFee({ amount: amt, kind: 'p2m', category: 'fuel' }));
    $('#c-cap').textContent = formatINR(merchantFee({ amount: amt, kind: 'p2m', category: 'capital' }));
  };
  range.addEventListener('input', update);
  update();
  return [std, flat, cap];
}

function buildBars() {
  const max = 250;
  $('#bars').innerHTML = BARS.map((b) => `
    <div class="bar-row">
      <div class="bar-label">${b.label}<small>${b.note}</small></div>
      <div class="bar-track">
        <div class="bar-fill ${b.cls || ''}" style="width:${(b.value / max) * 100}%">${b.tiny ? '' : b.text}</div>
        ${b.tiny ? `<span class="bar-out">${b.text}</span>` : ''}
      </div>
    </div>`).join('');
}

function buildColumns() {
  const host = $('#columns');
  const max = 20000;
  host.outerHTML = `
    <div class="columns-host">
      <div class="columns" id="columns">
        ${COLUMNS.map((c) => `
          <div class="col ${c.cost ? 'is-cost' : ''}">
            <span class="col-val">${c.prefix || ''}₹${c.value.toLocaleString('en-IN')} cr</span>
            <div class="col-bar" style="height:${(c.value / max) * 88}%"></div>
          </div>`).join('')}
      </div>
      <div class="columns-labels">${COLUMNS.map((c) => `<span class="col-lbl">${c.label}</span>`).join('')}</div>
    </div>`;
}

function buildMyths() {
  $('#myths').innerHTML = MYTHS.map((m) => `
    <button class="myth" type="button" aria-pressed="false">
      <div class="myth-inner">
        <div class="myth-face myth-front"><span class="myth-tag">Forward says</span><p>“${m.myth}”</p><span class="myth-src">Tap to check →</span></div>
        <div class="myth-face myth-back"><span class="myth-tag">${m.fact}</span><p>${m.detail}</p><span class="myth-src">${m.src}</span></div>
      </div>
    </button>`).join('');
  $('#myths').addEventListener('click', (e) => {
    const card = e.target.closest('.myth');
    if (!card) return;
    card.classList.toggle('is-flipped');
    card.setAttribute('aria-pressed', card.classList.contains('is-flipped'));
  });
}

function startCounters() {
  document.querySelectorAll('.big-num').forEach((n) => {
    const d = Number(n.dataset.decimals || 0);
    const pre = n.dataset.prefix || '';
    countTo(n, Number(n.dataset.count), {
      duration: 1600,
      format: (v) => pre + v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }),
    });
  });
}

/* ---------- Animation ---------- */

function animate(hundredCells, curvePaths) {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion()) {
    startCounters();
    hundredCells.forEach((c) => c.dataset.fee && c.classList.add('is-fee'));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Hero
  gsap.timeline()
    .from('.w-hero .eyebrow, .w-question', { y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' })
    .from('.w-answer span', { yPercent: 110, rotate: 8, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'back.out(1.6)' }, '-=0.2')
    .from('.w-hero-sub, .scroll-cue', { opacity: 0, y: 12, duration: 0.5 }, '-=0.3');
  gsap.to('.w-answer', {
    scale: 0.7, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.w-hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Section headings fade up
  gsap.utils.toArray('.view[data-view="worry"] section:not(.w-hero)').forEach((sec) => {
    const targets = sec.querySelectorAll('.eyebrow, h2, h2 + p, .split-copy p, .grid-copy p, .curve-copy p, .tree-copy p, .bill-copy p');
    if (!targets.length) return;
    gsap.from(targets, {
      y: 28, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: { trigger: sec, start: 'top 78%' },
    });
  });

  // Counters
  ScrollTrigger.create({ trigger: '.w-scale', start: 'top 75%', once: true, onEnter: startCounters });

  // Money flow
  const flow = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
  flow.fromTo('.flow-dot', { left: '0%' }, { left: '100%', duration: 1.4, ease: 'power2.inOut' })
      .fromTo('.flow-fee', { y: -20, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' })
      .to('.flow-fee', { opacity: 1, duration: 1.4 });
  ScrollTrigger.create({ trigger: '.w-split', start: 'top 80%', end: 'bottom top', onToggle: (s) => (s.isActive ? flow.play() : flow.pause()) });

  // 100 squares: appear from the centre, then the fee ones light up
  gsap.fromTo(hundredCells, { scale: 0, opacity: 0 }, {
    scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)',
    stagger: { each: 0.012, grid: [10, 10], from: 'center' },
    scrollTrigger: { trigger: '#hundred', start: 'top 80%' },
    onComplete: () => {
      const fee = hundredCells.filter((c) => c.dataset.fee);
      fee.forEach((c, i) => setTimeout(() => c.classList.add('is-fee'), i * 180));
      gsap.fromTo(fee, { scale: 1 }, { scale: 1.25, duration: 0.25, yoyo: true, repeat: 1, stagger: 0.18, delay: 0.05 });
    },
  });

  // Persona card
  gsap.from('.persona-tabs button', {
    y: 16, opacity: 0, duration: 0.4, stagger: 0.04,
    scrollTrigger: { trigger: '.w-persona', start: 'top 75%' },
  });
  gsap.from('.persona-card', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.persona-card', start: 'top 85%' } });

  // Fee curve draws itself with scroll
  curvePaths.forEach((p) => {
    const len = p.getTotalLength();
    const dashed = p.classList.contains('l-cap');
    if (dashed) {
      gsap.from(p, { opacity: 0, scrollTrigger: { trigger: '#curve', start: 'top 70%', end: 'center 50%', scrub: true } });
      return;
    }
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '#curve', start: 'top 80%', end: 'center 45%', scrub: 0.6 },
    });
  });
  gsap.from('#curve .annot, #curve .marker, #curve .marker-line', {
    opacity: 0, duration: 0.5, stagger: 0.15,
    scrollTrigger: { trigger: '#curve', start: 'center 55%' },
  });

  // Compare bars
  gsap.from('.bar-fill', {
    scaleX: 0, duration: 1, ease: 'power3.out', stagger: 0.15,
    scrollTrigger: { trigger: '#bars', start: 'top 75%' },
  });

  // Treemap
  gsap.from('.tm', {
    scale: 0.6, opacity: 0, duration: 0.7, ease: 'back.out(1.4)', stagger: 0.15,
    scrollTrigger: { trigger: '#treemap', start: 'top 75%' },
  });

  // Subsidy vs cost columns
  gsap.from('.col-bar', {
    scaleY: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12,
    scrollTrigger: { trigger: '.columns', start: 'top 75%' },
  });
  gsap.from('.col-val', {
    opacity: 0, y: 10, duration: 0.4, stagger: 0.12, delay: 0.5,
    scrollTrigger: { trigger: '.columns', start: 'top 75%' },
  });

  // Timeline progress
  const tl = $('#timeline');
  const bar = document.createElement('span');
  bar.className = 'tl-progress';
  tl.prepend(bar);
  gsap.to(bar, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 60%', scrub: true } });
  gsap.utils.toArray('#timeline li').forEach((li) => {
    gsap.from(li, { x: -24, opacity: 0, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 80%' } });
  });

  // Myths
  gsap.from('.myth', {
    y: 40, opacity: 0, rotateX: -20, duration: 0.6, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: '#myths', start: 'top 80%' },
  });

  // Verdict
  gsap.from('.verdict-list li', {
    x: -30, opacity: 0, duration: 0.6, stagger: 0.15,
    scrollTrigger: { trigger: '.w-verdict', start: 'top 70%' },
  });
}

let started = false;
export function initWorry() {
  if (started) { window.ScrollTrigger?.refresh(); return; }
  started = true;
  const cells = buildHundred();
  buildPersonas();
  const paths = buildCurve();
  buildBars();
  buildColumns();
  buildMyths();
  animate(cells, paths);
  // Web fonts and late layout shift trigger positions; re-measure once settled.
  const refresh = () => window.ScrollTrigger?.refresh();
  document.fonts?.ready.then(refresh);
  if (document.readyState !== 'complete') window.addEventListener('load', refresh, { once: true });
  requestAnimationFrame(refresh);
}
