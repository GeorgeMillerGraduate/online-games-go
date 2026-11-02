import {
  group,
  neighbours,
  other
} from './groups.js';
export const hash = board => board.map(c => c || '.').join('');
export function tryMove(state, i) {
  const {
    board,
    size: n,
    turn,
    rules,
    positions
  } = state;
  if (!Number.isInteger(i) || i < 0 || i >= n * n) return {
    error: 'Outside the board.'
  };
  if (board[i]) return {
    error: 'That intersection is occupied.'
  };
  const next = board.slice();
  next[i] = turn;
  const captured = new Set();
  for (const j of neighbours(i, n))
    if (next[j] === other(turn)) {
      const g = group(next, j, n);
      if (!g.liberties.size)
        for (const s of g.stones) captured.add(s);
    }
  for (const j of captured) next[j] = null;
  if (!group(next, i, n).liberties.size) return {
    error: 'Suicide: this group would have no liberties.'
  };
  const key = hash(next);
  if (rules === 'japanese' && positions.length > 1 && key === positions.at(-2)) return {
    error: 'Ko: play elsewhere before recapturing.'
  };
  if (rules === 'chinese' && positions.includes(key)) return {
    error: 'Superko: that board position has already occurred.'
  };
  return {
    board: next,
    captured: captured.size,
    key
  };
}
