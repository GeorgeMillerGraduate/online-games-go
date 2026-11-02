import {
  stars,
  coordinate,
  intersection
} from './groups.js';
const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
export class Board {
  constructor(el, onMove, onPreview) {
    this.el = el;
    this.onMove = onMove;
    this.onPreview = onPreview;
    this.focus = 0;
    this.buttons = [];
  }
  render(state, {
    dead = new Set(),
    owners = null,
    candidates = [],
    ownership = null,
    interactive = true,
    scoring = false
  } = {}) {
    const n = state.size,
      oldFocus = document.activeElement?.dataset?.point;
    if (oldFocus !== undefined && Number(oldFocus) < n * n) this.focus = Number(oldFocus);
    this.focus = Math.min(this.focus, n * n - 1);
    this.el.replaceChildren();
    this.el.style.setProperty('--n', n);
    this.el.setAttribute('aria-label', `${n} by ${n} Go board. Arrow keys navigate; Enter places a stone.`);
    const graph = svg('svg', {
        viewBox: '0 0 1000 1000',
        'aria-hidden': 'true',
        class: 'grid-drawing'
      }),
      start = 65,
      step = 870 / (n - 1);
    for (let i = 0; i < n; i++) {
      const p = start + i * step;
      graph.append(svg('line', {
        x1: start,
        y1: p,
        x2: 935,
        y2: p
      }), svg('line', {
        x1: p,
        y1: start,
        x2: p,
        y2: 935
      }));
      for (const [x, y, text] of [
          [p, 33, 'ABCDEFGHJKLMNOPQRST' [i]],
          [p, 979, 'ABCDEFGHJKLMNOPQRST' [i]],
          [30, p + 5, n - i],
          [970, p + 5, n - i]
        ]) {
        const t = svg('text', {
          x,
          y,
          'text-anchor': 'middle'
        });
        t.textContent = text;
        graph.append(t);
      }
    }
    for (const i of stars(n)) graph.append(svg('circle', {
      cx: start + (i % n) * step,
      cy: start + Math.floor(i / n) * step,
      r: 5
    }));
    this.el.append(graph);
    this.buttons = [];
    const candidateMap = new Map();
    for (const [j, m] of candidates.slice(0, 5).entries()) try {
      const i = intersection(m.move, n);
      if (i !== null) candidateMap.set(i, j + 1);
    } catch {
      /* Malformed remote candidate is ignored. */ }
    for (let i = 0; i < n * n; i++) {
      const e = document.createElement('button'),
        c = state.board[i];
      e.type = 'button';
      e.className = 'intersection';
      e.dataset.point = i;
      e.style.left = (6.5 + (i % n) * 87 / (n - 1)) + '%';
      e.style.top = (6.5 + Math.floor(i / n) * 87 / (n - 1)) + '%';
      e.style.width = e.style.height = (87 / (n - 1) * .98) + '%';
      e.tabIndex = i === this.focus ? 0 : -1;
      e.setAttribute('aria-label', `${coordinate(i,n)}, ${c==='B'?'black stone':c==='W'?'white stone':'empty'}${dead.has(i)?', marked dead':''}${i===state.last?', last move':''}`);
      e.setAttribute('aria-disabled', String(!interactive));
      if (c) {
        e.classList.add('stone', c === 'B' ? 'black' : 'white');
        if (dead.has(i)) e.classList.add('dead');
        if (i === state.last) e.classList.add('last');
      } else {
        if (owners?.[i]) e.classList.add('territory', owners[i]);
        if (ownership && Math.abs(ownership[i]) > .15) {
          e.classList.add('ownership');
          e.style.setProperty('--ownership', ownership[i] > 0 ? 'rgba(12,25,40,.62)' : 'rgba(250,253,255,.8)');
          e.style.opacity = .3 + Math.abs(ownership[i]) * .65;
        }
        if (candidateMap.has(i)) {
          e.classList.add('suggestion');
          e.textContent = candidateMap.get(i);
        }
      }
      e.onclick = () => {
        this.focus = i;
        if (interactive) this.onMove(i);
      };
      e.onpointerenter = () => {
        if (interactive && !c && !scoring) {
          const error = this.onPreview(i);
          e.classList.add(error ? 'illegal' : state.turn === 'B' ? 'preview-black' : 'preview-white');
          e.title = error || coordinate(i, n);
        }
      };
      e.onpointerleave = () => e.classList.remove('illegal', 'preview-black', 'preview-white');
      e.onkeydown = ev => {
        let next = i;
        const x = i % n,
          y = Math.floor(i / n);
        if (ev.key === 'ArrowLeft') next = y * n + Math.max(0, x - 1);
        else if (ev.key === 'ArrowRight') next = y * n + Math.min(n - 1, x + 1);
        else if (ev.key === 'ArrowUp') next = Math.max(0, y - 1) * n + x;
        else if (ev.key === 'ArrowDown') next = Math.min(n - 1, y + 1) * n + x;
        else return;
        ev.preventDefault();
        this.buttons[this.focus].tabIndex = -1;
        this.focus = next;
        this.buttons[next].tabIndex = 0;
        this.buttons[next].focus();
      };
      this.buttons.push(e);
      this.el.append(e);
    }
    if (oldFocus !== undefined && this.buttons[Number(oldFocus)]) {
      this.focus = Number(oldFocus);
      this.buttons[this.focus].tabIndex = 0;
      this.buttons[this.focus].focus({
        preventScroll: true
      });
    }
  }
}
