export const categories = ['Tất cả', 'Công việc', 'Tài nguyên', 'Cộng đồng'];
export const groupInfo = [
 {id:'editors',name:'Cộng đồng Video Editor',category:'Cộng đồng',initials:'VE',color:'violet',description:'Kinh nghiệm dựng phim & hậu kỳ',members:'Nhóm mẫu'},
 {id:'project',name:'Dự án Mây Studio',category:'Công việc',initials:'M',color:'peach',description:'Trao đổi tiến độ và phản hồi dự án',members:'Nhóm mẫu'},
 {id:'resources',name:'Kho tài nguyên sáng tạo',category:'Tài nguyên',initials:'KR',color:'mint',description:'Font, preset và tài nguyên thiết kế',members:'Nhóm mẫu'},
 {id:'jobs',name:'Việc làm ngành sáng tạo',category:'Công việc',initials:'JL',color:'blue',description:'Thông tin cộng tác và tuyển dụng',members:'Nhóm mẫu'},
 {id:'design',name:'Góc nhỏ thiết kế',category:'Cộng đồng',initials:'GN',color:'pink',description:'Chia sẻ ý tưởng và góc làm việc',members:'Nhóm mẫu'},
 {id:'audio',name:'Âm thanh & bản quyền',category:'Tài nguyên',initials:'AU',color:'sand',description:'Thư viện âm thanh và lưu ý sử dụng',members:'Nhóm mẫu'},
];
export function seedMessages(now=Date.now()) {
 const t=(minutes)=>now-minutes*60000;
 return [
 {id:'e1',group:'editors',sender:'Hoàng Minh',text:'Mình vừa thử workflow proxy cho footage 4K. Tạo proxy ở 1/4 độ phân giải rồi bật Toggle Proxies, timeline nhẹ hơn hẳn. Ai đang dùng Premiere có thể thử nhé.',time:t(8)},
 {id:'e2',group:'editors',sender:'Trà My',text:'Cảm ơn Minh. Nhớ kiểm tra lại file gốc trước khi xuất bản cuối nhé, nhất là những đoạn có hiệu ứng.',time:t(5)},
 {id:'p1',group:'project',sender:'Linh Nguyễn',text:'Khách đã phản hồi bản dựng vòng 2: giữ nhạc hiện tại, rút phần mở đầu còn 5 giây. Mọi người xem lại góp ý trong tài liệu chung giúp mình.',time:t(23)},
 {id:'p2',group:'project',sender:'Tuấn Anh',text:'Mình nhận phần chỉnh intro. Chiều mình gửi lại bản để cả nhóm cùng xem, chưa chốt thời gian xuất bản nhé.',time:t(20)},
 {id:'r1',group:'resources',sender:'An Phạm',text:'Chia sẻ một bộ font tiếng Việt cho dự án cá nhân. Mọi người đọc kỹ license từng font trước khi dùng cho khách hàng nhé.',time:t(42)},
 {id:'r2',group:'resources',sender:'Mai Anh',text:'Có font hỗ trợ đủ dấu tiếng Việt không An? Mình đang làm một bộ tiêu đề cho video.',time:t(39)},
 {id:'j1',group:'jobs',sender:'Quỳnh Trần',text:'Team đang tìm editor cộng tác dựng video ngắn. Cần biết Premiere và có portfolio. Bạn nào quan tâm nhắn mình để trao đổi phạm vi và chi phí.',time:t(65)},
 {id:'d1',group:'design',sender:'Khánh Duy',text:'Mọi người hay dùng hệ thống spacing 4px hay 8px cho mobile app? Mình đang thử layout có nhiều nội dung nhưng muốn nhìn thoáng hơn.',time:t(102)},
 {id:'a1',group:'audio',sender:'Hà Lê',text:'Nhắc nhẹ: nhạc ghi miễn phí chưa chắc cho phép dùng trong quảng cáo. Kiểm tra điều khoản riêng của từng bài trước khi xuất video nhé.',time:t(145)},
 {id:'a2',group:'audio',sender:'Minh Anh',text:'Đúng rồi, có thư viện yêu cầu ghi nguồn. Mình thường lưu lại trang giấy phép cùng file nhạc cho dễ tra cứu.',time:t(139)},
 {id:'old1',group:'project',sender:'Linh Nguyễn',text:'Mình đã gửi bản dựng vòng 2 để khách xem. Còn chờ phản hồi, chưa coi là bản duyệt cuối nhé.',time:t(24*60+30)},
 {id:'old2',group:'resources',sender:'An Phạm',text:'Cuối tuần mình sẽ sắp xếp lại bộ tài nguyên. Ai có preset tự làm muốn chia sẻ thì gửi kèm hướng dẫn sử dụng nha.',time:t(24*60+15)}];
}
export const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export function filterMessages(messages, {query='',category='Tất cả',period='week',savedOnly=false,saved=[],enabledGroups=groupInfo.map(g=>g.id)}={},now=Date.now()) {
 const day = ts => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(ts);
 const terms=fold(query).trim().split(/\s+/).filter(Boolean);
 return messages.filter(m=>{
  const g=groupInfo.find(g=>g.id===m.group); if(!g)return false;
  if(!enabledGroups.includes(g.id))return false;
  if(category!=='Tất cả'&&g.category!==category)return false;
  if(savedOnly&&!saved.includes(g.id))return false;
  if(period==='today'&&day(m.time)!==day(now))return false;
  if(period==='yesterday'&&day(m.time)!==day(now-86400000))return false;
  if(m.time<now-7*86400000)return false;
  return terms.every(t=>fold(`${g.name} ${m.sender} ${m.text}`).includes(t));
 }).sort((a,b)=>b.time-a.time);
}
export function conversations(messages) {
 return groupInfo.map(g=>({...g,messages:messages.filter(m=>m.group===g.id)})).filter(g=>g.messages.length).sort((a,b)=>b.messages[0].time-a.messages[0].time);
}
