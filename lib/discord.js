import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dayRange } from '../core.js';
const execute = promisify(execFile);
export function discordChannel(link) {
  const m = String(link).match(
    /^https:\/\/(?:www\.)?discord\.com\/channels\/(\d{15,22})\/(\d{15,22})(?:\/\d{15,22})?\/?$/,
  );
  if (!m) throw Error('Dán link kênh Discord dạng https://discord.com/channels/server/kênh');
  return { guildId: m[1], id: m[2] };
}
export function normalizeExport(data, channel, start, end) {
  if (String(data.channel?.id) !== channel || !Array.isArray(data.messages))
    throw Error('File xuất Discord không đúng kênh');
  return data.messages
    .map((m) => {
      const ts = Date.parse(m.timestamp);
      if (!/^\d{15,22}$/.test(String(m.id)) || !Number.isFinite(ts))
        throw Error('Tin Discord không hợp lệ');
      const links = [
        `https://discord.com/channels/${data.guild?.id || '@me'}/${channel}/${m.id}`,
        ...(m.attachments || [])
          .map((a) => a.url)
          .filter((x) => typeof x === 'string' && /^https:\/\//.test(x)),
      ];
      return {
        groupId: channel,
        msgId: String(m.id),
        content: [
          m.content || '',
          ...(m.attachments || []).map((a) => '[Tệp đính kèm] ' + (a.fileName || a.url)),
          ...(m.embeds || []).map((e) =>
            [e.title, e.description, e.url].filter(Boolean).join('\n'),
          ),
        ]
          .filter(Boolean)
          .join('\n'),
        sender: m.author?.nickname || m.author?.name || 'Không rõ',
        ts,
        links,
        replyTo: m.reference?.messageId || null,
      };
    })
    .filter((m) => m.ts >= start && m.ts < end && m.content);
}
export class DiscordSource {
  constructor(store, { env = process.env, runner = execute } = {}) {
    this.store = store;
    this.env = env;
    this.runner = runner;
    this.busy = false;
  }
  configured() {
    return !!(this.env.DISCORD_EXPORTER_PATH && this.env.DISCORD_TOKEN);
  }
  // The token goes through the environment, never the command line (visible to other processes).
  run(args, timeout) {
    return this.runner(this.env.DISCORD_EXPORTER_PATH, args, {
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        HOME: process.env.HOME,
        DISCORD_TOKEN: this.env.DISCORD_TOKEN,
      },
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
  }
  // `guilds` and `channels` print one "ID | Name" line per entry; thread lines start with " * ".
  async list(args) {
    if (!this.configured())
      throw Error('Chưa cấu hình DISCORD_EXPORTER_PATH và DISCORD_TOKEN trên máy');
    let stdout;
    try {
      ({ stdout } = await this.run(args, 120000));
    } catch {
      throw Error('Không lấy được danh sách từ Discord; kiểm tra công cụ và token');
    }
    return String(stdout)
      .replace(/\x1b\[[0-9;]*m/g, '')
      .split(/\r?\n/)
      .map((line) => line.match(/^(\d{15,22})\s*\|\s*(.+?)\s*$/))
      .filter(Boolean)
      .map(([, id, name]) => ({ id, name }));
  }
  async guilds() {
    return this.list(['guilds']);
  }
  async channels(guildId) {
    if (!/^\d{15,22}$/.test(String(guildId))) throw Error('Server Discord không hợp lệ');
    return this.list(['channels', '-g', guildId, '--include-vc', 'false']);
  }
  // Make the followed channels of one server match the owner's ticks; other servers stay as they are.
  async followGuild(accountId, guildId, ids) {
    const a = this.store.account(accountId);
    if (a?.platform !== 'Discord') throw Error('Chọn tài khoản Discord');
    if (!Array.isArray(ids) || ids.length > 500 || ids.some((x) => typeof x !== 'string'))
      throw Error('Danh sách kênh không hợp lệ');
    const guild = (await this.guilds()).find((g) => g.id === guildId);
    if (!guild) throw Error('Tài khoản không ở trong server này');
    const channels = await this.channels(guildId);
    if (ids.some((id) => !channels.some((c) => c.id === id)))
      throw Error('Kênh không thuộc server đã chọn');
    const db = this.store.db;
    db.exec('BEGIN');
    try {
      for (const c of channels)
        if (!ids.includes(c.id))
          db.prepare('DELETE FROM followed WHERE account_id=? AND group_id=?').run(a.id, c.id);
      for (const c of channels.filter((c) => ids.includes(c.id)))
        db.prepare(
          'INSERT INTO followed(account_id,group_id,name,since) VALUES(?,?,?,?) ON CONFLICT(account_id,group_id) DO NOTHING',
        ).run(a.id, c.id, (guild.name + ' › ' + c.name).slice(0, 120), Date.now());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { ok: true };
  }
  async sync(day) {
    if (this.busy) throw Error('Discord đang lấy tin');
    const [start, end] = dayRange(day);
    const accounts = this.store
      .accounts()
      .filter((a) => a.platform === 'Discord' && a.enabled && a.groups.some((g) => g.enabled));
    if (!accounts.length) return { count: 0 };
    if (!this.configured())
      throw Error('Chưa cấu hình DISCORD_EXPORTER_PATH và DISCORD_TOKEN trên máy');
    this.busy = true;
    let count = 0;
    try {
      for (const a of accounts) {
        this.store.status(a.id, 'syncing');
        try {
          for (const g of a.groups.filter((g) => g.enabled)) {
            const dir = await mkdtemp(join(tmpdir(), 'nhatin-discord-'));
            try {
              const output = join(dir, 'messages.json');
              await this.run(
                [
                  'export',
                  '-c',
                  g.group_id,
                  '-f',
                  'Json',
                  '-o',
                  output,
                  '--after',
                  new Date(start - 1).toISOString(),
                  '--before',
                  new Date(end).toISOString(),
                  '--respect-rate-limits',
                  'true',
                ],
                300000,
              );
              const data = JSON.parse(await readFile(output, 'utf8'));
              const messages = normalizeExport(data, g.group_id, start, end);
              this.store.db.exec('BEGIN');
              try {
                for (const m of messages) if (this.store.ingest(a.id, m)) count++;
                this.store.db.exec('COMMIT');
              } catch (e) {
                this.store.db.exec('ROLLBACK');
                throw e;
              }
            } finally {
              await rm(dir, { recursive: true, force: true });
            }
          }
          this.store.status(a.id, 'connected');
        } catch {
          this.store.status(a.id, 'sync_failed');
          throw Error(
            'Lấy tin Discord thất bại; kiểm tra công cụ, token và quyền xem kênh. Chưa gửi bản tin.',
          );
        }
      }
      return { count };
    } finally {
      this.busy = false;
    }
  }
}
