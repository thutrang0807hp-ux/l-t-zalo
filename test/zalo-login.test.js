import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { createApp } from '../server.js';
const turn = () => new Promise(r => setImmediate(r));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nhatin-login-'));
  const attempts = [];
  const runtime = createApp({ dir, env: {}, zaloFactory: async () => ({
    loginQR: (options, callback) => new Promise((resolve, reject) => {
      const attempt = { callback, resolve, reject };
      attempts.push(attempt);
      callback({ type: 0, data: { image: png }, actions: { abort: () => reject(Error('aborted')) } });
    }),
  }) });
  t.after(() => {
    for (const a of runtime.store.accounts()) runtime.zalo.disconnect(a.id);
    runtime.store.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { ...runtime, dir, attempts };
}
test('enable requires consent and survives restart; QR endpoint returns SDK bytes', async t => {
  const f = fixture(t);
  const server = f.app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/api/zalo/enable', {})).status, 400);
  assert.equal(f.zalo.enabled, false);
  assert.equal((await post('/api/zalo/enable', { acceptRisk: true })).status, 200);
  assert.equal(f.store.option('zalo_enabled'), 'true');
  const a = await (await post('/api/accounts', { name: 'Test' })).json();
  assert.equal((await post(`/api/accounts/${a.id}/connect`, { qr: true })).status, 200);
  await turn();
  const qr = await fetch(base + `/api/accounts/${a.id}/qr`);
  assert.equal(qr.status, 200);
  assert.deepEqual(Buffer.from(await qr.arrayBuffer()), Buffer.from(png, 'base64'));
  const second = createApp({ dir: f.dir, env: {} });
  assert.equal(second.zalo.enabled, true);
  second.store.db.close();
});
test('replacing a pending QR aborts old login without clearing new attempt', async t => {
  const f = fixture(t); f.zalo.enabled = true;
  const a = f.store.createAccount('Test');
  const first = f.zalo.connect(a.id, true); await turn();
  f.zalo.disconnect(a.id);
  const second = f.zalo.connect(a.id, true); await turn();
  await first;
  assert.equal(f.zalo.pending.has(a.id), true);
  f.attempts[1].callback({ type: 1, actions: { abort: () => f.attempts[1].reject(Error('expired')) } });
  await second;
  assert.equal(f.store.account(a.id).status, 'qr_expired');
  assert.equal(f.zalo.pending.has(a.id), false);
});
test('confirmation persists session, starts listener and loads actual SDK group results', async t => {
  const f = fixture(t); f.zalo.enabled = true;
  const a = f.store.createAccount('Test');
  const login = f.zalo.connect(a.id, true); await turn();
  const listener = new EventEmitter();
  listener.start = () => listener.emit('connected'); listener.stop = () => {};
  const session = { cookie: [], imei: 'test', userAgent: 'test' };
  f.attempts[0].callback({ type: 4, data: session });
  f.attempts[0].resolve({ getOwnId: () => '123', listener,
    getAllGroups: async () => ({ gridVerMap: { '456': 1 } }),
    getGroupInfo: async () => ({ gridInfoMap: { '456': { name: 'Real group response' } } }),
  });
  await login;
  assert.equal(f.store.account(a.id).status, 'connected');
  assert.deepEqual(JSON.parse(readFileSync(f.zalo.paths(a.id).session)), session);
  assert.equal(existsSync(f.zalo.paths(a.id).qr), false);
  assert.deepEqual(await f.zalo.catalog(a.id), [{ id: '456', name: 'Real group response' }]);
});
