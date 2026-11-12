export function dayAtVN(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function dayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Ngày không hợp lệ');
  const start = Date.parse(`${day}T00:00:00+07:00`);
  if (!Number.isFinite(start) || dayAtVN(new Date(start)) !== day)
    throw new Error('Ngày không hợp lệ');
  return [start, start + 86400000];
}
