/**
 * Tiny, XSS-safe DOM helper. Strings are always inserted as text nodes —
 * never as HTML — so user-provided values (pilot name, imports) can't inject markup.
 */
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const fmt = (n) => Math.floor(n).toLocaleString('en-US');
export const $ = (s, root = document) => root.querySelector(s);

export function currency(kind, amount, opts = {}) {
  return h(`span.cur.cur-${kind}`, { title: kind === 'stardust' ? 'Stardust' : 'Void Crystals' },
    icon(kind), opts.raw ? amount : fmt(amount));
}
const SVGNS = 'http://www.w3.org/2000/svg';
/** Currency icon as inline SVG so it renders identically on every platform. */
export function icon(kind) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'cur-ico'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', kind === 'stardust' ? 'M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z' : 'M12 2l7 7.2L12 22 5 9.2z');
  path.setAttribute('fill', kind === 'stardust' ? '#FFC93C' : '#C77DFF');
  svg.append(path);
  return svg;
}
export function costLabel(cost) {
  if (!cost) return null;
  return cost.crystals ? currency('crystals', cost.crystals) : currency('stardust', cost.stardust);
}
export function rarityTag(r, RARITY) {
  return h(`span.rarity.r-${r}`, {}, RARITY[r].name);
}
export function bar(value, max, cls = '') {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h(`div.bar${cls ? '.' + cls : ''}`, {}, h('i', { style: { width: pct + '%' } }));
}
/** Animated count-up for numbers. */
export function countUp(el, to, ms = 900, prefix = '') {
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = prefix + fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export function timeUntilMidnight() {
  const now = new Date(), m = new Date(now); m.setHours(24, 0, 0, 0);
  const s = Math.floor((m - now) / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}
