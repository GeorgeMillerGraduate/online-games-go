export const other = c => c === 'B' ? 'W' : 'B';
export function neighbours(i, n) {
  const x = i % n,
    y = Math.floor(i / n),
    a = [];
  if (x) a.push(i - 1);
  if (x < n - 1) a.push(i + 1);
  if (y) a.push(i - n);
  if (y < n - 1) a.push(i + n);
  return a;
}
export function group(board, start, n) {
  const colour = board[start],
    stones = new Set([start]),
    liberties = new Set(),
    todo = [start];
  while (todo.length)
    for (const j of neighbours(todo.pop(), n)) {
      if (!board[j]) liberties.add(j);
      else if (board[j] === colour && !stones.has(j)) {
        stones.add(j);
        todo.push(j);
      }
    }
  return {
    stones,
    liberties
  };
}
export const coordinate = (i, n) => i === null ? 'pass' : 'ABCDEFGHJKLMNOPQRST' [i % n] + (n - Math.floor(i / n));
export function intersection(s, n) {
  if (s.toLowerCase() === 'pass') return null;
  const m = s.toUpperCase().match(/^([A-HJ-T])(\d{1,2})$/);
  if (!m) throw Error('Invalid engine coordinate');
  const x = 'ABCDEFGHJKLMNOPQRST'.indexOf(m[1]),
    y = n - Number(m[2]);
  if (x >= n || y < 0 || y >= n) throw Error('Engine coordinate outside board');
  return y * n + x;
}
export function stars(n) {
  const a = n === 9 ? [2, 6] : n === 13 ? [3, 9] : [3, 9, 15];
  const p = [];
  for (const y of a)
    for (const x of a) p.push(y * n + x);
  if (n !== 19) p.push(Math.floor(n / 2) * n + Math.floor(n / 2));
  return p;
}
export function handicapPoints(n, count) {
  if (!count) return [];
  const low = n === 9 ? 2 : 3,
    high = n - 1 - low,
    mid = (n - 1) / 2;
  const pairs = [
    [high, low],
    [low, high],
    [high, high],
    [low, low]
  ];
  if (count % 2) pairs.push([mid, mid]);
  if (count >= 6) pairs.push([low, mid], [high, mid]);
  if (count >= 8) pairs.push([mid, low], [mid, high]);
  return pairs.slice(0, count).map(([x, y]) => y * n + x);
}
