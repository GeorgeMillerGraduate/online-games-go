import {
  other,
  handicapPoints,
  coordinate
} from './groups.js';
import {
  hash,
  tryMove
} from './rules.js';
import {
  History
} from './history.js';
export class Game {
  constructor(size = 9, rules = 'japanese', komi = 6.5, handicap = 0) {
    const board = Array(size * size).fill(null),
      initial = handicapPoints(size, handicap);
    for (const i of initial) board[i] = 'B';
    this.state = {
      size,
      rules,
      komi,
      handicap,
      initial,
      board,
      turn: handicap ? 'W' : 'B',
      captures: {
        B: 0,
        W: 0
      },
      passes: 0,
      moves: [],
      positions: [hash(board)],
      status: 'playing',
      last: null,
      result: null
    };
    this.history = new History(this.state);
  }
  play(i) {
    const s = this.state;
    if (s.status !== 'playing') throw Error('The game is not in play.');
    if (i === null) {
      s.passes++;
      s.last = null;
      s.positions.push(hash(s.board));
    } else {
      const r = tryMove(s, i);
      if (r.error) throw Error(r.error);
      s.board = r.board;
      s.captures[s.turn] += r.captured;
      s.positions.push(r.key);
      s.passes = 0;
      s.last = i;
    }
    s.moves.push([s.turn, coordinate(i, s.size)]);
    s.turn = other(s.turn);
    if (s.passes === 2) s.status = 'scoring';
    this.history.push(s);
  }
  resign() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'finished';
    this.state.result = `${other(this.state.turn)}+R`;
    this.history.push(this.state);
  }
  undo() {
    this.state = this.history.undo();
    return this.state;
  }
  finish(result) {
    this.state.status = 'finished';
    this.state.result = result;
    this.history.push(this.state);
  }
  request(visits) {
    const s = this.state;
    return {
      boardSize: s.size,
      rules: s.rules,
      komi: s.komi,
      initialStones: s.initial.map(i => ['B', coordinate(i, s.size)]),
      moves: s.moves,
      initialPlayer: s.handicap ? 'W' : 'B',
      maxVisits: visits
    };
  }
  sgf() {
    const s = this.state,
      point = i => String.fromCharCode(97 + i % s.size) + String.fromCharCode(97 + Math.floor(i / s.size));
    let t = `(;GM[1]FF[4]CA[UTF-8]AP[JengaCodeGo:1]SZ[${s.size}]KM[${s.komi}]RU[${s.rules==='japanese'?'Japanese':'Chinese'}]`;
    if (s.handicap) t += `HA[${s.handicap}]PL[W]AB` + s.initial.map(i => `[${point(i)}]`).join('');
    if (s.result) t += `RE[${s.result}]`;
    for (const [c, p] of s.moves) {
      const x = 'ABCDEFGHJKLMNOPQRST'.indexOf(p[0]),
        y = s.size - Number(p.slice(1));
      t += `;${c}[${p==='pass'?'':point(y*s.size+x)}]`;
    }
    return t + ')';
  }
}
