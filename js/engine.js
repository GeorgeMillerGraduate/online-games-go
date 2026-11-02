export const budgets = [16, 64, 256, 1024, 4096, 10000];
export class Engine {
  constructor() {
    this.url = '';
    this.abort = null;
  }
  configure(url) {
    this.cancel();
    this.url = url.trim().replace(/\/$/, '');
    if (this.url) {
      const u = new URL(this.url);
      if (!['https:', 'http:'].includes(u.protocol)) throw Error('Use an HTTP or HTTPS engine URL.');
      if (location.protocol === 'https:' && u.protocol !== 'https:') throw Error('An HTTPS page needs an HTTPS engine server.');
    }
  }
  cancel() {
    this.abort?.abort();
    this.abort = null;
  }
  async call(path, body) {
    if (!this.url) throw Error('Connect a KataGo engine server first. Local games work without it.');
    this.cancel();
    const controller = new AbortController();
    this.abort = controller;
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const r = await fetch(this.url + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? {
          'Content-Type': 'application/json'
        } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || `Engine HTTP ${r.status}`);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw Error('Engine request cancelled or timed out.');
      if (e instanceof TypeError) throw Error('Engine unavailable. Check its address, HTTPS and allowed origin.');
      throw e;
    } finally {
      clearTimeout(timer);
      if (this.abort === controller) this.abort = null;
    }
  }
  health() {
    return this.call('/health');
  }
  analyse(request) {
    return this.call('/analyse', request);
  }
}
