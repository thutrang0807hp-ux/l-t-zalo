import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { dayRange } from '../core.js';
// Links, photos and files arrive as objects. Keep their readable parts; stickers have none.
function attachmentText(c) {
  if (!c || typeof c !== 'object') return null;
  const text = [c.title, c.description].filter((x) => typeof x === 'string' && x.trim());
  const href = typeof c.href === 'string' && /^https?:\/\//.test(c.href) ? c.href : null;
  if (!text.length && !href) return null;
  return [...(text.length ? text : ['[Đính kèm]']), ...(href ? [href] : [])].join('\n');
}
export function normalizeMessage(m) {
  if (m.type !== 1 || !m.data) return null;
  const d = m.data;
  let content = typeof d.content === 'string' ? d.content : attachmentText(d.content);
  if (!content?.trim() || !d.msgId) return null;
  let ts = Number(d.ts);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (ts < 1e12) ts *= 1000;
  const links = [
    ...new Set(
      (content.match(/https?:\/\/[^\s<>"\\]+/g) || []).filter((s) => {
        try {
          return ['https:', 'http:'].includes(new URL(s).protocol);
        } catch {
          return false;
        }
      }),
    ),
  ];
  return {
    groupId: String(m.threadId),
    msgId: String(d.msgId),
    content,
    sender: String(d.dName || d.uidFrom || 'Không rõ người gửi'),
    ts,
    links,
    replyTo: d.quote?.globalMsgId ? String(d.quote.globalMsgId) : null,
    quoteText: typeof d.quote?.msg === 'string' ? d.quote.msg : null,
  };
}
export class ZaloConnections {
  constructor(store, { factory, enabled = false, historyCount = 200, pause = 1500 } = {}) {
    this.historyCount = historyCount;
    this.pause = pause;
    this.store = store;
    this.factory =
      factory ||
      (() => import('zca-js').then(({ Zalo }) => new Zalo({ logging: false, checkUpdate: false })));
    this.enabled = enabled;
    this.live = new Map();
    this.pending = new Set();
    this.generations = new Map();
    this.cache = new Map();
    this.retries = new Map();
    this.timers = new Map();
  }
  scheduleReconnect(id) {
    const attempt = (this.retries.get(id) || 0) + 1;
    if (attempt > 8 || !existsSync(this.paths(id).session)) return;
    this.retries.set(id, attempt);
    clearTimeout(this.timers.get(id));
    const timer = setTimeout(
      () => {
        this.timers.delete(id);
        if (this.live.has(id) || this.pending.has(id) || !this.store.account(id)?.enabled) return;
        void this.connect(id)
          .catch(() => {})
          .then(() => {
            if (!this.live.has(id)) this.scheduleReconnect(id);
          });
      },
      Math.min(30000 * 2 ** (attempt - 1), 900000),
    );
    timer.unref?.();
    this.timers.set(id, timer);
  }
  paths(id) {
    if (!this.store.account(id)) throw Error('Không tìm thấy tài khoản');
    return {
      session: join(this.store.dir, id + '.session.json'),
      qr: join(this.store.dir, id + '.qr.png'),
    };
  }
  async connect(id, qr = false) {
    const a = this.store.account(id);
    if (!a || a.platform !== 'Zalo') throw Error('Chỉ hỗ trợ kết nối Zalo trong bản này');
    if (!this.enabled)
      throw Error('Bật ZALO_ENABLED trong cấu hình sau khi chấp nhận rủi ro tài khoản');
    if (!a.enabled) throw Error('Bật tài khoản trước khi kết nối');
    if (this.pending.has(id) || this.live.has(id))
      throw Error('Tài khoản đang kết nối hoặc đã kết nối');
    const paths = this.paths(id),
      generation = (this.generations.get(id) || 0) + 1;
    this.generations.set(id, generation);
    this.pending.add(id);
    this.store.status(id, 'connecting');
    try {
      const client = await this.factory();
      let api;
      let captured = null;
      if (!qr && existsSync(paths.session)) {
        this.store.status(id, 'restoring');
        api = await client.login(JSON.parse(readFileSync(paths.session, 'utf8')));
      } else {
        if (existsSync(paths.qr)) unlinkSync(paths.qr);
        this.store.status(id, 'qr_pending');
        api = await client.loginQR({ qrPath: paths.qr }, async (ev) => {
          if (this.generations.get(id) !== generation) {
            ev.actions?.abort?.();
            return;
          }
          if (ev.type === 0) {
            await ev.actions.saveToFile(paths.qr);
            chmodSync(paths.qr, 0o600);
            this.store.status(id, 'qr_pending');
          }
          if (ev.type === 1) {
            this.store.status(id, 'qr_expired');
            ev.actions.abort();
          }
          if (ev.type === 2) this.store.status(id, 'qr_scanned');
          if (ev.type === 3) {
            this.store.status(id, 'qr_declined');
            ev.actions.abort();
          }
          if (ev.type === 4) captured = ev.data;
        });
      }
      if (this.generations.get(id) !== generation) {
        api.listener.stop();
        return;
      }
      const uid = String(api.getOwnId());
      const duplicate = [...this.live.entries()].some(
        ([other, v]) => other !== id && v.uid === uid,
      );
      if (duplicate) {
        api.listener.stop();
        throw Error('duplicate');
      }
      if (captured) {
        writeFileSync(paths.session + '.tmp', JSON.stringify(captured), { mode: 0o600 });
        renameSync(paths.session + '.tmp', paths.session);
        chmodSync(paths.session, 0o600);
      }
      if (existsSync(paths.qr)) unlinkSync(paths.qr);
      this.live.set(id, { api, uid });
      this.store.db.prepare('UPDATE accounts SET uid=? WHERE id=?').run(uid, id);
      api.listener.on('message', (m) => {
        try {
          const normalized = normalizeMessage(m);
          if (normalized) this.store.ingest(id, normalized);
        } catch {
          this.store.status(id, 'receive_error');
        }
      });
      api.listener.on('connected', () => {
        if (this.live.has(id)) this.store.status(id, 'connected');
      });
      api.listener.on('connected', () => this.retries.delete(id));
      for (const event of ['disconnected', 'error'])
        api.listener.on(event, () => {
          if (this.live.has(id)) this.store.status(id, 'disconnected');
        });
      // 'closed' fires once the SDK's own short retries are used up.
      api.listener.on('closed', (code) => {
        if (this.generations.get(id) !== generation || !this.live.has(id)) return;
        this.live.delete(id);
        this.cache.delete(id);
        // Code 3000: the account was opened in Zalo Web elsewhere. Reconnecting would kick that
        // session in turn, so wait for the owner to reconnect manually.
        if (code === 3000) return this.store.status(id, 'replaced');
        this.store.status(id, 'disconnected');
        this.scheduleReconnect(id);
      });
      this.store.status(id, 'listening');
      api.listener.start({ retryOnClose: true });
    } catch {
      if (this.generations.get(id) === generation) this.store.status(id, 'login_failed');
    } finally {
      this.pending.delete(id);
    }
  }
  disconnect(id, forget = false) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.retries.delete(id);
    this.generations.set(id, (this.generations.get(id) || 0) + 1);
    const connection = this.live.get(id);
    this.live.delete(id);
    this.cache.delete(id);
    try {
      connection?.api.listener.stop();
    } catch {}
    this.store.status(id, 'disconnected');
    const p = this.paths(id);
    if (existsSync(p.qr)) unlinkSync(p.qr);
    if (forget && existsSync(p.session)) unlinkSync(p.session);
  }
  async catalog(id, refresh = false) {
    const c = this.live.get(id);
    if (!c || this.store.account(id)?.status !== 'connected')
      throw Error('Kết nối tài khoản trước để lấy danh sách nhóm');
    if (!refresh && this.cache.has(id)) return this.cache.get(id);
    const result = await c.api.getAllGroups();
    const ids = Object.keys(result.gridVerMap || {});
    const out = [];
    for (let i = 0; i < ids.length; i += 20) {
      const info = await c.api.getGroupInfo(ids.slice(i, i + 20));
      for (const [id, g] of Object.entries(info.gridInfoMap || {}))
        out.push({ id, name: g.name || id });
    }
    this.cache.set(id, out);
    return out;
  }
  async notifications(id) {
    const connection = this.live.get(id);
    if (!connection || this.store.account(id)?.status !== 'connected')
      throw Error('Kết nối Zalo trước');
    const result = await connection.api.getMute();
    const entries = result.groupChatEntries || [];
    const now = Date.now();
    return entries.map((entry) => {
      const start = Number(entry.startTime) * (Number(entry.startTime) < 1e12 ? 1000 : 1),
        duration = Number(entry.duration);
      const until = duration === -1 ? null : start + duration * 1000;
      return {
        id: String(entry.id),
        muted: duration === -1 || (Number.isFinite(until) && until > now),
        until,
      };
    });
  }
  async mute(id, groupIds, { muted, duration = -1 }) {
    if (
      typeof muted !== 'boolean' ||
      ![3600, 14400, -1].includes(duration) ||
      !Array.isArray(groupIds) ||
      !groupIds.length ||
      groupIds.length > 100 ||
      groupIds.some((g) => typeof g !== 'string')
    )
      throw Error('Lựa chọn tắt thông báo không hợp lệ');
    const ids = [...new Set(groupIds)],
      catalog = await this.catalog(id);
    if (ids.some((g) => !catalog.some((c) => c.id === g)))
      throw Error('Nhóm không thuộc tài khoản đã kết nối');
    const connection = this.live.get(id);
    const results = [];
    for (const groupId of ids) {
      try {
        await connection.api.setMute({ action: muted ? 1 : 3, duration }, groupId, 1);
        results.push({ id: groupId, ok: true });
      } catch {
        results.push({ id: groupId, ok: false });
      }
      if (ids.length > 1) await new Promise((r) => setTimeout(r, 250));
    }
    return { results, muted, duration };
  }
  // Morning scan: read each followed group's recent history instead of relying on the app having
  // listened all day. Zalo only returns the newest messages of a group (no paging back in
  // zca-js 2.2.0), so a very busy group can still miss the start of the day; that is reported.
  async syncDay(day) {
    const [start] = dayRange(day),
      covered = new Set(),
      incomplete = [];
    if (!this.enabled) return { covered, incomplete };
    for (const a of this.store.accounts().filter((a) => a.enabled && a.platform === 'Zalo')) {
      const groups = a.groups.filter((g) => g.enabled);
      if (!groups.length) continue;
      if (!this.live.has(a.id) && !this.pending.has(a.id) && existsSync(this.paths(a.id).session))
        await this.connect(a.id).catch(() => {});
      const c = this.live.get(a.id);
      if (!c) continue;
      let complete = true;
      for (const g of groups) {
        try {
          const r = await c.api.getGroupChatHistory(g.group_id, this.historyCount);
          const raw = r?.groupMsgs || [],
            messages = raw.map(normalizeMessage).filter(Boolean);
          for (const m of messages) this.store.ingest(a.id, m);
          const oldest = Math.min(...messages.map((m) => m.ts));
          if (raw.length && oldest >= start && (r.more || raw.length >= this.historyCount)) {
            complete = false;
            incomplete.push({ type: 'history', account: a.name, platform: 'Zalo', group: g.name });
          }
        } catch {
          complete = false;
          incomplete.push({
            type: 'history',
            account: a.name,
            platform: 'Zalo',
            group: g.name,
            failed: true,
          });
        }
        if (this.pause) await new Promise((r) => setTimeout(r, this.pause));
      }
      // Busy groups: page back through Zalo's message sync until the start of the day.
      const cut = incomplete.filter((w) => w.account === a.name && !w.failed);
      if (cut.length && (await this.crawlBack(a.id, start))) {
        for (const w of cut) incomplete.splice(incomplete.indexOf(w), 1);
        complete = !incomplete.some((w) => w.account === a.name);
      }
      if (complete) covered.add(a.id);
    }
    return { covered, incomplete };
  }
  // Zalo Web's own "load older messages" sync: pages of recent messages across all groups, newest
  // first. Technique adapted from openzca (MIT, github.com/darkamenosa/openzca). Returns true once
  // a page reaches back before `start`, i.e. every group's messages since then were seen.
  async crawlBack(id, start, { maxPages = 30, idleMs = 12000 } = {}) {
    const c = this.live.get(id);
    if (!c?.api.listener?.requestOldMessages) return false;
    for (let i = 0; i < 30 && this.store.account(id)?.status !== 'connected'; i++)
      await new Promise((r) => setTimeout(r, 500));
    if (this.store.account(id)?.status !== 'connected') return false;
    const listener = c.api.listener;
    return new Promise((resolve) => {
      let pages = 0,
        timer;
      const asked = new Set();
      const done = (reached) => {
        clearTimeout(timer);
        listener.off('old_messages', onPage);
        resolve(reached);
      };
      const ask = (cursor) => {
        if (cursor && asked.has(cursor)) return false;
        if (cursor) asked.add(cursor);
        pages++;
        clearTimeout(timer);
        timer = setTimeout(() => done(false), idleMs);
        listener.requestOldMessages(1, cursor);
        return true;
      };
      const onPage = (messages, type) => {
        if (type !== 1) return;
        let oldest = null;
        for (const m of messages) {
          const normalized = normalizeMessage(m);
          if (normalized) this.store.ingest(id, normalized);
          const ts = Number(m.data?.ts) * (Number(m.data?.ts) < 1e12 ? 1000 : 1);
          if (Number.isFinite(ts) && (!oldest || ts < oldest.ts)) oldest = { ts, m };
        }
        if (!oldest) return done(false);
        if (oldest.ts < start) return done(true);
        const cursor = String(oldest.m.data?.msgId || '');
        if (!cursor || pages >= maxPages || !ask(cursor)) done(false);
      };
      listener.on('old_messages', onPage);
      ask(null);
    });
  }
  // Group IDs the owner pinned in Zalo, limited to groups this account has joined.
  async pinned(id) {
    const c = this.live.get(id);
    if (!c) throw Error('Kết nối Zalo trước');
    const result = await c.api.getPinConversations(),
      groups = await this.catalog(id);
    const ids = new Set((result?.conversations || []).map((x) => String(x).replace(/^g/, '')));
    return groups.filter((g) => ids.has(g.id)).map((g) => g.id);
  }
  async restore() {
    if (!this.enabled) return;
    for (const a of this.store.accounts().filter((a) => a.enabled && a.platform === 'Zalo'))
      if (existsSync(this.paths(a.id).session)) await this.connect(a.id);
  }
  close() {
    for (const id of this.live.keys()) this.disconnect(id);
  }
}
