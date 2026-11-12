import { briefSummary, coverageNotice, articleTitle, groupDigest } from './reading.js';
import { reportHighlights } from './highlights.js';
import { randomUUID } from 'node:crypto';
export const PLATFORMS = ['Zalo', 'Discord', 'Telegram'];
export const escapeTelegram = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const clip = (text, n) => {
  const chars = Array.from(String(text));
  return chars.slice(0, n).join('') + (chars.length > n ? '…' : '');
};
const safeLinks = (links) =>
  links.filter((link) => {
    try {
      return ['http:', 'https:'].includes(new URL(link).protocol);
    } catch {
      return false;
    }
  });
export function itemText(item) {
  return `${articleTitle(item)}${item.messageCount ? '\n' + item.messageCount + ' tin · ' + (item.participants?.length || 0) + ' người trao đổi' : ''}\n\n${item.summary}\n\n💡 Vì sao đáng xem: ${item.why}\n\n🔗 Nguồn: ${item.platform} › ${item.groupName}${item.links.length ? '\n' + safeLinks(item.links).join('\n') : '\nKhông có link mở trực tiếp; bấm Xem nguồn để đọc trích đoạn.'}`;
}
export class TelegramBot {
  constructor(store, { env = process.env, fetchFn = fetch } = {}) {
    this.store = store;
    this.env = env;
    this.fetch = fetchFn;
    this.running = false;
    this.health = 'Chưa kết nối';
    this.controller = null;
  }
  configured() {
    return !!(this.env.TELEGRAM_BOT_TOKEN && this.env.TELEGRAM_CHAT_ID);
  }
  async call(method, data = {}) {
    let r;
    try {
      r = await this.fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal:
          method === 'getUpdates'
            ? this.controller?.signal || AbortSignal.timeout(35000)
            : AbortSignal.timeout(35000),
      });
    } catch {
      throw Error('Không kết nối được Telegram');
    }
    let result;
    try {
      result = await r.json();
    } catch {
      throw Error('Telegram không trả nội dung hợp lệ');
    }
    if (!r.ok || !result.ok)
      throw Error('Telegram trả lỗi; kiểm tra bot, chat ID và quyền truy cập');
    return result.result;
  }
  async send(text, keyboard) {
    if (!this.configured()) throw Error('Chưa cấu hình Telegram');
    // Split by characters, not UTF-16 units, so an emoji is never cut in half.
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i += 3000) {
      // Telegram allows about one message per second in a chat.
      if (i) await new Promise((r) => setTimeout(r, 1100));
      await this.call('sendMessage', {
        chat_id: this.env.TELEGRAM_CHAT_ID,
        text: chars.slice(i, i + 3000).join(''),
        link_preview_options: { is_disabled: true },
        ...(i + 3000 >= chars.length && keyboard
          ? { reply_markup: { inline_keyboard: keyboard } }
          : {}),
      });
    }
  }
  view(reportId, platform = null, groupId = null, page = 0) {
    const id = randomUUID().slice(0, 12);
    this.store.db
      .prepare('INSERT INTO telegram_views VALUES(?,?,?,?,?,?)')
      .run(id, reportId, platform, groupId, page, Date.now());
    return 'v:' + id;
  }
  async menu(report = this.store.latest()) {
    if (!report) {
      await this.send('Chưa có bản tin. Hãy kết nối Zalo, chọn nhóm và tạo bản tin trong app.');
      return;
    }
    const notice = coverageNotice(report),
      warning = notice ? '\n' + notice : '';
    const top = reportHighlights(report);
    const lines = groupDigest(top).map(
      (section) =>
        '<b>' +
        escapeTelegram(section.topic) +
        '</b>\n\n' +
        section.items
          .map((i) => {
            const n = top.indexOf(i);
            const links = safeLinks(i.links || []).slice(0, 2);
            return (
              `<b>${n + 1}. ${escapeTelegram(clip(i.title, 90))}</b>\n${escapeTelegram(briefSummary(i.summary, 300))}\n<i>${escapeTelegram(i.platform)} · ${escapeTelegram(clip(i.groupName, 50))}</i>\n` +
              (links.length
                ? links
                    .map(
                      (url) =>
                        '<a href="' +
                        escapeTelegram(url).replaceAll('"', '&quot;') +
                        '">🔗 Đọc nguồn</a>',
                    )
                    .join(' · ')
                : '🔗 Nguồn: nút ' + (n + 1) + ' bên dưới')
            );
          })
          .join('\n\n'),
    );
    const buttons = top.map((i, n) => {
      const group = report.items.filter(
          (x) => x.platform === i.platform && x.groupId === i.groupId,
        ),
        page = group.findIndex((x) => x.id === i.id);
      return [
        {
          text: n + 1 + '. ' + clip(i.title, 48),
          callback_data: this.view(report.id, i.platform, i.groupId, page),
        },
        {
          text: '☆ Lưu ' + (n + 1),
          callback_data: 'k:' + this.view(report.id, i.platform, i.groupId, page).slice(2),
        },
      ];
    });
    buttons.push([
      {
        text: 'Xem tất cả · ' + report.items.length + ' mục',
        callback_data: this.view(report.id, '__more__'),
      },
      { text: '☆ Đã lưu', callback_data: 'b:0' },
    ]);
    const title = report.scan
      ? '🔎 Quét ' +
        clip(report.scan.groupName, 65) +
        ' · ' +
        report.scan.from +
        ' → ' +
        report.scan.to
      : '☀ BẢN TIN BUỔI SÁNG · ' + report.day;
    const subtitle = top.length + ' ý nổi bật · ' + report.items.length + ' mục trong ngày';
    const scanNote = report.scan
      ? '\nYêu cầu: ' +
        clip(report.scan.query || 'Tổng hợp các chủ đề đáng chú ý', 160) +
        '\nChỉ dùng tin đã lưu.'
      : '';
    const html =
      '<b>' +
      escapeTelegram(title) +
      '</b>\n' +
      escapeTelegram(subtitle + warning + scanNote) +
      '\n\n' +
      (lines.join('\n\n') || 'Không có mục đáng xem trong ngày này.') +
      '\n\n<i>Có link thì mở ngay dưới tin; nút tiêu đề để đọc đầy đủ hoặc xem trích đoạn.</i>';
    await this.call('sendMessage', {
      chat_id: this.env.TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: buttons },
    });
  }
  async navigate(v) {
    const report = this.store.report(v.report_id);
    if (!report) {
      await this.send('Bản tin không còn tồn tại. Gõ /start để xem bản mới.');
      return;
    }
    if (!v.platform) {
      await this.menu(report);
      return;
    }
    if (v.platform === '__more__') {
      await this.send('Xem thêm · chọn nguồn:', [
        PLATFORMS.map((p) => ({
          text: p + ' (' + report.items.filter((x) => x.platform === p).length + ')',
          callback_data: this.view(report.id, p),
        })),
        [{ text: '← Bản ngắn', callback_data: this.view(report.id) }],
      ]);
      return;
    }
    const all = report.items.filter((x) => x.platform === v.platform);
    if (!v.group_id) {
      if (!all.length) {
        await this.send(
          v.platform === 'Zalo'
            ? 'Không có tin Zalo hữu ích trong bản này.'
            : 'Nguồn ' + v.platform + ' chưa được tích hợp trong bản hiện tại.',
          [[{ text: '← Chọn nguồn', callback_data: this.view(report.id) }]],
        );
        return;
      }
      const groups = [...new Map(all.map((x) => [x.groupId, x.groupName])).entries()];
      await this.send(v.platform + ' · Chọn nhóm:', [
        ...groups.map(([id, name]) => [
          { text: name.slice(0, 50), callback_data: this.view(report.id, v.platform, id) },
        ]),
        [{ text: '← Chọn nguồn', callback_data: this.view(report.id) }],
      ]);
      return;
    }
    const items = all.filter((x) => x.groupId === v.group_id),
      item = items[v.page];
    if (!item) {
      await this.send('Mục này không còn tồn tại.');
      return;
    }
    const keyboard = [
      [
        {
          text: 'Xem nguồn',
          callback_data: 's:' + this.view(report.id, v.platform, v.group_id, v.page).slice(2),
        },
        {
          text: '☆ Lưu xem sau',
          callback_data: 'k:' + this.view(report.id, v.platform, v.group_id, v.page).slice(2),
        },
      ],
    ];
    if (v.page + 1 < items.length)
      keyboard.push([
        {
          text: 'Tin tiếp (' + (v.page + 2) + '/' + items.length + ')',
          callback_data: this.view(report.id, v.platform, v.group_id, v.page + 1),
        },
      ]);
    keyboard.push([{ text: '← Chọn nhóm', callback_data: this.view(report.id, v.platform) }]);
    await this.send(itemText(item), keyboard);
  }
  async handle(update) {
    const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (String(chat) !== String(this.env.TELEGRAM_CHAT_ID)) return;
    if (update.message) {
      const command = (update.message.text || '').split(/\s/)[0].split('@')[0];
      if (['/start', '/tin', '/news'].includes(command)) await this.menu();
      else if (command === '/nguon') {
        const r = this.store.latest();
        if (r) await this.navigate({ report_id: r.id, platform: '__more__' });
        else await this.menu();
      } else if (command === '/daluu') await this.saved();
      else if (command === '/help')
        await this.send(
          'Bản sáng tự gửi theo lịch. /tin xem lại bản mới nhất; /nguon chọn nền tảng và nhóm; /daluu mở tin đã lưu.',
        );
      return;
    }
    const callback = update.callback_query;
    if (!callback) return;
    await this.call('answerCallbackQuery', { callback_query_id: callback.id });
    if (/^b:\d{1,5}$/.test(callback.data || '')) {
      await this.saved(Number(callback.data.slice(2)));
      return;
    }
    if (!/^[vsk]:[a-z0-9-]{12}$/.test(callback.data || '')) return;
    const v = this.store.db
      .prepare('SELECT * FROM telegram_views WHERE id=?')
      .get(callback.data.slice(2));
    if (!v) return;
    if (callback.data.startsWith('k:')) {
      const r = this.store.report(v.report_id),
        item = r?.items.filter((x) => x.platform === v.platform && x.groupId === v.group_id)[
          v.page
        ];
      if (!item) return;
      this.store.db
        .prepare('INSERT OR IGNORE INTO bookmarks VALUES(?,?,?,?)')
        .run(item.id, r.id, JSON.stringify(item), Date.now());
      await this.send('Đã lưu. Dùng Menu → Tin đã lưu để đọc lại.');
      return;
    }
    if (callback.data.startsWith('s:')) {
      const report = this.store.report(v.report_id),
        item = report?.items.filter((x) => x.platform === v.platform && x.groupId === v.group_id)[
          v.page
        ];
      if (!item) return;
      // One message per source would hit Telegram's flood limit; send them together instead.
      const parts = item.refs.map((ref) => {
        const source = this.store.db.prepare('SELECT * FROM received WHERE id=?').get(ref);
        return source
          ? `${source.sender} · ${new Date(source.ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n${source.quote_text ? '[Trích dẫn] ' + source.quote_text + '\n' : ''}${source.content}`
          : 'Tin gốc đã hết thời gian lưu. Bản tóm tắt vẫn còn.';
      });
      await this.send(`${item.groupName}\n\n${parts.join('\n\n———\n\n')}`);
    } else await this.navigate(v);
  }
  async configureMenu() {
    await this.call('setMyCommands', {
      scope: { type: 'chat', chat_id: this.env.TELEGRAM_CHAT_ID },
      commands: [
        { command: 'tin', description: 'Bản tin mới nhất' },
        { command: 'nguon', description: 'Chọn nguồn và nhóm' },
        { command: 'daluu', description: 'Tin đã lưu' },
        { command: 'help', description: 'Hướng dẫn' },
      ],
    });
    await this.call('setChatMenuButton', {
      chat_id: this.env.TELEGRAM_CHAT_ID,
      menu_button: { type: 'commands' },
    });
  }
  async saved(page = 0) {
    const rows = this.store.db
      .prepare('SELECT * FROM bookmarks ORDER BY created DESC LIMIT 5 OFFSET ?')
      .all(page);
    if (!rows.length) {
      await this.send('Chưa có tin đã lưu. Dùng nút Lưu xem sau dưới một tin để lưu lại.');
      return;
    }
    for (const row of rows) {
      const item = JSON.parse(row.item),
        r = this.store.report(row.report_id),
        items =
          r?.items.filter((x) => x.platform === item.platform && x.groupId === item.groupId) || [],
        index = items.findIndex((x) => x.id === item.id);
      await this.send(
        '☆ Tin đã lưu\n' + itemText(item),
        index < 0
          ? undefined
          : [
              [
                {
                  text: 'Xem nguồn',
                  callback_data:
                    's:' + this.view(r.id, item.platform, item.groupId, index).slice(2),
                },
              ],
            ],
      );
    }
    const more = this.store.db.prepare('SELECT id FROM bookmarks LIMIT 1 OFFSET ?').get(page + 5);
    if (more)
      await this.send('Còn tin đã lưu:', [
        [{ text: 'Xem thêm', callback_data: 'b:' + String(page + 5) }],
      ]);
  }
  async start() {
    if (this.running || !this.configured()) return;
    this.running = true;
    try {
      await this.configureMenu();
    } catch {
      this.health = 'Chưa thiết lập được menu; vẫn có thể dùng lệnh';
    }
    let offset = Number(this.store.option('telegram_offset') || 0);
    while (this.running) {
      this.controller = new AbortController();
      const timer = setTimeout(() => this.controller?.abort(), 35000);
      try {
        const updates = await this.call('getUpdates', {
          offset,
          timeout: 20,
          allowed_updates: ['message', 'callback_query'],
        });
        this.health = 'Đã kết nối';
        for (const u of updates) {
          try {
            await this.handle(u);
          } catch {
            this.health = 'Lỗi xử lý yêu cầu';
          }
          offset = u.update_id + 1;
          this.store.db
            .prepare(
              'INSERT INTO options VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
            )
            .run('telegram_offset', String(offset));
        }
      } catch {
        if (this.running) {
          this.health = 'Mất kết nối hoặc bot đang chạy ở nơi khác';
          await new Promise((r) => {
            this.retryTimer = setTimeout(r, 5000);
          });
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }
  stop() {
    this.running = false;
    this.controller?.abort();
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}
