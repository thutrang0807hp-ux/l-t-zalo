import { dayAtVN } from '../core.js';
export const ALL_SEND_DAYS = [1, 2, 3, 4, 5, 6, 7];
export function validateSendDays(days) {
  if (
    !Array.isArray(days) ||
    days.length > 7 ||
    days.some((n) => !Number.isInteger(n) || n < 1 || n > 7)
  )
    throw Error('Chọn ngày nhận từ Thứ 2 đến Chủ nhật');
  return [...new Set(days)].sort((a, b) => a - b);
}
export function weekdayVN(date = new Date()) {
  return new Date(dayAtVN(date) + 'T00:00:00Z').getUTCDay() || 7;
}
export function sendsOn(date, days) {
  return days.includes(weekdayVN(date));
}
