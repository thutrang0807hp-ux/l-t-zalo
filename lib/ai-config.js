import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
// Saved AI settings use the same names as .env so either source works the same way.
export const AI_KEYS = [
  'MODEL_API_KEY',
  'MODEL_API_BASE_URL',
  'MODEL_NAME',
  'MODEL_INPUT_USD_PER_MILLION',
  'MODEL_OUTPUT_USD_PER_MILLION',
  'MODEL_MIN_INTERVAL_MS',
];
export function validateAIConfig(value, previous = {}) {
  const key = value.key === '' || value.key === undefined ? previous.MODEL_API_KEY : value.key;
  if (typeof key !== 'string' || !/^[\x21-\x7e]{10,300}$/.test(key))
    throw Error('Nhập khóa API (API key) hợp lệ');
  let base;
  try {
    base = new URL(String(value.baseUrl || '').trim());
  } catch {
    throw Error('Địa chỉ API không hợp lệ');
  }
  if (base.protocol !== 'https:') throw Error('Địa chỉ API phải bắt đầu bằng https://');
  const model = String(value.model || '').trim();
  if (!/^[\w.:/@-]{1,120}$/.test(model)) throw Error('Nhập tên model, ví dụ gemini-2.5-flash-lite');
  const number = (v, max, label) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > max) throw Error(label + ' không hợp lệ');
    return String(n);
  };
  return {
    MODEL_API_KEY: key,
    MODEL_API_BASE_URL: base.href.replace(/\/$/, ''),
    MODEL_NAME: model,
    MODEL_INPUT_USD_PER_MILLION: number(value.inputPrice, 1000, 'Giá đầu vào'),
    MODEL_OUTPUT_USD_PER_MILLION: number(value.outputPrice, 1000, 'Giá đầu ra'),
    MODEL_MIN_INTERVAL_MS: number(value.interval, 120000, 'Khoảng chờ giữa các lần gọi'),
  };
}
export function aiConfigFile(dir) {
  const path = join(dir, 'ai-private.json');
  return {
    load() {
      if (!existsSync(path)) return null;
      try {
        const saved = JSON.parse(readFileSync(path, 'utf8'));
        return Object.fromEntries(AI_KEYS.map((k) => [k, saved[k]]));
      } catch {
        throw Error('Cấu hình AI đã lưu không hợp lệ; kiểm tra file riêng trên máy');
      }
    },
    save(config) {
      const temporary = path + '.tmp';
      writeFileSync(temporary, JSON.stringify(config), { mode: 0o600 });
      chmodSync(temporary, 0o600);
      renameSync(temporary, path);
      chmodSync(path, 0o600);
    },
  };
}
