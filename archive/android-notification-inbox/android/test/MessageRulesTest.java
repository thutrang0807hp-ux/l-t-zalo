import vn.nhatin.app.Entry;
import vn.nhatin.app.MessageRules;
public class MessageRulesTest {
    private static void check(boolean b, String message) { if(!b)throw new AssertionError(message); }
    public static void main(String[] args) {
        Entry e=new Entry("Nhóm Dựng Video", "Đức", "Chia sẻ tài nguyên Premiere", 100);
        check(MessageRules.matches(e,"duc tai nguyen"),"Vietnamese accent-insensitive sender/content matching");
        check(MessageRules.matches(e,"DỰNG VIDEO"),"Group name matching");
        check(!MessageRules.matches(e,"premiere blender"),"All query terms must match");
        check(MessageRules.matches(e,"  "),"Blank query includes entries");
        check(MessageRules.isSummary("Bạn có 12 tin nhắn mới"),"Skip generic notification counts");
        check(MessageRules.isSummary("4 new messages"),"Skip English notification counts");
        check(!MessageRules.isSummary("Có 12 bài hướng dẫn trong link này"),"Do not discard real content containing counts");
        check(MessageRules.retentionCutoff(1000000000L)==395200000L,"Seven day retention cutoff");
        System.out.println("PASS: 8 filter, normalization, notification-summary and retention assertions");
    }
}
