export function normalise(data) {
  if (!data.rootInfo || !Array.isArray(data.moveInfos)) throw Error('Invalid analysis response from engine.');
  return {
    ...data,
    moveInfos: data.moveInfos.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  };
}
export function showAnalysis(el, data) {
  el.replaceChildren();
  const r = data.rootInfo;
  const p = document.createElement('p');
  p.textContent = `Black win probability ${(r.winrate*100).toFixed(1)}% · score ${r.scoreLead>=0?'B':'W'} +${Math.abs(r.scoreLead).toFixed(1)} · ${r.visits} visits`;
  el.append(p);
  const meter = document.createElement('meter');
  meter.min = 0;
  meter.max = 1;
  meter.value = r.winrate;
  meter.setAttribute('aria-label', 'Black win probability');
  el.append(meter);
  for (const [i, m] of data.moveInfos.slice(0, 5).entries()) {
    const row = document.createElement('p');
    row.className = 'candidate';
    row.textContent = `${i+1}. ${m.move} · ${m.visits} visits · B ${(m.winrate*100).toFixed(1)}%`;
    const pv = document.createElement('small');
    pv.textContent = 'PV: ' + (m.pv || []).slice(0, 12).join(' → ');
    row.append(pv);
    el.append(row);
  }
}
