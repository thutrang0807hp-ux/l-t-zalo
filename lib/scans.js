import { dayRange, dayAtVN } from '../core.js';
export function scanRange(from, to) {
  const start = dayRange(from)[0],
    end = dayRange(to)[1];
  if (end <= start) throw Error('Ngày kết thúc phải sau hoặc cùng ngày bắt đầu');
  if (end - start > 90 * 86400000) throw Error('Mỗi lần quét tối đa 90 ngày');
  if (to > dayAtVN()) throw Error('Không chọn ngày trong tương lai');
  return { start, end };
}
export function scanPreview(store, { accountId, groupId, from, to, query = '' }) {
  if (typeof query !== 'string' || query.length > 2000)
    throw Error('Yêu cầu tìm kiếm tối đa 2000 ký tự');
  const account = store.account(accountId);
  if (!account) throw Error('Không thấy tài khoản');
  const group = store.db
    .prepare('SELECT * FROM followed WHERE account_id=? AND group_id=?')
    .get(accountId, groupId);
  if (!group) throw Error('Nhóm chưa có trong danh sách tài khoản');
  const { start, end } = scanRange(from, to);
  const stats = store.db
    .prepare(
      'SELECT COUNT(*) count,MIN(ts) earliest,MAX(ts) latest FROM received WHERE platform=? AND group_id=? AND ts>=? AND ts<?',
    )
    .get(account.platform, groupId, start, end);
  const warnings = ['Chỉ quét tin app đã lưu; không tự lấy lại lịch sử cũ từ Zalo.'];
  if (!group.since || group.since > start)
    warnings.push('Nhóm có thể được theo dõi sau ngày bắt đầu; dữ liệu đầu khoảng có thể thiếu.');
  if (start < Date.now() - Number(store.option('retention')) * 86400000)
    warnings.push(
      'Một phần khoảng chọn vượt thời gian giữ tin; các tin đã xóa không thể khôi phục bằng cách tăng thời gian lưu.',
    );
  const gaps = store.db
    .prepare('SELECT start,end FROM gaps WHERE account_id=? AND start<? AND (end IS NULL OR end>?)')
    .all(accountId, end, start);
  if (gaps.length)
    warnings.push(
      'Tài khoản có khoảng mất/chưa kết nối trong thời gian đã chọn; báo cáo có thể thiếu.',
    );
  if (!stats.count) warnings.push('Không có tin đã lưu trong khoảng chọn.');
  return {
    accountId,
    platform: account.platform,
    groupId,
    groupName: group.name,
    from,
    to,
    query: query.trim(),
    ...stats,
    warnings,
    start,
    end,
    instructions: group.instructions,
  };
}
export async function runScan(store, reports, options) {
  const preview = scanPreview(store, options);
  if (!preview.count)
    throw Error('Không có tin đã lưu để quét. Chọn khoảng khác hoặc đợi app nhận tin.');
  const report = await reports.create(preview.from, {
    since: preview.start,
    until: preview.end,
    kind: 'scan',
    scan: preview,
    groups: [
      {
        id: preview.groupId,
        name: preview.groupName,
        platform: preview.platform,
        instructions:
          preview.instructions +
          (preview.query ? '\nYêu cầu riêng cho lần quét này: ' + preview.query : ''),
      },
    ],
  });
  return report;
}
