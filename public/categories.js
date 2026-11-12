export const GROUP_TOPICS = [
  'Dựng video / Editor',
  'YouTube / Nội dung',
  'Tài liệu / Tài nguyên',
  'Việc làm',
];
export function suggestGroupTopics(name) {
  const s = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
  const out = [];
  if (
    /editor|video edit|dung (?:video|phim|clip)|premiere|capcut|after effects|motion|davinci/.test(
      s,
    )
  )
    out.push(GROUP_TOPICS[0]);
  if (/youtube|youtuber|content|noi dung|creator|tiktok/.test(s)) out.push(GROUP_TOPICS[1]);
  if (/tai lieu|tai nguyen|preset|template|resource|asset|font|stock|chia se cong cu/.test(s))
    out.push(GROUP_TOPICS[2]);
  if (/viec lam|tuyen dung|tuyen editor|job|freelance|recruit/.test(s)) out.push(GROUP_TOPICS[3]);
  return out.length ? out : ['Chưa phân loại'];
}
export function groupTopics(group) {
  return group.categories === null || group.categories === undefined
    ? suggestGroupTopics(group.name)
    : group.categories.length
      ? group.categories
      : ['Chưa phân loại'];
}
export function validateGroupTopics(value) {
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length > 8 ||
    value.some((x) => typeof x !== 'string' || !x.trim() || x.trim().length > 50)
  )
    throw Error('Mỗi nhóm tối đa 8 chủ đề, tên chủ đề tối đa 50 ký tự');
  return [...new Set(value.map((x) => x.trim()))];
}
export function topicLabel(label, settings = {}) {
  const aliases = settings.aliases || {};
  return Object.hasOwn(aliases, label) ? aliases[label] : label;
}
export function validateTopicSettings(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray(value.custom) ||
    value.custom.length > 40 ||
    !value.aliases ||
    typeof value.aliases !== 'object' ||
    Array.isArray(value.aliases) ||
    Object.keys(value.aliases).length > 100
  )
    throw Error('Danh sách chủ đề không hợp lệ');
  const valid = (s) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 50;
  if (
    value.custom.some((s) => !valid(s)) ||
    Object.entries(value.aliases).some(([a, b]) => !valid(a) || !valid(b))
  )
    throw Error('Tên chủ đề tối đa 50 ký tự');
  return {
    custom: [...new Set(value.custom.map((s) => s.trim()))],
    aliases: Object.fromEntries(
      Object.entries(value.aliases).map(([a, b]) => [a.trim(), b.trim()]),
    ),
  };
}
