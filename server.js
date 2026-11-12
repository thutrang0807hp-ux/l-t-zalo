import express from 'express';
import { telegramConfigFile, validateTelegramConfig } from './lib/telegram-config.js';
import { aiConfigFile, validateAIConfig } from './lib/ai-config.js';
import { DiscordSource, discordChannel } from './lib/discord.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './lib/store.js';
import { ZaloConnections } from './lib/zalo.js';
import { Reports } from './lib/reports.js';
import { TelegramBot } from './lib/telegram.js';
import {
  validateGroupTopics,
  validateTopicSettings,
  groupTopics,
  topicLabel,
} from './lib/categories.js';
import { scanPreview, runScan } from './lib/scans.js';
import { validateSendDays, sendsOn } from './lib/schedule.js';
import { dayAtVN } from './core.js';
export function createApp({
  dir = process.env.DATA_DIR || 'data',
  env = process.env,
  zaloFactory,
  discordRunner,
  fetchFn = fetch,
} = {}) {
  const store = openStore(resolve(dir)),
    zalo = new ZaloConnections(store, {
      factory: zaloFactory,
      enabled: store.option('zalo_enabled') === 'true' || env.ZALO_ENABLED === 'true',
      historyCount: Number(env.ZALO_HISTORY_COUNT || 200),
    }),
    aiFile = aiConfigFile(store.dir),
    aiConfig = () => ({ ...env, ...(aiFile.load() || {}) }),
    reports = new Reports(store, { env, config: aiConfig, fetchFn }),
    telegram = new TelegramBot(store, { env, fetchFn });
  const configFile = telegramConfigFile(store.dir);
  const initialConfig = configFile.load();
  if (initialConfig)
    telegram.env = {
      ...env,
      TELEGRAM_BOT_TOKEN: initialConfig.token,
      TELEGRAM_CHAT_ID: initialConfig.chatId,
    };
  const currentTelegramConfig = () =>
    configFile.load() || { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID };
  const discord = new DiscordSource(store, { env, runner: discordRunner });
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  // Local-only app: also reject cross-origin and DNS-rebinding access.
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
      return res.status(403).json({ error: 'Chỉ truy cập ứng dụng từ máy này' });
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ' });
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
  // A daily report sent by hand counts as delivered, so the schedule neither warns nor sends it twice.
  const markSent = (report) => {
    if (report.kind !== 'daily') return;
    store.db
      .prepare(
        'INSERT INTO sends(day,state,report_id,attempts,last_attempt) VALUES(?,?,?,0,?) ON CONFLICT(day) DO UPDATE SET state=excluded.state,report_id=excluded.report_id,error=NULL',
      )
      .run(report.day, 'sent', report.id, Date.now());
  };
  const handle = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
  app.get('/api/state', (req, res) =>
    res.json({
      accounts: store.accounts(),
      topicSettings: JSON.parse(store.option('topic_settings') || '{"custom":[],"aliases":{}}'),
      bookmarks: store.db
        .prepare('SELECT id,item,created FROM bookmarks ORDER BY created DESC')
        .all()
        .map((x) => ({ ...JSON.parse(x.item), savedAt: x.created })),
      hour: store.option('hour'),
      sendDays: JSON.parse(store.option('send_days')),
      retention: Number(store.option('retention')),
      ai: !!(aiConfig().MODEL_API_KEY && aiConfig().MODEL_API_BASE_URL),
      telegram: telegram.health,
      telegramConfigured: telegram.configured(),
      zaloEnabled: zalo.enabled,
      discordConfigured: discord.configured(),
      discordBusy: discord.busy,
      spend:
        store.db.prepare('SELECT amount FROM costs WHERE month=?').get(dayAtVN().slice(0, 7))
          ?.amount || 0,
      report: store.latest(),
      reports: store.db
        .prepare(
          "SELECT id,day,created FROM reports WHERE kind='daily' ORDER BY created DESC LIMIT 30",
        )
        .all(),
      busy: reports.busy,
    }),
  );
  app.post('/api/zalo/enable', handle(async (req, res) => {
    if (req.body.acceptRisk !== true)
      throw Error('Cần xác nhận rủi ro kết nối Zalo không chính thức');
    store.db.prepare(
      'INSERT INTO options VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ).run('zalo_enabled', 'true');
    zalo.enabled = true;
    res.json({ ok: true });
  }));
  app.post(
    '/api/accounts',
    handle(async (req, res) => {
      const { name, platform = 'Zalo' } = req.body;
      if (typeof name !== 'string' || !name.trim() || name.length > 80)
        throw Error('Nhập tên tài khoản hợp lệ');
      if (!['Zalo', 'Discord'].includes(platform)) throw Error('Nguồn này chưa được tích hợp');
      if (platform === 'Discord' && store.accounts().some((a) => a.platform === 'Discord'))
        throw Error('Hiện hỗ trợ một tài khoản Discord');
      res.json(store.createAccount(name.trim(), platform));
    }),
  );
  app.post(
    '/api/discord/:id/channel',
    handle(async (req, res) => {
      const a = store.account(req.params.id);
      if (a?.platform !== 'Discord') throw Error('Chọn tài khoản Discord');
      const channel = discordChannel(req.body.link);
      const name = req.body.name;
      if (typeof name !== 'string' || !name.trim() || name.length > 120)
        throw Error('Nhập tên kênh');
      store.db
        .prepare(
          'INSERT INTO followed(account_id,group_id,name,since) VALUES(?,?,?,?) ON CONFLICT(account_id,group_id) DO UPDATE SET name=excluded.name',
        )
        .run(a.id, channel.id, name.trim(), Date.now());
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/discord/guilds',
    handle(async (req, res) => res.json(await discord.guilds())),
  );
  app.get(
    '/api/discord/guilds/:guild/channels',
    handle(async (req, res) => res.json(await discord.channels(req.params.guild))),
  );
  app.post(
    '/api/discord/:id/guilds/:guild',
    handle(async (req, res) =>
      res.json(await discord.followGuild(req.params.id, req.params.guild, req.body.ids)),
    ),
  );
  app.post(
    '/api/discord/sync',
    handle(async (req, res) =>
      res.json(await discord.sync(req.body.day || dayAtVN(new Date(Date.now() - 86400000)))),
    ),
  );
  app.post(
    '/api/accounts/:id/connect',
    handle(async (req, res) => {
      const a = store.account(req.params.id);
      if (!a) throw Error('Không thấy tài khoản');
      if (a.platform === 'Discord')
        throw Error('Discord dùng cấu hình riêng trên máy và link kênh, không đăng nhập QR');
      if (!zalo.enabled)
        throw Error('Chưa bật ZALO_ENABLED. Chạy KET-NOI-ZALO.bat và đọc cảnh báo trước');
      if (!a.enabled) throw Error('Bật tài khoản trước');
      if (zalo.pending.has(a.id)) {
        if (req.body.qr !== true) throw Error('Đang chờ đăng nhập');
        zalo.disconnect(a.id);
      }
      if (zalo.live.has(a.id)) zalo.disconnect(a.id);
      void zalo.connect(a.id, req.body.qr === true).catch(() => store.status(a.id, 'login_failed'));
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/accounts/:id/qr',
    handle(async (req, res) => {
      const p = zalo.paths(req.params.id);
      const a = store.account(req.params.id);
      if (!['qr_pending', 'qr_scanned'].includes(a.status) || !existsSync(p.qr))
        return res.sendStatus(404);
      res.type('png').sendFile(p.qr);
    }),
  );
  app.post(
    '/api/accounts/:id/toggle',
    handle(async (req, res) => {
      const a = store.account(req.params.id);
      if (!a) throw Error('Không thấy tài khoản');
      const enabled = req.body.enabled === true;
      store.db.prepare('UPDATE accounts SET enabled=? WHERE id=?').run(enabled ? 1 : 0, a.id);
      if (a.platform === 'Zalo') {
        if (!enabled) zalo.disconnect(a.id);
        else void zalo.connect(a.id).catch(() => {});
      }
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/accounts/:id/logout',
    handle(async (req, res) => {
      zalo.disconnect(req.params.id, true);
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/accounts/:id/catalog',
    handle(async (req, res) =>
      res.json(await zalo.catalog(req.params.id, req.query.refresh === 'true')),
    ),
  );
  app.get(
    '/api/accounts/:id/pinned',
    handle(async (req, res) => res.json(await zalo.pinned(req.params.id))),
  );
  app.get(
    '/api/accounts/:id/notifications',
    handle(async (req, res) => res.json(await zalo.notifications(req.params.id))),
  );
  app.post(
    '/api/accounts/:id/mute',
    handle(async (req, res) =>
      res.json(await zalo.mute(req.params.id, req.body.groupIds, req.body)),
    ),
  );
  app.post(
    '/api/accounts/:id/groups',
    handle(async (req, res) => {
      const a = store.account(req.params.id);
      if (!a) throw Error('Không thấy tài khoản');
      const ids = req.body.ids;
      if (!Array.isArray(ids) || ids.length > 1000 || ids.some((x) => typeof x !== 'string'))
        throw Error('Danh sách nhóm không hợp lệ');
      const available = await zalo.catalog(a.id);
      if (ids.some((id) => !available.some((g) => g.id === id)))
        throw Error('Nhóm không thuộc tài khoản đã kết nối');
      const db = store.db;
      db.exec('BEGIN');
      try {
        for (const old of db.prepare('SELECT group_id FROM followed WHERE account_id=?').all(a.id))
          if (!ids.includes(old.group_id))
            db.prepare('DELETE FROM followed WHERE account_id=? AND group_id=?').run(
              a.id,
              old.group_id,
            );
        for (const id of new Set(ids))
          db.prepare(
            'INSERT OR IGNORE INTO followed(account_id,group_id,name,since) VALUES(?,?,?,?)',
          ).run(a.id, id, available.find((g) => g.id === id).name, Date.now());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/accounts/:id/group',
    handle(async (req, res) => {
      const { groupId, instructions, enabled } = req.body;
      if (
        typeof groupId !== 'string' ||
        typeof instructions !== 'string' ||
        instructions.length > 2000 ||
        typeof enabled !== 'boolean'
      )
        throw Error('Yêu cầu lọc nhóm không hợp lệ');
      const categories = Object.hasOwn(req.body, 'categories')
        ? validateGroupTopics(req.body.categories)
        : undefined;
      // Omitted mode keeps the current one (e.g. the on/off checkbox does not send it).
      const mode = req.body.mode ?? null;
      if (mode !== null && !['deep', 'quick'].includes(mode))
        throw Error('Chọn cách đọc nhóm hợp lệ');
      const r = store.db
        .prepare(
          'UPDATE followed SET instructions=?,enabled=?,mode=COALESCE(?,mode) WHERE account_id=? AND group_id=?',
        )
        .run(instructions, enabled ? 1 : 0, mode, req.params.id, groupId);
      if (!r.changes) throw Error('Không thấy nhóm');
      if (categories !== undefined) {
        const a = store.account(req.params.id);
        store.db
          .prepare(
            'INSERT INTO group_topics VALUES(?,?,?) ON CONFLICT(platform,group_id) DO UPDATE SET categories=excluded.categories',
          )
          .run(a.platform, groupId, categories === null ? null : JSON.stringify(categories));
      }
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/topics/groups',
    handle(async (req, res) => {
      const { platform, groupIds } = req.body;
      const topic = validateGroupTopics([req.body.topic])[0];
      if (
        !['Zalo', 'Discord', 'Telegram'].includes(platform) ||
        topic === 'Chưa phân loại' ||
        !Array.isArray(groupIds) ||
        groupIds.length > 1000 ||
        groupIds.some((id) => typeof id !== 'string')
      )
        throw Error('Chọn chủ đề và danh sách nhóm hợp lệ');
      const all = new Map();
      for (const a of store.accounts().filter((a) => a.platform === platform))
        for (const g of a.groups) if (!all.has(g.group_id)) all.set(g.group_id, g);
      if (groupIds.some((id) => !all.has(id))) throw Error('Chỉ chọn nhóm đã có trong ứng dụng');
      const settings = JSON.parse(store.option('topic_settings') || '{"custom":[],"aliases":{}}');
      settings.custom = [...new Set([...settings.custom, topic])];
      validateTopicSettings(settings);
      const selected = new Set(groupIds),
        db = store.db;
      db.exec('BEGIN');
      try {
        for (const [id, g] of all) {
          const labels = groupTopics(g).map((label) => topicLabel(label, settings));
          const had = labels.includes(topic);
          if (had === selected.has(id)) continue;
          const next = labels.filter((label) => label !== topic && label !== 'Chưa phân loại');
          if (selected.has(id)) next.push(topic);
          validateGroupTopics(next);
          db.prepare(
            'INSERT INTO group_topics VALUES(?,?,?) ON CONFLICT(platform,group_id) DO UPDATE SET categories=excluded.categories',
          ).run(platform, id, JSON.stringify(next));
        }
        db.prepare(
          'INSERT INTO options VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        ).run('topic_settings', JSON.stringify(settings));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/topics',
    handle(async (req, res) => {
      const value = validateTopicSettings(req.body);
      store.db
        .prepare(
          'INSERT INTO options VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        )
        .run('topic_settings', JSON.stringify(value));
      res.json(value);
    }),
  );
  app.post(
    '/api/settings',
    handle(async (req, res) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(req.body.hour)) throw Error('Giờ gửi không hợp lệ');
      if (req.body.retention !== undefined && ![7, 14, 30, 90].includes(req.body.retention))
        throw Error('Chọn thời gian giữ tin 7, 14, 30 hoặc 90 ngày');
      const sendDays =
        req.body.sendDays === undefined ? undefined : validateSendDays(req.body.sendDays);
      store.db.prepare('UPDATE options SET value=? WHERE key=?').run(req.body.hour, 'hour');
      if (sendDays !== undefined)
        store.db
          .prepare('UPDATE options SET value=? WHERE key=?')
          .run(JSON.stringify(sendDays), 'send_days');
      if (req.body.retention !== undefined)
        store.db
          .prepare('UPDATE options SET value=? WHERE key=?')
          .run(String(req.body.retention), 'retention');
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/scans/preview',
    handle(async (req, res) => res.json(scanPreview(store, req.body))),
  );
  app.post(
    '/api/scans',
    handle(async (req, res) => {
      if (req.body.send === true && !telegram.configured())
        throw Error('Cấu hình Telegram trước khi quét và gửi');
      const r = await runScan(store, reports, req.body);
      if (req.body.send === true) {
        try {
          await telegram.menu(r);
        } catch {
          return res.status(200).json({
            ...r,
            deliveryError:
              'Quét đã xong nhưng gửi Telegram thất bại. Có thể gửi lại bản này, không cần gọi AI quét lại.',
          });
        }
      }
      res.json(r);
    }),
  );
  app.get('/api/scans', (req, res) =>
    res.json(
      store.db
        .prepare(
          "SELECT id,day,scan,created FROM reports WHERE kind='scan' ORDER BY created DESC LIMIT 20",
        )
        .all()
        .map((r) => ({ ...r, scan: JSON.parse(r.scan) })),
    ),
  );
  app.post(
    '/api/reports',
    handle(async (req, res) => {
      const day = req.body.day || dayAtVN(new Date(Date.now() - 86400000));
      const coverage = await zalo.syncDay(day);
      await discord.sync(day);
      const r = await reports.create(day, { coverage });
      if (req.body.send === true) {
        await telegram.menu(r);
        markSent(r);
      }
      res.json(r);
    }),
  );
  app.post(
    '/api/reports/:id/send',
    handle(async (req, res) => {
      const report = store.report(req.params.id);
      if (!report) throw Error('Không tìm thấy bản tin');
      await telegram.menu(report);
      markSent(report);
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/reports/:id',
    handle(async (req, res) => {
      const r = store.report(req.params.id);
      if (!r) throw Error('Không tìm thấy bản tin');
      res.json(r);
    }),
  );
  app.post(
    '/api/bookmarks',
    handle(async (req, res) => {
      const report = store.report(req.body.reportId);
      const item = report?.items.find((x) => x.id === req.body.itemId);
      if (!item) throw Error('Không tìm thấy tin cần lưu');
      store.db
        .prepare('INSERT OR IGNORE INTO bookmarks VALUES(?,?,?,?)')
        .run(item.id, report.id, JSON.stringify(item), Date.now());
      res.json({ ok: true });
    }),
  );
  app.delete(
    '/api/bookmarks/:id',
    handle(async (req, res) => {
      store.db.prepare('DELETE FROM bookmarks WHERE id=?').run(req.params.id);
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/sources/:id',
    handle(async (req, res) => {
      const m = store.db
        .prepare(
          'SELECT content,sender,ts,platform,group_id,links,reply_to,quote_text FROM received WHERE id=?',
        )
        .get(req.params.id);
      if (!m) return res.status(404).json({ error: 'Tin gốc không còn trong thời gian lưu' });
      res.json({ ...m, links: JSON.parse(m.links) });
    }),
  );
  app.get('/api/messages', (req, res) =>
    res.json(
      store.db
        .prepare(
          'SELECT id,platform,group_id,content,sender,ts FROM received ORDER BY ts DESC LIMIT 100',
        )
        .all(),
    ),
  );
  app.get('/api/telegram/config', (req, res) => {
    const config = currentTelegramConfig();
    res.json({
      configured: !!(config.token && config.chatId),
      chatId: config.chatId || '',
      needsRestart:
        config.token !== telegram.env.TELEGRAM_BOT_TOKEN ||
        config.chatId !== telegram.env.TELEGRAM_CHAT_ID,
    });
  });
  app.post(
    '/api/telegram/config',
    handle(async (req, res) => {
      const config = validateTelegramConfig(req.body, currentTelegramConfig());
      configFile.save(config);
      res.json({ ok: true, needsRestart: true });
    }),
  );
  app.post(
    '/api/telegram/config/test',
    handle(async (req, res) => {
      const config = validateTelegramConfig(currentTelegramConfig());
      const candidate = new TelegramBot(store, {
        env: { TELEGRAM_BOT_TOKEN: config.token, TELEGRAM_CHAT_ID: config.chatId },
        fetchFn,
      });
      await candidate.send(
        'Nhà Tin: tin nhắn kiểm tra kết nối. Bạn đã nhận được tin này thì bot gửi được tới cuộc trò chuyện này.',
      );
      res.json({ ok: true });
    }),
  );
  app.get('/api/ai/config', (req, res) => {
    const saved = aiFile.load(),
      c = aiConfig();
    res.json({
      source: saved ? 'saved' : c.MODEL_API_KEY ? 'env' : 'none',
      hasKey: !!c.MODEL_API_KEY,
      baseUrl: c.MODEL_API_BASE_URL || '',
      model: c.MODEL_NAME || '',
      inputPrice: c.MODEL_INPUT_USD_PER_MILLION ?? '',
      outputPrice: c.MODEL_OUTPUT_USD_PER_MILLION ?? '',
      interval: c.MODEL_MIN_INTERVAL_MS ?? '',
    });
  });
  app.post(
    '/api/ai/config',
    handle(async (req, res) => {
      aiFile.save(validateAIConfig(req.body, aiConfig()));
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/ai/config/test',
    handle(async (req, res) => {
      await reports.ping();
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/telegram/test',
    handle(async (req, res) => {
      await telegram.send('Nhà Tin đã kết nối. Gõ /start để chọn bản tin.');
      res.json({ ok: true });
    }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(400).json({
      error:
        err.type === 'entity.parse.failed'
          ? 'Nội dung yêu cầu không hợp lệ'
          : err.message || 'Yêu cầu thất bại',
    });
  });
  let scheduleBusy = false;
  const tick = async () => {
    if (scheduleBusy || reports.busy || !telegram.configured() || !store.groups().length) return;
    const now = new Date(),
      time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now);
    if (time < store.option('hour') || !sendsOn(now, JSON.parse(store.option('send_days')))) return;
    const day = dayAtVN(new Date(now.getTime() - 86400000));
    const previous = store.db.prepare('SELECT * FROM sends WHERE day=?').get(day);
    // 'sending' while nothing runs means the app stopped mid-send; retry it like a failure.
    if (previous?.state === 'sent') return;
    if (previous && (previous.attempts >= 3 || Date.now() - previous.last_attempt < 1800000))
      return;
    scheduleBusy = true;
    store.db
      .prepare(
        'INSERT INTO sends(day,state,attempts,last_attempt) VALUES(?,?,1,?) ON CONFLICT(day) DO UPDATE SET state=excluded.state,attempts=attempts+1,last_attempt=excluded.last_attempt',
      )
      .run(day, 'sending', Date.now());
    try {
      // A report that was built but not delivered is resent without calling the AI again.
      let report = previous?.report_id ? store.report(previous.report_id) : null;
      if (!report) {
        // Read the groups now rather than depending on the app having listened all day.
        const coverage = await zalo.syncDay(day);
        await discord.sync(day);
        report = await reports.create(day, { coverage });
        store.db.prepare('UPDATE sends SET report_id=? WHERE day=?').run(report.id, day);
      }
      await telegram.menu(report);
      store.db.prepare('UPDATE sends SET state=?,error=NULL WHERE day=?').run('sent', day);
    } catch (e) {
      store.db
        .prepare('UPDATE sends SET state=?,error=? WHERE day=?')
        .run('failed', e.message, day);
    } finally {
      scheduleBusy = false;
    }
  };
  app.get('/api/delivery', (req, res) =>
    res.json(store.db.prepare('SELECT * FROM sends ORDER BY day DESC LIMIT 7').all()),
  );
  return { app, store, zalo, discord, reports, telegram, tick };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = createApp();
  const server = runtime.app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () =>
    console.log('Nhà Tin đang chạy trên máy này, cổng ' + (process.env.PORT || 3000)),
  );
  void runtime.zalo.restore();
  void runtime.telegram.start();
  const schedule = setInterval(() => {
    void runtime.tick();
  }, 20000);
  schedule.unref();
  const removeExpired = () => {
    runtime.store.db
      .prepare('DELETE FROM received WHERE ts<?')
      .run(Date.now() - Number(runtime.store.option('retention')) * 86400000);
    runtime.store.db
      .prepare('DELETE FROM telegram_views WHERE created<?')
      .run(Date.now() - 30 * 86400000);
  };
  // Also run at startup: an app that is often closed within an hour would otherwise never clean up.
  removeExpired();
  const cleanup = setInterval(removeExpired, 3600000);
  cleanup.unref();
  const close = () => {
    clearInterval(schedule);
    clearInterval(cleanup);
    runtime.telegram.stop();
    runtime.zalo.close();
    server.close(() => {
      runtime.store.db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
