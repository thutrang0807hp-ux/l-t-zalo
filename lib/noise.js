// Messages with no information ("ok", "haha", emoji, thanks) are dropped before the AI reads them,
// so the owner does not pay for them. They stay stored and can still be opened as sources.
const FILLER = new Set(
  [
    'ok',
    'oke',
    'okay',
    'okela',
    'okie',
    'uk',
    'uh',
    'ừ',
    'ừm',
    'um',
    'dạ',
    'vâng',
    'ờ',
    'à',
    'ạ',
    'yes',
    'no',
    'có',
    'không',
    'ko',
    'k',
    'haha',
    'hihi',
    'hehe',
    'hix',
    'huhu',
    'kk',
    'lol',
    'cảm ơn',
    'cám ơn',
    'cảm ơn bạn',
    'cảm ơn ạ',
    'thanks',
    'thank you',
    'tks',
    'thank',
    'like',
    'đúng rồi',
    'chuẩn',
    'xin chào',
    'chào',
    'hello',
    'hi',
  ].map((w) => w.normalize('NFC')),
);
export function isNoise(content) {
  const text = String(content)
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    // Emoji, punctuation, Zalo emoticons like :)) =)) :v and repeated letters (hahaha, kkkk).
    .replace(/[\p{Extended_Pictographic}\p{P}\p{S}️‍]/gu, ' ')
    .replace(/(^|\s)[:;=x]?[)(dpv3]+(?=\s|$)/g, ' ')
    .replace(/(\p{L})\1{2,}/gu, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return true;
  if (/^(ha|hi|he|ke|k)+$/.test(text.replace(/\s/g, ''))) return true;
  return FILLER.has(text);
}
