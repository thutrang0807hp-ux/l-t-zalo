import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
export function validateTelegramConfig(value, previous = {}) {
  const token = value.token === '' || value.token === undefined ? previous.token : value.token;
  const chatId = String(value.chatId || '').trim();
  if (typeof token !== 'string' || !/^\d{5,15}:[A-Za-z0-9_-]{20,150}$/.test(token))
    throw Error('Bot token không đúng định dạng');
  if (!/^[1-9]\d{3,19}$/.test(chatId))
    throw Error('Chat ID phải là số của cuộc trò chuyện riêng với bạn');
  return { token, chatId };
}
export function telegramConfigFile(dir) {
  const path = join(dir, 'telegram-private.json');
  return {
    load() {
      if (!existsSync(path)) return null;
      try {
        return validateTelegramConfig(JSON.parse(readFileSync(path, 'utf8')));
      } catch {
        throw Error('Cấu hình Telegram đã lưu không hợp lệ; kiểm tra file riêng trên máy');
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
