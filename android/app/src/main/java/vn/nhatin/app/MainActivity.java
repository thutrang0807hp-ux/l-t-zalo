package vn.nhatin.app;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.text.*;
import android.view.*;
import android.widget.*;
import java.text.SimpleDateFormat;
import java.util.*;

public final class MainActivity extends Activity {
    private final int ink=Color.rgb(37,47,42), muted=Color.rgb(106,116,103), paper=Color.rgb(246,245,237), green=Color.rgb(52,84,70), orange=Color.rgb(188,83,55);
    private InboxStore store;
    private LinearLayout root, feed, statusPanel, chips;
    private TextView status, counter;
    private String query=""; private int dayFilter=0; private Set<String> chosenGroups;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private long revision=-1; private int renderedCount=0;
    private final Runnable ticker = new Runnable() { public void run() {
        updateStatus(); long current=InboxStore.preferences(MainActivity.this).getLong("revision",0);
        if (revision!=current) { revision=current; renderFeed(); } handler.postDelayed(this,2000);
    }};
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved); store=new InboxStore(this);
        chosenGroups=new HashSet<>(InboxStore.preferences(this).getStringSet("groups",Collections.emptySet()));
        build();
    }
    @Override protected void onResume() { super.onResume(); revision=-1; handler.removeCallbacks(ticker); handler.post(ticker); }
    @Override protected void onPause() { handler.removeCallbacks(ticker); super.onPause(); }
    @Override protected void onDestroy() { if (store!=null) store.close(); super.onDestroy(); }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private GradientDrawable background(int color,int radius) { GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius)); return d; }
    private LinearLayout column() { LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL); return l; }
    private TextView text(String value,int size,int color,boolean bold) {
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setLineSpacing(dp(3),1);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
    }
    private void margin(View v,int top,int bottom) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,dp(top),0,dp(bottom));v.setLayoutParams(p);
    }
    private Button button(String label,int color,Runnable action) {
        Button b=new Button(this);b.setText(label);b.setTextSize(13);b.setAllCaps(false);b.setTextColor(Color.WHITE);b.setBackground(background(color,12));b.setMinHeight(dp(48));b.setPadding(dp(14),dp(8),dp(14),dp(8));b.setOnClickListener(v->action.run());return b;
    }
    private void build() {
        root=column();root.setBackgroundColor(paper);root.setPadding(dp(22),dp(14),dp(22),dp(10));
        root.setOnApplyWindowInsetsListener((v,insets)-> { root.setPadding(dp(22),insets.getSystemWindowInsetTop()+dp(14),dp(22),insets.getSystemWindowInsetBottom()+dp(10));return insets; });
        setContentView(root);
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);
        TextView brand=text("⌂  Nhà Tin",25,green,true);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        TextView settings=text("Cài đặt",13,orange,true);settings.setPadding(dp(12),dp(14),0,dp(14));settings.setContentDescription("Mở cài đặt Nhà Tin");settings.setOnClickListener(v->settings());header.addView(settings);root.addView(header);
        TextView beta=text("ANDROID  ·  BẢN THỬ NGHIỆM 0.1.0",9,muted,true);beta.setLetterSpacing(.12f);margin(beta,5,20);root.addView(beta);
        statusPanel=column();statusPanel.setBackground(background(Color.rgb(231,237,224),14));statusPanel.setPadding(dp(16),dp(14),dp(16),dp(14));
        status=text("Đang kiểm tra quyền…",13,green,true);statusPanel.addView(status);
        TextView sub=text("Chỉ gom thông báo Zalo xuất hiện từ lúc bật quyền. Không lấy tin cũ, không đọc ảnh, không dùng AI/token.",11,muted,false);margin(sub,6,10);statusPanel.addView(sub);
        Button grant=button("Quyền đọc thông báo",green,()->accessExplanation());statusPanel.addView(grant);root.addView(statusPanel);
        TextView heading=text("Tin đã gom",24,ink,true);margin(heading,22,5);root.addView(heading);
        counter=text("Chưa có tin",11,muted,false);margin(counter,0,10);root.addView(counter);
        EditText search=new EditText(this);search.setSingleLine(true);search.setTextSize(13);search.setHint("Tìm nội dung, người gửi, nhóm…");search.setTextColor(ink);search.setHintTextColor(muted);search.setPadding(dp(13),dp(12),dp(13),dp(12));search.setBackground(background(Color.WHITE,10));root.addView(search);
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int st,int before,int count){query=s.toString();renderFeed();}public void afterTextChanged(Editable e){}});
        HorizontalScrollView filters=new HorizontalScrollView(this);filters.setHorizontalScrollBarEnabled(false);chips=new LinearLayout(this);chips.setPadding(0,dp(10),0,dp(10));filters.addView(chips);root.addView(filters);renderChips();
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);feed=column();scroll.addView(feed);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        TextView foot=text("Lưu tối đa 7 ngày / 10.000 tin · Dữ liệu nằm trên máy",9,muted,false);foot.setGravity(Gravity.CENTER);margin(foot,9,0);root.addView(foot);
        renderFeed();
    }
    private boolean granted() {
        String enabled=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");
        if(enabled==null)return false;
        ComponentName own=new ComponentName(this,ZaloNotificationService.class);
        for(String item:enabled.split(":"))if(own.equals(ComponentName.unflattenFromString(item)))return true;
        return false;
    }
    private void updateStatus() {
        boolean enabled=InboxStore.preferences(this).getBoolean("capture",true);
        String value=!granted()?"○  Chưa có quyền đọc thông báo":!enabled?"Ⅱ  Đang tạm dừng gom tin":ZaloNotificationService.connected?"●  Sẵn sàng nhận thông báo Zalo":"◌  Đang chờ Android kết nối dịch vụ";
        if (InboxStore.preferences(this).getBoolean("receive_error",false))value+="\nCó thông báo không đọc được. Thử tin khác.";
        status.setText(value);
        if(granted() && enabled && !ZaloNotificationService.connected) NotificationListenerService.requestRebind(new ComponentName(this,ZaloNotificationService.class));
    }
    private void accessExplanation() {
        new AlertDialog.Builder(this).setTitle("Cho Nhà Tin đọc thông báo?")
            .setMessage("Android cấp quyền truy cập thông báo của các ứng dụng. Nhà Tin chỉ xử lý thông báo có nguồn là Zalo; bỏ qua ứng dụng khác.\n\nTin được lưu cục bộ tối đa 7 ngày, không gửi tới máy chủ hay AI. Tin riêng cũng có thể xuất hiện nếu Zalo phát thông báo cho chúng.\n\nĐây không phải đăng nhập tài khoản Zalo. Nhóm tắt thông báo, nội dung bị ẩn, máy bỏ lỡ thông báo hoặc bị tiết kiệm pin có thể làm thiếu tin. Không dùng làm nguồn duy nhất cho việc quan trọng.")
            .setNegativeButton("Để sau",null).setPositiveButton("Mở cài đặt Android",(d,w)-> {
                try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }
                catch(ActivityNotFoundException e){ Toast.makeText(this,"Mở Cài đặt → Quyền truy cập thông báo → Nhà Tin",Toast.LENGTH_LONG).show(); }
            }).show();
    }
    private void renderChips() {
        chips.removeAllViews();String[] labels={"7 ngày","Hôm nay","Hôm qua","Chọn nhóm"};
        for(int i=0;i<labels.length;i++) {
            final int index=i;TextView c=text(labels[i],11,i==dayFilter?Color.WHITE:green,true);c.setGravity(Gravity.CENTER);c.setPadding(dp(13),dp(9),dp(13),dp(9));c.setBackground(background(i==dayFilter?green:Color.rgb(229,234,220),20));
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,-2);p.setMargins(0,0,dp(7),0);chips.addView(c,p);
            c.setOnClickListener(v->{if(index==3)selectGroups();else{dayFilter=index;renderChips();renderFeed();}});
        }
    }
    private List<Entry> visibleEntries() {
        List<Entry> out=new ArrayList<>(); Calendar start=Calendar.getInstance();start.set(Calendar.HOUR_OF_DAY,0);start.set(Calendar.MINUTE,0);start.set(Calendar.SECOND,0);start.set(Calendar.MILLISECOND,0);long midnight=start.getTimeInMillis();start.add(Calendar.DAY_OF_MONTH,-1);long yesterday=start.getTimeInMillis();
        for(Entry e:store.list()) {
            if(dayFilter==1 && e.time<midnight)continue;
            if(dayFilter==2 && (e.time<yesterday || e.time>=midnight))continue;
            if(!chosenGroups.isEmpty() && !chosenGroups.contains(e.group))continue;
            if(MessageRules.matches(e,query))out.add(e);
        }
        return out;
    }
    private void renderFeed() {
        if(feed==null)return;feed.removeAllViews();List<Entry> all=visibleEntries();
        LinkedHashMap<String,List<Entry>> groups=new LinkedHashMap<>();
        for(Entry e:all) {if(!groups.containsKey(e.group))groups.put(e.group,new ArrayList<>());groups.get(e.group).add(e);}
        counter.setText(all.size()+" tin · "+groups.size()+" cuộc trò chuyện"+(!chosenGroups.isEmpty()?" · Đang lọc nhóm":""));
        if(all.isEmpty()) {
            LinearLayout empty=column();empty.setPadding(dp(10),dp(25),dp(10),dp(20));
            empty.addView(text(query.isEmpty()?"Chưa có tin trong mục này.":"Chưa tìm thấy tin phù hợp.",18,ink,true));
            TextView hint=text(query.isEmpty()?"Bật quyền đọc thông báo, rồi nhờ ai đó gửi một tin Zalo khi bạn đang ở ngoài cuộc trò chuyện. Tin mới sẽ xuất hiện tại đây. Không tạo tin mẫu hoặc tự tải lịch sử cũ.":"Thử từ khóa khác, chọn 7 ngày hoặc bỏ lọc nhóm.",13,muted,false);margin(hint,12,15);empty.addView(hint);
            empty.addView(button("Kiểm tra cách nhận tin",green,()->troubleshoot()));feed.addView(empty);return;
        }
        Button share=button("Chia sẻ bản gom đang xem",green,()->share());margin(share,0,14);feed.addView(share);
        int groupLimit=0;
        for(Map.Entry<String,List<Entry>> group:groups.entrySet()) {
            if(groupLimit++>=50)break;
            LinearLayout card=column();card.setPadding(dp(16),dp(16),dp(16),dp(16));card.setBackground(background(Color.WHITE,14));margin(card,0,12);
            card.addView(text(group.getKey(),16,green,true));TextView meta=text(group.getValue().size()+" tin nhận từ thông báo Zalo",10,muted,false);margin(meta,4,10);card.addView(meta);
            int count=0;
            for(Entry e:group.getValue()) {
                if(count++>=3)break;
                TextView by=text((e.sender.isEmpty()?"Zalo":e.sender)+" · "+clock(e.time),10,muted,true);margin(by,9,4);card.addView(by);
                TextView body=text(e.text,13,ink,false);body.setMaxLines(4);body.setEllipsize(TextUtils.TruncateAt.END);card.addView(body);
            }
            TextView open=text("Xem tin trong nhóm →",12,orange,true);margin(open,15,0);open.setPadding(0,dp(6),0,dp(6));open.setOnClickListener(v->openGroup(group.getKey(),group.getValue()));card.addView(open);feed.addView(card);
        }
        if(groups.size()>50)feed.addView(text("Đang hiện 50 nhóm gần nhất. Dùng tìm kiếm hoặc Chọn nhóm để xem nhóm khác.",12,muted,false));
    }
    private String clock(long ts) {return new SimpleDateFormat("HH:mm · dd/MM",Locale.getDefault()).format(new Date(ts));}
    private void openGroup(String group,List<Entry> entries) {
        StringBuilder body=new StringBuilder();int count=0;
        for(Entry e:entries) {if(count++>=200){body.append("\nĐang hiển thị 200 tin gần nhất trong nhóm. Dùng tìm kiếm để thu hẹp.\n");break;}body.append(clock(e.time)).append(e.sender.isEmpty()?"":" · "+e.sender).append("\n").append(e.text).append("\n\n");}
        TextView content=text(body.toString(),14,ink,false);content.setTextIsSelectable(true);content.setPadding(dp(22),dp(10),dp(22),dp(10));ScrollView scroll=new ScrollView(this);scroll.addView(content);
        new AlertDialog.Builder(this).setTitle(group).setView(scroll).setNegativeButton("Đóng",null).setPositiveButton("Mở Zalo",(d,w)->openZalo()).show();
    }
    private void selectGroups() {
        TreeSet<String> names=new TreeSet<>();for(Entry e:store.list())names.add(e.group);
        if(names.isEmpty()){Toast.makeText(this,"Nhận ít nhất một thông báo Zalo trước để chọn nhóm.",Toast.LENGTH_LONG).show();return;}
        String[] labels=names.toArray(new String[0]);boolean[] checked=new boolean[labels.length];HashSet<String> draft=new HashSet<>(chosenGroups);
        for(int i=0;i<labels.length;i++)checked[i]=draft.contains(labels[i]);
        new AlertDialog.Builder(this).setTitle("Chỉ xem nhóm đã chọn")
            .setMultiChoiceItems(labels,checked,(d,index,on)->{if(on)draft.add(labels[index]);else draft.remove(labels[index]);})
            .setNeutralButton("Xem tất cả",(d,w)->{chosenGroups.clear();saveGroups();})
            .setNegativeButton("Hủy",null).setPositiveButton("Lưu bộ lọc",(d,w)->{chosenGroups=draft;saveGroups();}).show();
    }
    private void saveGroups(){InboxStore.preferences(this).edit().putStringSet("groups",new HashSet<>(chosenGroups)).apply();renderFeed();}
    private void share() {
        List<Entry> entries=visibleEntries();StringBuilder out=new StringBuilder("NHÀ TIN — BẢN GOM THÔNG BÁO\nChỉ gồm thông báo đã nhận; có thể thiếu tin.\n\n");
        int count=0;
        for(Entry e:entries){if(count++>=200 || out.length()>80000){out.append("\nĐã giới hạn bản chia sẻ. Thu hẹp bộ lọc để xem thêm.");break;}out.append(e.group).append(" · ").append(clock(e.time)).append("\n");if(!e.sender.isEmpty())out.append(e.sender).append(": ");out.append(e.text).append("\n\n");}
        new AlertDialog.Builder(this).setTitle("Chia sẻ nội dung đang xem?").setMessage("Bản chia sẻ có nội dung tin nhắn, tên nhóm và người gửi. Chỉ gửi tới nơi bạn muốn chia sẻ dữ liệu này.")
            .setNegativeButton("Hủy",null).setPositiveButton("Chọn ứng dụng",(d,w)->{Intent i=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,out.toString());startActivity(Intent.createChooser(i,"Chia sẻ bản gom"));}).show();
    }
    private void openZalo() {
        Intent i=getPackageManager().getLaunchIntentForPackage("com.zing.zalo");
        if(i==null)Toast.makeText(this,"Mở Zalo từ màn hình chính của điện thoại.",Toast.LENGTH_LONG).show();else startActivity(i);
    }
    private void troubleshoot() {
        new AlertDialog.Builder(this).setTitle("Khi chưa thấy tin Zalo")
            .setMessage("1. Bật quyền truy cập thông báo cho Nhà Tin.\n2. Cho phép Zalo gửi thông báo và hiển thị nội dung; thử với cuộc trò chuyện chưa tắt thông báo.\n3. Thoát màn hình cuộc trò chuyện Zalo, nhờ người khác gửi tin mới.\n4. Nếu máy ngắt dịch vụ, vào cài đặt pin và cho Nhà Tin hoạt động nền, rồi tắt/bật lại quyền thông báo.\n5. Một số Android mới yêu cầu Thông tin ứng dụng → menu ⋮ → Cho phép cài đặt bị hạn chế trước khi cấp quyền. Chỉ làm nếu bạn tin gói APK đã tải.\n\nKhông có cách bảo đảm thu đủ mọi tin qua thông báo. Nội dung bị Zalo ẩn chỉ lưu được phần hiển thị; bản này chưa phân tích ảnh hoặc tệp.")
            .setPositiveButton("Đã hiểu",null).setNeutralButton("Quyền thông báo",(d,w)->accessExplanation()).show();
    }
    private void settings() {
        boolean capture=InboxStore.preferences(this).getBoolean("capture",true);
        String[] options={capture?"Tạm dừng gom tin mới":"Tiếp tục gom tin mới","Quyền đọc thông báo","Cách kiểm tra nhận tin","Xóa toàn bộ tin đã gom","Về bản Android này"};
        new AlertDialog.Builder(this).setTitle("Cài đặt Nhà Tin").setItems(options,(d,index)->{
            if(index==0){InboxStore.preferences(this).edit().putBoolean("capture",!capture).apply();updateStatus();}
            if(index==1)accessExplanation();
            if(index==2)troubleshoot();
            if(index==3)new AlertDialog.Builder(this).setTitle("Xóa tin trên máy?").setMessage("Xóa toàn bộ tin đã gom trong Nhà Tin, không xóa tin trên Zalo. Không khôi phục được.").setNegativeButton("Hủy",null).setPositiveButton("Xóa tin",(a,b)->{store.clear();chosenGroups.clear();saveGroups();}).show();
            if(index==4)new AlertDialog.Builder(this).setTitle("Nhà Tin Android 0.1.0")
                .setMessage("Ứng dụng native Android, gom thông báo Zalo và lọc trên máy. Không phải APK giao diện mô phỏng, không đăng nhập hoặc điều khiển tài khoản Zalo.\n\nKhông có quyền Internet, không gọi AI và không tốn token. Chưa có tóm tắt AI hoặc gửi Telegram tự động. Có thể chia sẻ bản gom bằng menu chia sẻ Android.\n\nDữ liệu nằm trong bộ nhớ riêng của app, không sao lưu đám mây; gỡ app sẽ xóa dữ liệu. Giữ tối đa 7 ngày và 10.000 tin; không bảo đảm đầy đủ lịch sử. Chưa xác minh với Zalo trên điện thoại thật.").setPositiveButton("Đóng",null).show();
        }).setNegativeButton("Đóng",null).show();
    }
}
