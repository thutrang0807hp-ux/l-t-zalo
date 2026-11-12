// Keep short previews readable without hiding a later qualification.
export function briefSummary(text, limit = 220) {
  const sentences = String(text)
    .trim()
    .split(/(?<=[.!?])\s+/u)
    .filter(Boolean);
  if (!sentences.length) return '';
  let selected = sentences.slice(0, 2);
  const caveat = sentences
    .slice(2)
    .find((s) => /chưa|chưa có|tùy|kiểm chứng|không chắc|chưa xác nhận/i.test(s));
  if (caveat)
    selected = [
      /mở chủ đề|hỏi về|bàn về/i.test(sentences[0]) && sentences[1] ? sentences[1] : sentences[0],
      caveat,
    ];
  let value = selected.join(' ');
  if (value.length <= limit) return value;
  const first = selected[0],
    qualification =
      selected.length > 1 && /chưa|tùy|kiểm chứng|không chắc/i.test(selected[1])
        ? selected[1]
        : null;
  if (qualification && qualification.length < limit - 45) {
    const left = limit - qualification.length - 3;
    return first.slice(0, left).replace(/\s+\S*$/u, '') + '… ' + qualification;
  }
  return value.slice(0, limit).replace(/\s+\S*$/u, '') + '…';
}
export function coverageNotice(report) {
  const warnings = report.warnings || [],
    gaps = warnings.filter((w) => !w.type),
    history = warnings.filter((w) => w.type === 'history'),
    failed = warnings.filter((w) => w.type === 'ai');
  const skipped = failed.length
    ? '⚠ Chưa tóm tắt được ' +
      failed.length +
      ' nhóm (' +
      failed
        .slice(0, 3)
        .map((f) => f.group)
        .join(', ') +
      (failed.length > 3 ? '…' : '') +
      '); xem lại bằng cách tạo bản tin lại sau.'
    : '';
  const partial = history.length
    ? '⚠ Có thể thiếu tin ở ' +
      history
        .slice(0, 3)
        .map((h) => h.group + (h.failed ? ' (không đọc được)' : ' (quá nhiều tin)'))
        .join(', ') +
      (history.length > 3 ? '…' : '') +
      '.'
    : '';
  const coverage = gapNotice(gaps);
  if (coverage || partial || skipped)
    return [coverage, partial, skipped].filter(Boolean).join('\n');
  if (report.scan?.warnings?.length)
    return '⚠ Kết quả chỉ dựa trên tin đã lưu; chưa xác nhận đủ lịch sử khoảng ngày đã chọn.';
  return '';
}
function gapNotice(gaps) {
  if (gaps.length) {
    const time = (t) =>
      Number.isFinite(t)
        ? new Date(t).toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '?';
    const parts = gaps
      .slice(0, 3)
      .map(
        (g) =>
          `${g.platform || 'Nguồn'}${g.account ? ' / ' + g.account : ''}: ${time(g.start)}–${time(g.end)}`,
      );
    return (
      '⚠ Bản tin có thể thiếu dữ liệu. ' +
      parts.join('; ') +
      (gaps.length > 3 ? ' và ' + (gaps.length - 3) + ' khoảng khác.' : '.')
    );
  }
  return '';
}
export function articleIcon(item) {
  const s = String(item.title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
  if (/viec lam|tuyen|freelance|nhan viec|co hoi|\bjob\b/.test(s)) return '💼';
  if (/tai nguyen|tai lieu|preset|template|resource|thu vien|font|asset/.test(s)) return '📚';
  if (
    /lỗi|^loi\b/i.test(String(item.title)) ||
    /khac phuc|sua may|khong len|man hinh den|crash/.test(s)
  )
    return '🛠️';
  if (/chon may|laptop|cau hinh|mua may/.test(s)) return '💻';
  if (/ban quyen|giay phep|license/.test(s)) return '⚖️';
  if (/youtube|video|dung|edit|premiere|capcut|intro|proxy/.test(s)) return '🎬';
  return '📌';
}
export function articleTitle(item) {
  const title = String(item.title || '');
  return /^\p{Extended_Pictographic}/u.test(title.trim()) ? title : articleIcon(item) + ' ' + title;
}

export function digestTopic(item) {
  const text = String(item.topic || item.title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
  if (/tai nguyen|tai lieu|preset|template|font|asset/.test(text)) return '📦 Tài nguyên';
  if (/youtube|intro|giu chan|ban quyen|nhac/.test(text)) return '📺 YouTube';
  if (/tuyen|viec lam|co hoi|brief/.test(text)) return '💼 Việc làm';
  if (/may tinh|laptop|cau hinh|may khong/.test(text)) return '💻 Máy tính';
  if (/video|dung|edit|proxy|premiere|motion/.test(text)) return '🎬 Dựng video';
  return '📌 Khác';
}
export function groupDigest(items) {
  const groups = new Map();
  for (const item of items) {
    const topic = digestTopic(item);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(item);
  }
  return [...groups].map(([topic, items]) => ({ topic, items }));
}
