package vn.nhatin.app;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import java.util.*;
public final class InboxStore extends SQLiteOpenHelper {
    private final Context context;
    public InboxStore(Context context) { super(context.getApplicationContext(), "nhatin.db", null, 1); this.context = context.getApplicationContext(); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE inbox(id INTEGER PRIMARY KEY, group_name TEXT NOT NULL,sender TEXT NOT NULL,body TEXT NOT NULL,message_time INTEGER NOT NULL,UNIQUE(group_name,sender,body,message_time))");
        db.execSQL("CREATE INDEX inbox_time ON inbox(message_time)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
    public static android.content.SharedPreferences preferences(Context c) { return c.getSharedPreferences("nhatin", Context.MODE_PRIVATE); }
    public static void changed(Context c) { preferences(c).edit().putLong("revision", preferences(c).getLong("revision", 0) + 1).apply(); }
    public synchronized void add(List<Entry> entries, long now) {
        SQLiteDatabase db = getWritableDatabase(); boolean added = false;
        db.beginTransaction();
        try {
            for (Entry e : entries) {
                if (e.group.isEmpty() || MessageRules.isSummary(e.text) || e.time < MessageRules.retentionCutoff(now)) continue;
                ContentValues v = new ContentValues(); v.put("group_name", e.group); v.put("sender", e.sender); v.put("body", e.text); v.put("message_time", e.time);
                if (db.insertWithOnConflict("inbox", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1) added = true;
            }
            int deleted = db.delete("inbox", "message_time<?", new String[]{Long.toString(MessageRules.retentionCutoff(now))});
            // Bound local storage on unusually busy devices; oldest entries are removed first.
            db.execSQL("DELETE FROM inbox WHERE id NOT IN (SELECT id FROM inbox ORDER BY message_time DESC,id DESC LIMIT 10000)");
            db.setTransactionSuccessful(); if (deleted > 0) added = true;
        } finally { db.endTransaction(); }
        if (added) changed(context);
    }
    public List<Entry> list() {
        ArrayList<Entry> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT group_name,sender,body,message_time FROM inbox WHERE message_time>=? ORDER BY message_time DESC,id DESC LIMIT 10000", new String[]{Long.toString(MessageRules.retentionCutoff(System.currentTimeMillis()))})) {
            while (c.moveToNext()) out.add(new Entry(c.getString(0),c.getString(1),c.getString(2),c.getLong(3)));
        }
        return out;
    }
    public void clear() { getWritableDatabase().delete("inbox", null, null); changed(context); }
}
