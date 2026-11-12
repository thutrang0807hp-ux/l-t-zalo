package vn.nhatin.app;
import android.app.Notification;
import android.os.Bundle;
import android.service.notification.*;
import java.util.*;
public final class ZaloNotificationService extends NotificationListenerService {
    public static volatile boolean connected = false;
    private InboxStore store;
    @Override public void onCreate() { super.onCreate(); store = new InboxStore(this); }
    @Override public void onListenerConnected() { connected = true; }
    @Override public void onListenerDisconnected() { connected = false; }
    @Override public void onDestroy() { connected = false; if (store != null) store.close(); super.onDestroy(); }
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !"com.zing.zalo".equals(sbn.getPackageName()) || !InboxStore.preferences(this).getBoolean("capture", true)) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        try {
            List<Entry> entries = extract(n, sbn.getPostTime());
            if (!entries.isEmpty()) {
                store.add(entries, System.currentTimeMillis());
                InboxStore.preferences(this).edit().putLong("last_seen", System.currentTimeMillis()).remove("receive_error").apply();
            }
        } catch (RuntimeException e) {
            // Notification extras differ across Zalo/OEM versions. Do not log message content.
            InboxStore.preferences(this).edit().putBoolean("receive_error", true).apply();
        }
    }
    static List<Entry> extract(Notification n, long postTime) {
        ArrayList<Entry> out = new ArrayList<>(); Bundle b = n.extras;
        if (b == null) return out;
        android.os.Parcelable[] bundles = b.getParcelableArray(Notification.EXTRA_MESSAGES);
        List<Notification.MessagingStyle.Message> messages = bundles == null
            ? Collections.emptyList() : Notification.MessagingStyle.Message.getMessagesFromBundleArray(bundles);
        String title = str(b.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE));
        if (title.isEmpty()) title = str(b.getCharSequence(Notification.EXTRA_TITLE));
        if (title.isEmpty()) title = "Zalo — chưa rõ cuộc trò chuyện";
        if (!messages.isEmpty()) {
            for (Notification.MessagingStyle.Message m : messages) {
                String sender = str(m.getSender());
                long ts = m.getTimestamp() > 0 ? m.getTimestamp() : postTime;
                String text = str(m.getText());
                // Media-only notifications have no text to summarize.
                if (!text.isEmpty()) out.add(new Entry(title, sender, text, ts));
            }
            return out;
        }
        CharSequence big = b.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String text = str(big);
        if (text.isEmpty()) text = str(b.getCharSequence(Notification.EXTRA_TEXT));
        // Without MessagingStyle timestamps, deduplicate repeated notification updates using
        // notification.when (the original event time) rather than a fresh callback timestamp.
        long ts = n.when > 0 ? n.when : postTime;
        if (!MessageRules.isSummary(text)) out.add(new Entry(title, "", text, ts));
        return out;
    }
    private static String str(CharSequence value) { return value == null ? "" : value.toString().trim(); }
}
