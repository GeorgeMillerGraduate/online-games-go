import { Game } from './game.js';
import { Board } from './board.js';
import { tryMove } from './rules.js';
import { group, intersection } from './groups.js';
import { score } from './scoring.js';
import { Engine, budgets } from './engine.js';
import { normalise, showAnalysis } from './analysis.js';
import {
  $, message, toast, guide, loadURL, saveURL
} from './ui.js';

const DEFAULT_ENGINE_URL = 'https://jenga-code.com/api/go';
const engine = new Engine();

let game = new Game();
let mode = 'hh';
let human = 'B';
let view = null;
let busy = false;
let running = false;
let generation = 0;
let analysis = null;
let dead = new Set();
let neutral = new Set();
let tick = null;
let engineReady = false;
let activity = 'move';

const name = colour => colour === 'B' ? 'Black' : 'White';
const mixed = () => mode === 'ha' || mode === 'ah';
const isAI = colour =>
  mode === 'aa' || (mixed() && colour !== human);

const displayed = () =>
  view === null ? game.state : game.history.get(view);

const canHuman = () =>
  view === null &&
  (!busy || activity === 'health') &&
  game.state.status === 'playing' &&
  !isAI(game.state.turn);

const board = new Board(
  $('go-board'),
  click,
  index => tryMove(displayed(), index).error
);

function invalidate() {
  generation++;
  engine.cancel();
  clearTimeout(tick);
  tick = null;
  busy = false;
  analysis = null;
  $('analysis-output').textContent =
    'Analyse this position to see fresh engine recommendations.';
}

function stop() {
  running = false;
  invalidate();
}

function reset() {
  stop();
  view = null;
  dead.clear();
  neutral.clear();

  const size = Number($('size').value);
  const rules = $('rules').value;
  const komi = Number($('komi').value);

  if (
    !Number.isFinite(komi) ||
    komi < -50 ||
    komi > 50 ||
    komi * 2 !== Math.round(komi * 2)
  ) {
    $('komi').value =
      Number($('handicap').value) ? 0.5 :
      rules === 'japanese' ? 6.5 : 7.5;
  }

  human = $('colour').value === 'random'
    ? (Math.random() < 0.5 ? 'B' : 'W')
    : $('colour').value;

  game = new Game(
    size,
    rules,
    Number($('komi').value),
    Number($('handicap').value)
  );

  board.focus = 0;
  render();
}

function render() {
  const state = displayed();
  document.body.classList.toggle('thinking', busy);
  $('turn-stone').className = 'player-stone ' + (state.turn === 'B' ? 'black' : 'white');
  $('activity-title').textContent = busy
    ? (activity === 'health' ? 'Connecting to AI' : activity === 'analysis' ? 'Analysing position' : 'AI thinking')
    : engineReady ? 'KataGo connected' : 'Local play ready';
  $('activity-detail').textContent = busy
    ? (activity === 'health' ? 'Checking the engine…' : 'Calculating the position…')
    : engineReady ? 'Ready for play and analysis' : 'AI connection available in settings';
  const live = view === null;
  const settling = live && state.status === 'scoring';

  const scoring = settling
    ? score(state, dead, neutral)
    : state.settled
      ? score(
          state,
          new Set(state.settled.dead),
          new Set(state.settled.neutral)
        )
      : null;

  board.render(state, {
    dead: settling
      ? dead
      : new Set(state.settled?.dead || []),
    owners: scoring?.owners,
    candidates: analysis?.moveInfos || [],
    ownership: $('ownership').checked
      ? analysis?.ownership
      : null,
    interactive: canHuman() || settling,
    scoring: settling
  });

  for (const colour of ['B', 'W']) {
    const prefix = colour === 'B' ? 'black' : 'white';

    $(`${prefix}-captures`).textContent =
      state.captures[colour];

    $(`${prefix}-name`).textContent =
      `${name(colour)} · ${isAI(colour) ? 'KataGo' : 'Human'}`;

    $(`${prefix}-player`).classList.toggle(
      'active-player',
      state.status === 'playing' && state.turn === colour
    );
  }

  $('white-detail').textContent = `Komi ${state.komi}`;
  $('move-number').textContent = state.moves.length;
  $('turn').textContent = name(state.turn);
  $('passes').textContent = `${state.passes} / 2`;

  $('board-caption').textContent =
    `${state.size}×${state.size} · ` +
    `${state.rules === 'japanese' ? 'Japanese' : 'Chinese'}` +
    `${state.handicap ? ` · ${state.handicap} handicap` : ''}`;

  $('game-status').textContent =
    `${live ? 'Live' : 'Reviewing'} · ${state.status}` +
    `${state.result ? ` · ${state.result}` : ''}`;

  $('settlement').hidden = !settling;

  if (scoring) {
    $('score').textContent =
      `Black ${scoring.black} · White ${scoring.white} · ` +
      scoring.result;
  }

  $('pass').disabled = !canHuman();
  $('resign').disabled = !canHuman();

  $('undo').disabled =
    !live || game.history.states.length < 2;

  $('colour').disabled = !mixed();

  $('strength').disabled =
    mode === 'hh' && !$('analysis-panel').open;

  $('ai-toggle').disabled =
    mode === 'hh' || !live || state.status !== 'playing';

  $('ai-toggle').textContent =
    running ? 'Pause AI' : 'Start AI';

  $('analyse').disabled =
    busy || settling || state.status === 'finished';

  $('connect').disabled = busy;

  $('first').disabled = view === 0;

  $('prev').disabled =
    (view ?? game.history.states.length - 1) === 0;

  $('next').disabled =
    live || view === game.history.states.length - 1;

  const history = $('history');
  history.replaceChildren();

  const moves = live ? state.moves : game.state.moves;

  moves.forEach(([colour, position], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent =
      `${index + 1}. ${name(colour)} ${position}`;

    button.classList.toggle(
      'selected',
      !live && state.moves.length === index + 1
    );

    button.onclick = () => {
      const snapshot = game.history.states.findIndex(
        entry => entry.moves.length === index + 1
      );
      if (snapshot >= 0) review(snapshot);
    };

    history.append(button);
  });

  if (!live) {
    message(
      `Reviewing position after move ${state.moves.length}. ` +
      'Return to Live to continue.'
    );
  } else if (state.status === 'finished') {
    message(`Game finished · ${state.result}`);
  } else if (settling) {
    message(
      'Two passes. Agree dead groups and neutral territory, ' +
      'then finalise.'
    );
  } else if (busy && activity !== 'health') {
    message(`Waiting for KataGo · ${name(state.turn)} to play…`);
  } else {
    message(
      `${name(state.turn)} to play.` +
      `${isAI(state.turn) && !running ? ' Start AI to continue.' : ''}`
    );
  }
}

function click(index) {
  if (game.state.status === 'scoring' && view === null) {
    const state = game.state;

    if (state.board[index]) {
      const stones = group(
        state.board,
        index,
        state.size
      ).stones;

      const remove = dead.has(index);

      for (const position of stones) {
        if (remove) dead.delete(position);
        else dead.add(position);
      }
    } else if ($('neutral').checked) {
      const scoring = score(state, dead, neutral);
      const region = scoring.regions.find(
        entry => entry.includes(index)
      );

      if (region) {
        const remove = region.some(
          position => neutral.has(position)
        );

        for (const position of region) {
          if (remove) neutral.delete(position);
          else neutral.add(position);
        }
      }
    }

    render();
    return;
  }

  if (canHuman()) play(index);
}

function play(index) {
  try {
    game.play(index);
    invalidate();
    view = null;
    dead.clear();
    neutral.clear();
    render();
    schedule();
  } catch (error) {
    message(error.message, true);
    toast(error.message);
  }
}

function schedule() {
  clearTimeout(tick);
  tick = null;

  if (
    running &&
    view === null &&
    game.state.status === 'playing' &&
    isAI(game.state.turn) &&
    !busy
  ) {
    tick = setTimeout(aiTurn, 350);
  }
}

async function requestAnalysis() {
  const state = displayed();
  const columns = 'ABCDEFGHJKLMNOPQRST';

  return normalise(await engine.analyse({
    boardSize: state.size,
    rules: state.rules,
    komi: state.komi,
    initialStones: state.initial.map(index => [
      'B',
      columns[index % state.size] +
        (state.size - Math.floor(index / state.size))
    ]),
    initialPlayer: state.handicap ? 'W' : 'B',
    moves: state.moves,
    maxVisits: budgets[Number($('strength').value)]
  }));
}

async function aiTurn() {
  if (
    !running ||
    busy ||
    view !== null ||
    game.state.status !== 'playing' ||
    !isAI(game.state.turn)
  ) {
    return;
  }

  const currentGeneration = generation;
  activity = 'move';
  busy = true;
  render();

  try {
    const data = await requestAnalysis();
    if (currentGeneration !== generation) return;

    let chosen;

    for (const candidate of data.moveInfos) {
      const index = intersection(
        candidate.move,
        game.state.size
      );

      if (
        index === null ||
        !tryMove(game.state, index).error
      ) {
        chosen = index;
        break;
      }
    }

    if (chosen === undefined) {
      throw new Error('Engine returned no legal move.');
    }

    busy = false;
    play(chosen);
  } catch (error) {
    if (currentGeneration !== generation) return;

    busy = false;
    running = false;
    render();
    message(error.message, true);
    $('engine-status').textContent = error.message;
  }
}

function review(index) {
  stop();

  view = Math.max(
    0,
    Math.min(index, game.history.states.length - 1)
  );

  dead.clear();
  neutral.clear();
  render();
}

function updateKomi() {
  $('komi').value =
    Number($('handicap').value) ? 0.5 :
    $('rules').value === 'japanese' ? 6.5 : 7.5;

  reset();
}

$('size').onchange = reset;
$('rules').onchange = updateKomi;
$('handicap').onchange = updateKomi;
$('komi').onchange = reset;
$('colour').onchange = reset;

$('strength').onchange = () => {
  invalidate();
  render();
  schedule();
};

$('new').onclick = reset;

document.querySelectorAll('[data-mode]').forEach(button => {
  button.onclick = () => {
    mode = button.dataset.mode;

    if (mode === 'ha') $('colour').value = 'B';
    if (mode === 'ah') $('colour').value = 'W';

    document.querySelectorAll('[data-mode]').forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });

    reset();
  };
});

$('pass').onclick = () => {
  if (canHuman()) play(null);
};

$('resign').onclick = () => {
  if (!canHuman()) return;
  stop();
  game.resign();
  render();
};

$('undo').onclick = () => {
  stop();
  view = null;
  dead.clear();
  neutral.clear();
  game.undo();

  if (
    mixed() &&
    game.state.status === 'playing' &&
    isAI(game.state.turn) &&
    game.history.states.length > 1
  ) {
    game.undo();
  }

  render();
};

$('ai-toggle').onclick = () => {
  if (running) {
    stop();
    render();
    return;
  }

  if (busy) {
    message('Wait for the current KataGo request to finish.');
    return;
  }

  try {
    const address =
      $('engine-url').value.trim() || DEFAULT_ENGINE_URL;

    $('engine-url').value = address;
    engine.configure(address);

    running = true;
    render();
    schedule();
  } catch (error) {
    running = false;
    message(error.message, true);
    $('engine-status').textContent = error.message;
  }
};

$('first').onclick = () => review(0);

$('prev').onclick = () => {
  review((view ?? game.history.states.length - 1) - 1);
};

$('next').onclick = () => {
  review((view ?? 0) + 1);
};

$('live').onclick = () => {
  stop();
  view = null;
  render();
};

$('finish').onclick = () => {
  stop();

  game.state.settled = {
    dead: [...dead],
    neutral: [...neutral]
  };

  game.finish(score(game.state, dead, neutral).result);
  render();
};

$('resume').onclick = () => {
  stop();
  game.state.status = 'playing';
  game.state.passes = 0;
  game.state.result = null;
  game.history.push(game.state);
  dead.clear();
  neutral.clear();
  render();
};

$('export').onclick = () => {
  const blob = new Blob(
    [game.sgf()],
    { type: 'application/x-go-sgf' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `jenga-go-${game.state.size}x${game.state.size}.sgf`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

$('engine-url').value = loadURL() || DEFAULT_ENGINE_URL;

try {
  engine.configure($('engine-url').value);
} catch {
  $('engine-url').value = DEFAULT_ENGINE_URL;
  engine.configure(DEFAULT_ENGINE_URL);
}

$('engine-status').textContent = 'Checking the KataGo server…';

$('connect').onclick = async () => {
  stop();
  activity = 'health';
  busy = true;
  render();

  const currentGeneration = generation;

  try {
    const address =
      $('engine-url').value.trim() || DEFAULT_ENGINE_URL;

    $('engine-url').value = address;
    engine.configure(address);

    const data = await engine.health();
    if (currentGeneration !== generation) return;

    if (!data.ready) {
      throw new Error(data.error || 'KataGo is not ready.');
    }

    engineReady = true;
    saveURL(engine.url);

    $('engine-status').textContent =
      `Connected · ${data.engine || 'KataGo'} · ` +
      `maximum ${data.maxVisits} visits`;

    // Connection feedback remains in the sidebar activity indicator.
  } catch (error) {
    if (currentGeneration !== generation) return;

    engineReady = false;
    $('engine-status').textContent = error.message;
    message(`KataGo connection failed: ${error.message}`, true);
  } finally {
    if (currentGeneration === generation) {
      busy = false;
      render();
    }
  }
};

$('analyse').onclick = async () => {
  stop();
  activity = 'analysis';

  const currentGeneration = generation;
  busy = true;
  render();

  try {
    const address =
      $('engine-url').value.trim() || DEFAULT_ENGINE_URL;

    $('engine-url').value = address;
    engine.configure(address);

    const data = await requestAnalysis();
    if (currentGeneration !== generation) return;

    engineReady = true;
    analysis = data;
    busy = false;
    render();
    showAnalysis($('analysis-output'), analysis);
  } catch (error) {
    if (currentGeneration !== generation) return;

    busy = false;
    render();
    message(error.message, true);
    $('analysis-output').textContent = error.message;
  }
};

$('ownership').onchange = render;

$('analysis-panel').ontoggle = () => {
  $('strength').disabled =
    mode === 'hh' && !$('analysis-panel').open;
};

$('theme').onclick = () => {
  $('play').classList.toggle('light-workspace');

  $('theme').setAttribute(
    'aria-pressed',
    String($('play').classList.contains('light-workspace'))
  );
};

$('focus').onclick = () => {
  document.body.classList.toggle('focus-mode');

  $('focus').setAttribute(
    'aria-pressed',
    String(document.body.classList.contains('focus-mode'))
  );
};

guide();
render();
$('connect').click();
// Fullscreen is presentation only; rules and engine requests stay unchanged.
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('go-board').requestFullscreen();
  } catch { message('Fullscreen is unavailable in this browser.'); }
};
