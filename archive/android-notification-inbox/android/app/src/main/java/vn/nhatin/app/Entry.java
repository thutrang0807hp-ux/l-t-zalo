package vn.nhatin.app;
public final class Entry {
    public final String group, sender, text;
    public final long time;
    public Entry(String group, String sender, String text, long time) {
        this.group = clean(group); this.sender = clean(sender); this.text = clean(text); this.time = time;
    }
    private static String clean(String s) { return s == null ? "" : s.trim(); }
}
