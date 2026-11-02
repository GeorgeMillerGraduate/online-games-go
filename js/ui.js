export const $ = id => document.getElementById(id);
export function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
let timer;
export function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => $('toast').hidden = true, 5000);
}
export function guide() {
  if (!document.getElementById("guide-prev")) return;
  let page = 0;
  const tabs = [...document.querySelectorAll('[data-guide]')];

  function show(i) {
    page = i;
    tabs.forEach((t, j) => {
      t.classList.toggle('active', j === i);
      t.setAttribute('aria-pressed', j === i);
      $('guide-' + j).hidden = j !== i;
    });
    $('guide-prev').disabled = i === 0;
    $('guide-next').disabled = i === tabs.length - 1;
    $('guide-progress').textContent = `${i+1} / ${tabs.length}`;
  }
  tabs.forEach((t, i) => t.onclick = () => show(i));
  $('guide-prev').onclick = () => show(page - 1);
  $('guide-next').onclick = () => show(page + 1);
  show(0);
}
export function saveURL(value) {
  try {
    localStorage.setItem('jenga-go-engine', value);
  } catch {
    /* Storage can be unavailable in private browsing. */ }
}
export function loadURL() {
  try {
    return localStorage.getItem('jenga-go-engine') || '';
  } catch {
    return '';
  }
}
