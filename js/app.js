import { initCalculator } from './calculator.js';
import { initWorry } from './worry.js';

const views = document.querySelectorAll('.view');
const links = document.querySelectorAll('[data-nav]');

function route() {
  const name = location.hash === '#worry' ? 'worry' : 'pay';
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  links.forEach((a) => {
    const on = a.dataset.nav === name;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'worry') initWorry();
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
initCalculator();
window.addEventListener('hashchange', route);
route();
