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
    private final int ink=Color.rgb(43,40,62), muted=Color.rgb(139,130,157), paper=Color.rgb(248,249,253), green=Color.rgb(117,97,223), orange=Color.rgb(117,97,223);
    private InboxStore store;
    private LinearLayout root, feed, statusPanel, chips;
    private TextView status, counter, pageTitle, pageSubtitle;
    private LinearLayout bottomNav;
    private EditText searchInput;
    private HorizontalScrollView filters;
    private int activeTab=0;
    private Set<String> savedGroups=new HashSet<>();
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
        savedGroups=new HashSet<>(InboxStore.preferences(this).getStringSet("saved_groups",Collections.emptySet()));
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
        root=column();root.setBackgroundColor(paper);root.setPadding(dp(20),dp(12),dp(20),dp(8));
        root.setOnApplyWindowInsetsListener((v,insets)-> { root.setPadding(dp(20),insets.getSystemWindowInsetTop()+dp(12),dp(20),insets.getSystemWindowInsetBottom()+dp(8));return insets; });
        setContentView(root);
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo=text("⌂",22,Color.WHITE,true);logo.setGravity(Gravity.CENTER);logo.setBackground(background(green,11));header.addView(logo,new LinearLayout.LayoutParams(dp(35),dp(35)));
        TextView brand=text("  nhà tin.",24,ink,true);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        TextView settings=text("Cài đặt",11,green,true);settings.setPadding(dp(12),dp(13),0,dp(13));settings.setContentDescription("Mở cài đặt Nhà Tin");settings.setOnClickListener(v->setTab(3));header.addView(settings);root.addView(header);
        TextView date=text(new SimpleDateFormat("EEEE, d MMMM",new Locale("vi","VN")).format(new Date()),10,muted,false);margin(date,25,8);root.addView(date);
        pageTitle=text("Hộp tin của bạn.",28,ink,true);root.addView(pageTitle);
        pageSubtitle=text("Tin cần xem, gom lại một chỗ.",11,muted,false);margin(pageSubtitle,5,12);root.addView(pageSubtitle);
        status=text("Đang kiểm tra kết nối…",10,muted,false);status.setPadding(0,dp(5),0,dp(8));status.setOnClickListener(v->accessExplanation());root.addView(status);
        counter=text("Chưa có tin",10,muted,false);margin(counter,4,10);root.addView(counter);
        searchInput=new EditText(this);searchInput.setSingleLine(true);searchInput.setTextSize(12);searchInput.setHint("Tìm nhóm, nội dung, người gửi…");searchInput.setTextColor(ink);searchInput.setHintTextColor(muted);searchInput.setPadding(dp(14),dp(11),dp(14),dp(11));searchInput.setBackground(background(Color.WHITE,12));root.addView(searchInput);
        searchInput.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int st,int before,int count){query=s.toString();renderFeed();}public void afterTextChanged(Editable e){}});
        filters=new HorizontalScrollView(this);filters.setHorizontalScrollBarEnabled(false);chips=new LinearLayout(this);chips.setPadding(0,dp(12),0,dp(13));filters.addView(chips);root.addView(filters);renderChips();
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setClipToPadding(false);feed=column();scroll.addView(feed);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        bottomNav=new LinearLayout(this);bottomNav.setGravity(Gravity.CENTER);bottomNav.setPadding(0,dp(12),0,dp(3));root.addView(bottomNav);renderBottomNav();
        renderFeed();
    }
    private void setTab(int tab) {
        activeTab=tab;query="";searchInput.setText("");
        String[] titles={"Hộp tin của bạn.","Nhóm của bạn.","Dành để xem lại.","Theo cách của bạn."};
        String[] subtitles={"Tin cần xem, gom lại một chỗ.","Những cuộc trò chuyện đã có thông báo.","Các nhóm bạn đã lưu để tìm lại nhanh.","Kết nối, dữ liệu và quyền riêng tư."};
        pageTitle.setText(titles[tab]);pageSubtitle.setText(subtitles[tab]);
        searchInput.setVisibility(tab==3?View.GONE:View.VISIBLE);filters.setVisibility(tab==3||tab==1?View.GONE:View.VISIBLE);
        renderBottomNav();renderFeed();
    }
    private void renderBottomNav() {
        bottomNav.removeAllViews();String[] labels={"Hộp tin","Nhóm","Đã lưu","Cài đặt"};String[] symbols={"▤","◉","◇","⚙"};
        for(int i=0;i<labels.length;i++) {
            final int tab=i;LinearLayout item=column();item.setGravity(Gravity.CENTER);item.setPadding(dp(3),dp(7),dp(3),dp(7));item.setBackground(background(activeTab==i?Color.rgb(240,235,252):paper,12));
            TextView glyph=text(symbols[i],19,activeTab==i?green:muted,false);glyph.setGravity(Gravity.CENTER);item.addView(glyph);
            TextView label=text(labels[i],9,activeTab==i?green:muted,activeTab==i);label.setGravity(Gravity.CENTER);margin(label,4,0);item.addView(label);
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(63),1);lp.setMargins(dp(2),0,dp(2),0);bottomNav.addView(item,lp);item.setOnClickListener(v->setTab(tab));item.setContentDescription(labels[i]);
        }
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
        String value=!granted()?"○  Chưa bật quyền · Chạm để thiết lập":!enabled?"Ⅱ  Đang tạm dừng gom tin":ZaloNotificationService.connected?"●  Đang nhận thông báo Zalo · Lưu trên máy":"◌  Đang chờ Android kết nối dịch vụ";
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
            final int index=i;TextView c=text(labels[i],11,i==dayFilter?Color.WHITE:green,true);c.setGravity(Gravity.CENTER);c.setPadding(dp(13),dp(9),dp(13),dp(9));c.setBackground(background(i==dayFilter?green:Color.rgb(239,235,249),20));
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
            if(activeTab==2 && !savedGroups.contains(e.group))continue;
            if(MessageRules.matches(e,query))out.add(e);
        }
        return out;
    }
    private void renderFeed() {
        if(feed==null)return;feed.removeAllViews();
        if(activeTab==3){renderSettingsPage();return;}
        if(activeTab==1){renderGroupsPage();return;}
        List<Entry> all=visibleEntries();LinkedHashMap<String,List<Entry>> groups=new LinkedHashMap<>();
        for(Entry e:all){if(!groups.containsKey(e.group))groups.put(e.group,new ArrayList<>());groups.get(e.group).add(e);}
        counter.setText(groups.size()+" nhóm · "+all.size()+" tin"+(!chosenGroups.isEmpty()?" · Đang lọc nhóm":""));
        if(activeTab==0 && query.isEmpty()){
            LinearLayout hero=column();hero.setBackground(background(Color.rgb(240,235,252),17));hero.setPadding(dp(21),dp(19),dp(21),dp(19));margin(hero,0,17);
            hero.addView(text("MỘT CHÚT GỌN GÀNG CHO NGÀY MỚI",8,green,true));
            TextView title=text("Không cần đọc hết.\nChỉ cần tìm đúng tin.",22,Color.rgb(78,64,112),true);margin(title,11,9);hero.addView(title);
            hero.addView(text("Thông báo Zalo ở một chỗ. Bạn chọn điều đáng dành thời gian.",11,muted,false));feed.addView(hero);
        }
        if(all.isEmpty()){
            LinearLayout empty=column();empty.setPadding(dp(19),dp(25),dp(19),dp(25));empty.setBackground(background(Color.WHITE,15));
            empty.addView(text(activeTab==2?"Dành chỗ cho tin cần xem lại.":query.isEmpty()?"Tin mới sẽ ở đây.":"Chưa tìm thấy tin phù hợp.",18,ink,true));
            TextView hint=text(activeTab==2?"Lưu một nhóm trong hộp tin để tìm nhanh tại đây.":query.isEmpty()?"Bật quyền đọc thông báo, rồi thử nhận một tin Zalo mới. App không tạo tin mẫu hoặc tải lịch sử cũ.":"Thử từ khóa khác hoặc đổi khoảng ngày.",12,muted,false);margin(hint,12,19);empty.addView(hint);
            empty.addView(button(activeTab==2?"Về hộp tin":"Kiểm tra cách nhận tin",green,()->{if(activeTab==2)setTab(0);else troubleshoot();}));feed.addView(empty);return;
        }
        int limit=0;
        for(Map.Entry<String,List<Entry>> group:groups.entrySet()){
            if(limit++>=50)break;String name=group.getKey();List<Entry> entries=group.getValue();Entry latest=entries.get(0);
            LinearLayout card=column();card.setBackground(background(Color.WHITE,16));card.setPadding(dp(17),dp(17),dp(17),dp(13));margin(card,0,13);
            LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
            TextView avatar=text(name.isEmpty()?"Z":name.substring(0,1).toUpperCase(Locale.ROOT),16,green,true);avatar.setGravity(Gravity.CENTER);avatar.setBackground(background(Color.rgb(239,232,251),12));top.addView(avatar,new LinearLayout.LayoutParams(dp(39),dp(39)));
            LinearLayout names=column();names.setPadding(dp(11),0,dp(7),0);names.addView(text("CUỘC TRÒ CHUYỆN ZALO",8,muted,false));TextView label=text(name,13,ink,true);label.setMaxLines(2);names.addView(label);top.addView(names,new LinearLayout.LayoutParams(0,-2,1));
            TextView save=text(savedGroups.contains(name)?"◆":"◇",23,green,false);save.setGravity(Gravity.CENTER);top.addView(save,new LinearLayout.LayoutParams(dp(35),dp(44)));save.setContentDescription(savedGroups.contains(name)?"Bỏ lưu nhóm":"Lưu nhóm");save.setOnClickListener(v->toggleSaved(name));card.addView(top);
            LinearLayout preview=column();preview.setPadding(dp(13),dp(12),dp(13),dp(13));preview.setBackground(background(Color.rgb(249,247,252),11));margin(preview,14,12);
            preview.addView(text((latest.sender.isEmpty()?"Zalo":latest.sender)+" · "+clock(latest.time),9,muted,false));TextView content=text(latest.text,12,Color.rgb(115,104,132),false);content.setMaxLines(3);content.setEllipsize(TextUtils.TruncateAt.END);margin(content,6,0);preview.addView(content);card.addView(preview);
            LinearLayout bottom=new LinearLayout(this);bottom.setGravity(Gravity.CENTER_VERTICAL);TextView count=text(entries.size()+" tin đã gom",9,muted,false);bottom.addView(count,new LinearLayout.LayoutParams(0,-2,1));TextView open=text("Xem cuộc trò chuyện →",10,green,true);open.setPadding(dp(8),dp(10),0,dp(10));bottom.addView(open);open.setOnClickListener(v->openGroup(name,entries));card.addView(bottom);feed.addView(card);
        }
        if(groups.size()>50)feed.addView(text("Hiện 50 nhóm gần nhất. Dùng tìm kiếm để xem nhóm khác.",11,muted,false));
        TextView share=text("Chia sẻ bản gom đang xem ↗",11,green,true);share.setGravity(Gravity.CENTER);share.setPadding(dp(10),dp(18),dp(10),dp(20));share.setOnClickListener(v->share());feed.addView(share);
    }
    private void toggleSaved(String group){
        if(savedGroups.contains(group))savedGroups.remove(group);else savedGroups.add(group);
        InboxStore.preferences(this).edit().putStringSet("saved_groups",new HashSet<>(savedGroups)).apply();renderFeed();
    }
    private void renderGroupsPage(){
        LinkedHashMap<String,List<Entry>> groups=new LinkedHashMap<>();
        for(Entry e:store.list()){if(!MessageRules.matches(e,query))continue;if(!groups.containsKey(e.group))groups.put(e.group,new ArrayList<>());groups.get(e.group).add(e);}
        counter.setText(groups.size()+" cuộc trò chuyện trong kho");
        if(groups.isEmpty()){TextView empty=text("Nhóm sẽ xuất hiện sau khi nhận thông báo Zalo đầu tiên. Không tự tải danh sách nhóm tài khoản.",13,muted,false);margin(empty,12,20);feed.addView(empty);feed.addView(button("Cách nhận tin mới",green,()->troubleshoot()));return;}
        Button choose=button("Chọn nhóm hiển thị trong hộp tin",green,()->selectGroups());margin(choose,5,17);feed.addView(choose);
        for(Map.Entry<String,List<Entry>> g:groups.entrySet()){
            LinearLayout card=column();card.setPadding(dp(18),dp(17),dp(18),dp(17));card.setBackground(background(Color.WHITE,14));margin(card,0,12);card.addView(text(g.getKey(),14,ink,true));TextView details=text(g.getValue().size()+" tin từ thông báo · "+(chosenGroups.isEmpty()||chosenGroups.contains(g.getKey())?"Hiện trong hộp tin":"Đang ẩn khỏi hộp tin"),10,muted,false);margin(details,7,10);card.addView(details);TextView view=text("Xem nội dung đã gom →",11,green,true);view.setPadding(0,dp(9),0,dp(9));view.setOnClickListener(v->openGroup(g.getKey(),g.getValue()));card.addView(view);feed.addView(card);
        }
    }
    private void renderSettingsPage(){
        counter.setText("Dữ liệu nằm trên máy · Không gọi AI/token");
        LinearLayout card=column();card.setBackground(background(Color.WHITE,16));card.setPadding(dp(19),dp(20),dp(19),dp(20));margin(card,0,16);card.addView(text("Kết nối & quyền",19,ink,true));
        TextView note=text("Nhà Tin chỉ gom nội dung có trong thông báo Zalo. Quyền được cấp trong cài đặt Android.",12,muted,false);margin(note,9,17);card.addView(note);card.addView(button("Quyền đọc thông báo",green,()->accessExplanation()));
        boolean capture=InboxStore.preferences(this).getBoolean("capture",true);TextView pause=text(capture?"Tạm dừng gom tin mới":"Tiếp tục gom tin mới",12,green,true);pause.setPadding(0,dp(21),0,dp(10));pause.setOnClickListener(v->{InboxStore.preferences(this).edit().putBoolean("capture",!capture).apply();updateStatus();renderFeed();});card.addView(pause);feed.addView(card);
        LinearLayout data=column();data.setBackground(background(Color.WHITE,16));data.setPadding(dp(19),dp(20),dp(19),dp(20));data.addView(text("Riêng tư & dữ liệu",19,ink,true));TextView info=text("Lưu tối đa 7 ngày / 10.000 tin. Chưa có AI tóm tắt hoặc gửi Telegram tự động. App không đọc lịch sử cũ.",12,muted,false);margin(info,10,17);data.addView(info);
        TextView help=text("Cách kiểm tra nhận tin →",12,green,true);help.setPadding(0,dp(10),0,dp(14));help.setOnClickListener(v->troubleshoot());data.addView(help);
        TextView more=text("Quản lý dữ liệu & thông tin ứng dụng →",12,green,true);more.setPadding(0,dp(9),0,dp(9));more.setOnClickListener(v->settings());data.addView(more);feed.addView(data);
    }
    private String clock(long ts) {return new SimpleDateFormat("HH:mm · dd/MM",Locale.getDefault()).format(new Date(ts));}
    private void openGroup(String group,List<Entry> entries) {
        StringBuilder body=new StringBuilder();int count=0;
        for(Entry e:entries) {if(count++>=200){body.append("\nĐang hiển thị 200 tin gần nhất trong nhóm. Dùng tìm kiếm để thu hẹp.\n");break;}body.append(clock(e.time)).append(e.sender.isEmpty()?"":" · "+e.sender).append("\n").append(e.text).append("\n\n");}
        TextView content=text(body.toString(),14,ink,false);content.setTextIsSelectable(true);content.setPadding(dp(22),dp(10),dp(22),dp(10));ScrollView scroll=new ScrollView(this);scroll.addView(content);
        new AlertDialog.Builder(this).setTitle(group).setView(scroll).setNegativeButton("Đóng",null).setNeutralButton(savedGroups.contains(group)?"Bỏ lưu nhóm":"Lưu nhóm",(d,w)->toggleSaved(group)).setPositiveButton("Mở Zalo",(d,w)->openZalo()).show();
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
            if(index==3)new AlertDialog.Builder(this).setTitle("Xóa tin trên máy?").setMessage("Xóa toàn bộ tin đã gom trong Nhà Tin, không xóa tin trên Zalo. Không khôi phục được.").setNegativeButton("Hủy",null).setPositiveButton("Xóa tin",(a,b)->{store.clear();chosenGroups.clear();savedGroups.clear();InboxStore.preferences(this).edit().remove("saved_groups").apply();saveGroups();}).show();
            if(index==4)new AlertDialog.Builder(this).setTitle("Nhà Tin Android 0.2.0")
                .setMessage("Ứng dụng native Android, gom thông báo Zalo và lọc trên máy. Không phải APK giao diện mô phỏng, không đăng nhập hoặc điều khiển tài khoản Zalo.\n\nKhông có quyền Internet, không gọi AI và không tốn token. Chưa có tóm tắt AI hoặc gửi Telegram tự động. Có thể chia sẻ bản gom bằng menu chia sẻ Android.\n\nDữ liệu nằm trong bộ nhớ riêng của app, không sao lưu đám mây; gỡ app sẽ xóa dữ liệu. Giữ tối đa 7 ngày và 10.000 tin; không bảo đảm đầy đủ lịch sử. Chưa xác minh với Zalo trên điện thoại thật.").setPositiveButton("Đóng",null).show();
        }).setNegativeButton("Đóng",null).show();
    }
}
