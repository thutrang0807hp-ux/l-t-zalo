import { selectHighlights } from './highlights.js';
import { isNoise } from './noise.js';
import { randomUUID } from 'node:crypto';
import { dayAtVN, dayRange } from '../core.js';
import {
  groupConversations,
  SUMMARY_PROMPT,
  MERGE_PROMPT,
  QUICK_PROMPT,
  messageData,
  parseJson,
  retryInvalid,
} from './conversations.js';
export function parseItems(content, messages, group) {
  const data = parseJson(content);
  if (!Array.isArray(data.items) || data.items.length > 12)
    throw Error('AI trả cấu trúc không hợp lệ');
  const byId = new Map(messages.map((m) => [m.id, m]));
  return data.items.map((x) => {
    if (
      !x ||
      ['title', 'summary', 'why'].some(
        (k) => typeof x[k] !== 'string' || !x[k].trim() || x[k].length > 3000,
      ) ||
      !Array.isArray(x.refs) ||
      !x.refs.length ||
      x.refs.length > 40 ||
      x.refs.some((id) => !byId.has(id))
    )
      throw Error('AI trả nguồn không tồn tại');
    const refs = [...new Set(x.refs)];
    return {
      id: randomUUID(),
      platform: group.platform,
      groupId: group.id,
      groupName: group.name,
      title: x.title,
      summary: x.summary,
      why: x.why,
      refs,
      links: [...new Set(refs.flatMap((id) => JSON.parse(byId.get(id).links)))],
    };
  });
}
export function batches(messages, maxBytes = 16000) {
  const out = [];
  let batch = [],
    size = 0;
  for (const m of messages) {
    const value = messageData(m);
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (bytes > maxBytes) throw Error('Có tin quá dài để xử lý nguyên vẹn; chưa tạo báo cáo');
    if (size + bytes > maxBytes && batch.length) {
      out.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(m);
    size += bytes;
  }
  if (batch.length) out.push(batch);
  return out;
}
const fail = (message, retryable = true) => Object.assign(Error(message), { retryable });
// Explain provider errors in terms of the .env setting the owner has to change.
function providerError(status, detail) {
  const hint = /api.?key/i.test(detail)
    ? 'khóa API (MODEL_API_KEY) không đúng hoặc đã bị thu hồi'
    : status === 400
      ? 'kiểm tra MODEL_NAME có đúng tên model được phép dùng không'
      : status === 401 || status === 403
        ? 'kiểm tra MODEL_API_KEY, hoặc khóa chưa được bật cho API này'
        : status === 404
          ? 'kiểm tra MODEL_API_BASE_URL và MODEL_NAME'
          : status === 429
            ? 'đã vượt hạn mức (gói miễn phí giới hạn số lần gọi mỗi phút/ngày); thử lại sau hoặc tăng MODEL_MIN_INTERVAL_MS'
            : 'máy chủ AI đang lỗi, thử lại sau';
  return fail(`AI trả lỗi ${status}: ${hint}${detail ? ' (' + detail + ')' : ''}`, false);
}
export class Reports {
  constructor(store, { env = process.env, config, fetchFn = fetch, sleep } = {}) {
    this.store = store;
    this.env = env;
    // Settings saved in the app override .env and apply without a restart.
    this.config = config || (() => this.env);
    this.fetch = fetchFn;
    this.sleep = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.busy = false;
    this.lastCall = 0;
  }
  async request(system, payload) {
    const env = this.config();
    if (!env.MODEL_API_KEY || !env.MODEL_API_BASE_URL)
      throw fail('Chưa cấu hình AI; không thể tự đánh giá nội dung nhóm', false);
    const base = new URL(env.MODEL_API_BASE_URL);
    if (base.protocol !== 'https:') throw fail('API AI phải dùng HTTPS', false);
    if (!env.MODEL_NAME) throw fail('Chưa đặt MODEL_NAME (tên model AI) trong .env', false);
    // Price 0 is valid: free tiers (e.g. Gemini) cost nothing but are still rate limited.
    const inputPrice = Number(env.MODEL_INPUT_USD_PER_MILLION ?? 1.25),
      outputPrice = Number(env.MODEL_OUTPUT_USD_PER_MILLION ?? 4.25),
      maxTokens = Number(env.MODEL_MAX_TOKENS || 4000),
      interval = Number(env.MODEL_MIN_INTERVAL_MS || 0);
    if (
      !Number.isFinite(inputPrice) ||
      !Number.isFinite(outputPrice) ||
      inputPrice < 0 ||
      outputPrice < 0
    )
      throw fail('Giá API không hợp lệ', false);
    if (!Number.isInteger(maxTokens) || maxTokens < 500 || maxTokens > 65536)
      throw fail('MODEL_MAX_TOKENS phải là số từ 500 đến 65536', false);
    if (!Number.isFinite(interval) || interval < 0 || interval > 120000)
      throw fail('MODEL_MIN_INTERVAL_MS phải từ 0 đến 120000', false);
    const user = JSON.stringify(payload);
    const reserve = (Buffer.byteLength(system + user) * inputPrice + maxTokens * outputPrice) / 1e6;
    const month = dayAtVN().slice(0, 7),
      db = this.store.db,
      budget = Number(this.store.option('budget'));
    const spent = db.prepare('SELECT amount FROM costs WHERE month=?').get(month)?.amount || 0;
    if (reserve > 0 && spent + reserve > budget)
      throw fail(`Đã chạm giới hạn AI $${budget}/tháng; báo cáo chưa hoàn thành`, false);
    const body = {
      model: env.MODEL_NAME,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    if (env.MODEL_JSON_MODE === 'true') body.response_format = { type: 'json_object' };
    if (env.MODEL_REASONING_EFFORT) body.reasoning_effort = env.MODEL_REASONING_EFFORT;
    let response;
    for (let attempt = 1; ; attempt++) {
      const wait = this.lastCall + interval - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.lastCall = Date.now();
      db.prepare(
        'INSERT INTO costs VALUES(?,?) ON CONFLICT(month) DO UPDATE SET amount=amount+excluded.amount',
      ).run(month, reserve);
      try {
        response = await this.fetch(base.href.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.MODEL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90000),
        });
      } catch {
        throw fail('Không gọi được AI; giữ khoản dự phòng vì chưa xác định phí', false);
      }
      if (response.ok) break;
      // A rejected request is not billed, so release its reserve.
      db.prepare('UPDATE costs SET amount=MAX(0,amount-?) WHERE month=?').run(reserve, month);
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < 4) {
        const after = Number(response.headers?.get?.('retry-after'));
        await this.sleep(
          Number.isFinite(after) && after > 0 ? Math.min(after, 120) * 1000 : 15000 * attempt,
        );
        continue;
      }
      let detail = '';
      try {
        // Gemini wraps its error object in an array.
        const body = [await response.json()].flat()[0];
        detail = String(body?.error?.message || '').slice(0, 200);
      } catch {}
      throw providerError(response.status, detail);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw fail('AI không trả JSON hợp lệ');
    }
    const usage = data.usage;
    if (
      Number.isFinite(usage?.prompt_tokens) &&
      Number.isFinite(usage?.completion_tokens) &&
      usage.prompt_tokens >= 0 &&
      usage.completion_tokens >= 0
    ) {
      const cost = (usage.prompt_tokens * inputPrice + usage.completion_tokens * outputPrice) / 1e6;
      db.prepare('UPDATE costs SET amount=MAX(0,amount+?) WHERE month=?').run(
        cost - reserve,
        month,
      );
    }
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length')
      throw fail('AI bị cắt câu trả lời vì hết MODEL_MAX_TOKENS; tăng giá trị này trong .env');
    const text = choice?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw fail('AI chưa trả nội dung');
    return text;
  }
  async ping() {
    const value = parseJson(
      await this.request('Trả đúng JSON {"ok":true}, không thêm chữ nào khác.', { stage: 'test' }),
    );
    if (value.ok !== true) throw Error('AI trả lời nhưng chưa đúng định dạng JSON ứng dụng cần');
  }
  async summarize(group, messages, topic) {
    return retryInvalid(async () => {
      const raw = await this.request(SUMMARY_PROMPT, {
        stage: 'summary',
        group: group.name,
        ownerInstructions: group.instructions,
        conversation: topic.title,
        priorContext: (topic.context || []).map(messageData),
        messages: messages.map(messageData),
      });
      const items = parseItems(raw, messages, group);
      if (items.length > 1) throw Error('AI tách một cuộc trao đổi thành nhiều mục không hợp lệ');
      return items;
    });
  }
  async create(
    day,
    {
      since = null,
      until = null,
      kind = 'daily',
      groups = null,
      scan = null,
      coverage = { covered: new Set(), incomplete: [] },
    } = {},
  ) {
    if (this.busy) throw Error('Đang tạo bản tin khác');
    this.busy = true;
    try {
      const range = dayRange(day),
        start = since ?? range[0],
        end = until ?? range[1],
        items = [],
        db = this.store.db;
      const failed = [];
      for (const g of groups || this.store.groups()) {
        // One group's bad AI answer should not cost the whole report; quota/config errors still stop it.
        try {
          const found = [];
          const column = kind === 'alert' ? 'received_at' : 'ts';
          const rows = db
            .prepare(
              `SELECT * FROM received WHERE platform=? AND group_id=? AND ${column}>=? AND ${column}<? ORDER BY ts,id`,
            )
            .all(g.platform, g.id, start, end);
          // Content-free messages ("ok", "haha", emoji) cost money but add nothing.
          const useful = rows.filter((m) => !isNoise(m.content));
          if (!useful.length) continue;
          // The AI must echo every message ID; short IDs keep its answer far below the token limit.
          const realId = new Map(useful.map((m, i) => [String(i + 1), m.id]));
          const messages = useful.map((m, i) => ({ ...m, id: String(i + 1) }));
          // Earlier quoted messages provide context but must not be reported again as today's new messages.
          const quoted = [...new Set(messages.map((m) => m.reply_to).filter(Boolean))];
          const context = quoted
            .map((id) =>
              db
                .prepare(
                  'SELECT * FROM received WHERE platform=? AND group_id=? AND msg_id=? AND ts<?',
                )
                .get(g.platform, g.id, id, start),
            )
            .filter(Boolean)
            .map((m, i) => ({ ...m, id: 'c' + (i + 1) }));
          if (context.length > 30)
            throw Error('Quá nhiều tin trích dẫn để giữ ngữ cảnh đầy đủ; chưa tạo báo cáo');
          if (g.mode === 'quick') {
            // Skim: one request per large batch instead of grouping and summarizing each topic.
            const byId = new Map(messages.map((m) => [m.id, m]));
            for (const part of batches(messages, 60000)) {
              const parsed = await retryInvalid(async () =>
                parseItems(
                  await this.request(QUICK_PROMPT, {
                    stage: 'quick',
                    group: g.name,
                    ownerInstructions: g.instructions,
                    messages: part.map(messageData),
                  }),
                  part,
                  g,
                ),
              );
              for (const item of parsed)
                found.push({
                  ...item,
                  refs: item.refs.map((id) => realId.get(id)),
                  messageCount: item.refs.length,
                  participants: [...new Set(item.refs.map((id) => byId.get(id).sender))],
                });
            }
            items.push(...found);
            continue;
          }
          const topics = await groupConversations(
            messages,
            batches(messages),
            (system, payload) =>
              this.request(system, {
                ...payload,
                group: g.name,
                ownerInstructions: g.instructions,
              }),
            context,
          );
          for (const topic of topics) {
            topic.context = context.filter((old) =>
              topic.messages.some((m) => m.reply_to === old.msg_id),
            );
            const partials = [];
            for (const part of batches(topic.messages)) {
              partials.push(...(await this.summarize(g, part, topic)));
            }
            if (!partials.length) continue;
            let result = partials;
            if (partials.length > 1) {
              const payload = {
                stage: 'merge',
                conversation: topic.title,
                ownerInstructions: g.instructions,
                partials: partials.map((p) => ({
                  title: p.title,
                  summary: p.summary,
                  why: p.why,
                  refs: p.refs,
                })),
              };
              if (Buffer.byteLength(JSON.stringify(payload)) > 90000)
                throw Error('Cuộc trao đổi quá dài để hợp nhất đầy đủ');
              const refs = new Set(partials.flatMap((p) => p.refs));
              result = await retryInvalid(async () => {
                const merged = parseItems(
                  await this.request(MERGE_PROMPT, payload),
                  topic.messages.filter((m) => refs.has(m.id)),
                  g,
                );
                if (merged.length > 1) throw Error('Hợp nhất chủ đề trả nhiều mục không hợp lệ');
                return merged;
              });
            }
            for (const item of result)
              found.push({
                ...item,
                refs: item.refs.map((id) => realId.get(id)),
                conversationId: topic.id,
                messageCount: topic.messages.length,
                participants: [...new Set(topic.messages.map((m) => m.sender))],
              });
          }
          items.push(...found);
        } catch (e) {
          if (e.retryable === false) throw e;
          failed.push({ type: 'ai', platform: g.platform, group: g.name, message: e.message });
        }
      }
      if (failed.length && !items.length)
        throw Error('AI chưa tóm tắt được nhóm nào: ' + failed[0].message);
      // Without a valid top-5 choice the report is still useful; readers fall back to the first items.
      const highlights = await selectHighlights(items, (system, payload) =>
        this.request(system, payload),
      ).catch((e) => {
        if (e.retryable === false) throw e;
        return null;
      });
      const report = {
        id: randomUUID(),
        day,
        items,
        highlights,
        // Accounts whose history was read in full this morning have no real gap, even if offline.
        warnings: [
          ...this.store.warning(start, end).filter((w) => !coverage.covered.has(w.accountId)),
          ...coverage.incomplete,
          ...failed,
        ],
        mode: 'AI · gom cuộc trao đổi',
        created: Date.now(),
        kind,
        scan,
      };
      db.prepare(
        'INSERT INTO reports(id,day,items,warnings,mode,created,kind,highlights,scan) VALUES(?,?,?,?,?,?,?,?,?)',
      ).run(
        report.id,
        day,
        JSON.stringify(report.items),
        JSON.stringify(report.warnings),
        report.mode,
        report.created,
        kind,
        JSON.stringify(highlights),
        scan ? JSON.stringify(scan) : null,
      );
      return report;
    } finally {
      this.busy = false;
    }
  }
}
