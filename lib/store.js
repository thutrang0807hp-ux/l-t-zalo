import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export function openStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, 'app.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS group_topics(platform TEXT NOT NULL,group_id TEXT NOT NULL,categories TEXT,PRIMARY KEY(platform,group_id));
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,platform TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'disconnected',uid TEXT,last_seen INTEGER,changed INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS followed(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,group_id TEXT NOT NULL,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,instructions TEXT NOT NULL DEFAULT '',PRIMARY KEY(account_id,group_id));
 CREATE TABLE IF NOT EXISTS received(id TEXT PRIMARY KEY,platform TEXT NOT NULL,group_id TEXT NOT NULL,msg_id TEXT NOT NULL,account_id TEXT NOT NULL,content TEXT NOT NULL,sender TEXT NOT NULL,ts INTEGER NOT NULL,links TEXT NOT NULL,received_at INTEGER NOT NULL,UNIQUE(platform,group_id,msg_id));
 CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,day TEXT NOT NULL,items TEXT NOT NULL,warnings TEXT NOT NULL,mode TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,item TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS alert_runs(id TEXT PRIMARY KEY,start INTEGER NOT NULL,end INTEGER NOT NULL,state TEXT NOT NULL,error TEXT);
 CREATE TABLE IF NOT EXISTS alert_sources(source_id TEXT PRIMARY KEY,run_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS options(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS costs(month TEXT PRIMARY KEY,amount REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS gaps(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER);
 CREATE TABLE IF NOT EXISTS sends(day TEXT PRIMARY KEY,state TEXT NOT NULL,report_id TEXT,error TEXT);
 CREATE TABLE IF NOT EXISTS telegram_views(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,platform TEXT,group_id TEXT,page INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
 INSERT OR IGNORE INTO options VALUES('hour','06:30'); INSERT OR IGNORE INTO options VALUES('send_days','[1,2,3,4,5,6,7]'); INSERT OR IGNORE INTO options VALUES('budget','5'); INSERT OR IGNORE INTO options VALUES('retention','7'); INSERT OR IGNORE INTO options VALUES('urgent','false'); INSERT OR IGNORE INTO options VALUES('alert_cursor','0'); INSERT OR IGNORE INTO options VALUES('alert_last_attempt','0'); INSERT OR IGNORE INTO options VALUES('alert_error','');`);
  if (!db.prepare('SELECT value FROM options WHERE key=?').get('legacy_costs_imported')) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spend'").get())
      db.exec(
        'INSERT INTO costs SELECT month,amount FROM spend WHERE 1 ON CONFLICT(month) DO UPDATE SET amount=MAX(costs.amount,excluded.amount)',
      );
    db.prepare('INSERT INTO options VALUES(?,?)').run('legacy_costs_imported', 'yes');
  }
  const reportColumns = db
    .prepare('PRAGMA table_info(reports)')
    .all()
    .map((c) => c.name);
  if (!reportColumns.includes('kind'))
    db.exec("ALTER TABLE reports ADD COLUMN kind TEXT NOT NULL DEFAULT 'daily'");
  if (
    !db
      .prepare('PRAGMA table_info(reports)')
      .all()
      .some((c) => c.name === 'highlights')
  )
    db.exec('ALTER TABLE reports ADD COLUMN highlights TEXT');
  if (
    !db
      .prepare('PRAGMA table_info(reports)')
      .all()
      .some((c) => c.name === 'scan')
  )
    db.exec('ALTER TABLE reports ADD COLUMN scan TEXT');
  if (
    !db
      .prepare('PRAGMA table_info(followed)')
      .all()
      .some((c) => c.name === 'since')
  )
    db.exec('ALTER TABLE followed ADD COLUMN since INTEGER NOT NULL DEFAULT 0');
  const columns = db
    .prepare('PRAGMA table_info(received)')
    .all()
    .map((c) => c.name);
  for (const [name, type] of [
    ['reply_to', 'TEXT'],
    ['quote_text', 'TEXT'],
  ])
    if (!columns.includes(name)) db.exec(`ALTER TABLE received ADD COLUMN ${name} ${type}`);
  const account = (id) => db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
  const status = (id, value) => {
    const old = account(id);
    if (!old) return;
    db.prepare('UPDATE accounts SET status=?,changed=? WHERE id=?').run(value, Date.now(), id);
    // Discord exports read history for the whole day, so being offline loses nothing there.
    if (old.platform !== 'Zalo') return;
    if (value === 'connected')
      db.prepare('UPDATE gaps SET end=? WHERE account_id=? AND end IS NULL').run(Date.now(), id);
    else if (!db.prepare('SELECT id FROM gaps WHERE account_id=? AND end IS NULL').get(id))
      db.prepare('INSERT INTO gaps VALUES(?,?,?,NULL)').run(randomUUID(), id, Date.now());
  };
  // A stopped process does not imply continuous coverage. Record the unobserved interval.
  for (const a of db.prepare('SELECT * FROM accounts').all()) {
    db.prepare('UPDATE accounts SET status=? WHERE id=?').run('disconnected', a.id);
    if (a.platform !== 'Zalo') {
      db.prepare('UPDATE gaps SET end=? WHERE account_id=? AND end IS NULL').run(Date.now(), a.id);
      continue;
    }
    if (
      a.enabled &&
      !db.prepare('SELECT id FROM gaps WHERE account_id=? AND end IS NULL').get(a.id)
    )
      db.prepare('INSERT INTO gaps VALUES(?,?,?,NULL)').run(randomUUID(), a.id, a.changed);
  }
  // 'deep': group conversations then summarize each; 'quick': one skim per group (cheaper).
  if (
    !db
      .prepare('PRAGMA table_info(followed)')
      .all()
      .some((c) => c.name === 'mode')
  )
    db.exec("ALTER TABLE followed ADD COLUMN mode TEXT NOT NULL DEFAULT 'deep'");
  for (const [name, type] of [
    ['attempts', 'INTEGER NOT NULL DEFAULT 0'],
    ['last_attempt', 'INTEGER NOT NULL DEFAULT 0'],
  ])
    if (
      !db
        .prepare('PRAGMA table_info(sends)')
        .all()
        .some((c) => c.name === name)
    )
      db.exec(`ALTER TABLE sends ADD COLUMN ${name} ${type}`);
  const accounts = () =>
    db
      .prepare('SELECT * FROM accounts ORDER BY rowid')
      .all()
      .map((a) => ({
        ...a,
        groups: db
          .prepare('SELECT * FROM followed WHERE account_id=? ORDER BY name')
          .all(a.id)
          .map((g) => {
            const row = db
              .prepare('SELECT categories FROM group_topics WHERE platform=? AND group_id=?')
              .get(a.platform, g.group_id);
            return { ...g, categories: row?.categories ? JSON.parse(row.categories) : null };
          }),
      }));
  return {
    db,
    dir,
    account,
    accounts,
    status,
    option: (key) => db.prepare('SELECT value FROM options WHERE key=?').get(key)?.value,
    createAccount(name, platform = 'Zalo') {
      const id = randomUUID();
      db.prepare('INSERT INTO accounts(id,name,platform,changed) VALUES(?,?,?,?)').run(
        id,
        name,
        platform,
        Date.now(),
      );
      status(id, 'disconnected');
      return account(id);
    },
    ingest(accountId, m) {
      const a = account(accountId);
      if (!a?.enabled) return false;
      const g = db
        .prepare('SELECT * FROM followed WHERE account_id=? AND group_id=? AND enabled=1')
        .get(accountId, m.groupId);
      if (!g) return false;
      const now = Date.now();
      db.prepare('UPDATE accounts SET last_seen=?,changed=? WHERE id=?').run(now, now, accountId);
      const result = db
        .prepare(
          'INSERT OR IGNORE INTO received(id,platform,group_id,msg_id,account_id,content,sender,ts,links,received_at,reply_to,quote_text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          randomUUID(),
          a.platform,
          m.groupId,
          m.msgId,
          accountId,
          m.content,
          m.sender,
          m.ts,
          JSON.stringify(m.links),
          now,
          m.replyTo || null,
          m.quoteText || null,
        );
      return result.changes > 0;
    },
    groups() {
      const map = new Map();
      for (const a of accounts().filter((a) => a.enabled))
        for (const g of a.groups.filter((g) => g.enabled)) {
          const key = a.platform + ':' + g.group_id;
          const old = map.get(key);
          if (old) {
            if (g.instructions && !old.instructions.includes(g.instructions))
              old.instructions += '\n' + g.instructions;
            if (g.mode === 'deep') old.mode = 'deep';
          } else
            map.set(key, {
              id: g.group_id,
              name: g.name,
              platform: a.platform,
              instructions: g.instructions,
              mode: g.mode || 'deep',
            });
        }
      return [...map.values()];
    },
    warning(start, end) {
      return db
        .prepare(
          'SELECT a.id,a.name,a.platform,g.start,g.end FROM gaps g JOIN accounts a ON a.id=g.account_id WHERE g.start<? AND (g.end IS NULL OR g.end>?) AND EXISTS(SELECT 1 FROM followed f WHERE f.account_id=a.id)',
        )
        .all(end, start)
        .map((g) => ({
          accountId: g.id,
          account: g.name,
          platform: g.platform,
          start: Math.max(g.start, start),
          end: Math.min(g.end || Date.now(), end),
        }));
    },
    report(id) {
      const r = db.prepare('SELECT * FROM reports WHERE id=?').get(id);
      return r
        ? {
            ...r,
            items: JSON.parse(r.items),
            warnings: JSON.parse(r.warnings),
            highlights: r.highlights ? JSON.parse(r.highlights) : null,
            scan: r.scan ? JSON.parse(r.scan) : null,
          }
        : null;
    },
    latest() {
      const r = db
        .prepare("SELECT id FROM reports WHERE kind='daily' ORDER BY created DESC LIMIT 1")
        .get();
      return r ? this.report(r.id) : null;
    },
  };
}
