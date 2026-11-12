package vn.nhatin.app;
import java.text.Normalizer;
import java.util.Locale;
public final class MessageRules {
    private MessageRules() {}
    public static String searchable(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);
    }
    public static boolean matches(Entry e, String query) {
        String haystack = searchable(e.group + " " + e.sender + " " + e.text);
        for (String word : searchable(query).trim().split("\\s+")) {
            if (!word.isEmpty() && !haystack.contains(word)) return false;
        }
        return true;
    }
    public static boolean isSummary(String text) {
        String s = searchable(text).trim();
        return s.isEmpty() || s.matches("(?:ban co )?\\d+ (?:tin nhan|thong bao)(?: moi)?[.!]?")
            || s.matches("\\d+ new messages?[.!]?");
    }
    public static long retentionCutoff(long now) { return now - 7L * 24 * 60 * 60 * 1000; }
}
