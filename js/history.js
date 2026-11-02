export const snapshot = state => structuredClone(state);
export class History {
  constructor(state) {
    this.states = [snapshot(state)];
  }
  push(state) {
    this.states.push(snapshot(state));
  }
  undo() {
    if (this.states.length > 1) this.states.pop();
    return snapshot(this.states.at(-1));
  }
  get(index) {
    return snapshot(this.states[index]);
  }
}
