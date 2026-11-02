import {
  neighbours
} from './groups.js';
export function score(state, dead = new Set(), neutral = new Set()) {
  const b = state.board.slice(),
    removed = {
      B: 0,
      W: 0
    };
  for (const i of dead)
    if (b[i]) {
      removed[b[i]]++;
      b[i] = null;
    }
  const seen = new Set(),
    territory = {
      B: 0,
      W: 0
    },
    stones = {
      B: 0,
      W: 0
    },
    owners = Array(b.length).fill(null),
    regions = [];
  b.forEach(c => {
    if (c) stones[c]++;
  });
  for (let i = 0; i < b.length; i++)
    if (!b[i] && !seen.has(i)) {
      const region = [],
        borders = new Set(),
        todo = [i];
      seen.add(i);
      while (todo.length) {
        const p = todo.pop();
        region.push(p);
        for (const j of neighbours(p, state.size)) {
          if (b[j]) borders.add(b[j]);
          else if (!seen.has(j)) {
            seen.add(j);
            todo.push(j);
          }
        }
      }
      const owner = borders.size === 1 && !region.some(p => neutral.has(p)) ? [...borders][0] : null;
      if (owner) {
        territory[owner] += region.length;
        for (const p of region) owners[p] = owner;
      }
      regions.push(region);
    }
  const area = state.rules === 'chinese';
  const black = territory.B + (area ? stones.B : state.captures.B + removed.W),
    white = territory.W + (area ? stones.W : state.captures.W + removed.B) + state.komi;
  return {
    black,
    white,
    territory,
    stones,
    removed,
    owners,
    regions,
    result: black === white ? '0' : `${black>white?'B':'W'}+${Math.abs(black-white).toFixed(1)}`
  };
}
