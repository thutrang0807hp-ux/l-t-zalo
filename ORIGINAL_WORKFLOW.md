# Khôi phục đúng phạm vi Nhà Tin

Nhánh `fix/restore-original-workflow-ui` lấy `main` của repo `thutrang0807hp-ux/l-t-zalo` làm chuẩn. Giữ `server.js`, `lib/*`, `package.json`, `.env.example` và `public/app.js` nguyên trạng. Thay đổi sản phẩm chỉ ở bố cục giới thiệu, hiển thị tab Đã lưu vốn đã có và lớp CSS `public/workspace-theme.css`.

Luồng thật được giữ: backend Node.js nhận/lưu tin Zalo bằng zca-js (QR/phiên không chính thức), Discord qua exporter theo cấu hình → AI tương thích Chat Completions theo model/endpoint/key của người dùng → bot Telegram gửi bản ngắn/xem thêm theo giờ và ngày đã chọn. Bản này không tự quyết định nhà cung cấp AI, không chuyển sang NotificationListenerService và không thay app gốc bằng app Android mới.

Giữ cấu hình AI/Telegram, yêu cầu từng nhóm, chế độ đọc kỹ/đọc lướt, nhiều tài khoản, chọn nhóm/nhóm ghim, tắt thông báo nhóm, sắp xếp chủ đề, bản ngắn/top 5/xem thêm, nguồn gốc, lưu xem sau, quét kho local theo ngày và gửi lại kết quả mà không chạy AI lại.

## Web mô phỏng

`python3 scripts/build-web-demo.py /duong-dan/dist` sao chép chính UI gốc rồi thêm adapter API ở `demo/`. Adapter chỉ dùng trong bản build mô phỏng, không được import bởi app thật. Tất cả API `/api/` đều bị chặn tại adapter; endpoint chưa hỗ trợ trả lỗi, không được chuyển tới server hoặc nhà cung cấp bên ngoài.

Tin, tài khoản, QR, AI, bot và lịch gửi trong preview đều là mẫu. Không có QR hợp lệ để quét. Cần bấm Xác nhận tài khoản MẪU để thử luồng chọn nhóm. Thử lịch gửi chỉ mô phỏng đến giờ đã đặt, kiểm tra ngày nhận và chống lặp; không có scheduler thật chạy trong trang tĩnh. Bản thật vẫn dùng lịch backend gốc. Bản mô phỏng không nhận/lưu API key hoặc bot token, và không gọi Zalo/AI/Telegram thật. Nhật ký mẫu hiển thị các bước riêng biệt để tránh nhầm nối giao diện là đã kết nối dịch vụ.

Chạy app thật vẫn theo README gốc bằng Node.js, `.env` hoặc Cài đặt riêng và `npm start`. Thiết lập kết nối thật và kiểm chứng end-to-end cần thực hiện trên môi trường chạy backend. Chưa xác minh đăng nhập Zalo, gọi model hay gửi Telegram thật trong công việc thiết kế này.

## Bản APK lệch phạm vi

Đề xuất ở PR #2 (`feat/android-notification-inbox`) là một ứng dụng NotificationListener riêng, không phải bản đầy đủ của hệ thống gốc. Đề xuất đó được rút lại; không nhập vào main và không tiếp tục quảng bá như bản thay thế. Mã nguồn/binary cũ còn trên nhánh riêng để giữ lịch sử, nhưng được gỡ khỏi trang chính.

## Kiểm tra

Bảy bài test xác minh cấu trúc API bản tin/nguồn/lưu, yêu cầu nhóm/đọc kỹ-đọc lướt, gửi Telegram tách biệt tạo báo cáo, ngày nhận và chống lặp lịch, quét kho local, bỏ qua khóa bí mật và không chuyển API ra mạng. Kiểm tra đối chiếu giữ toàn bộ ID giao diện gốc, không sửa mã backend hoặc mã điều khiển UI gốc. Không có công cụ browser QA Sites được hỗ trợ trong môi trường này, nên bố cục và các tương tác trình duyệt chưa được xác minh bằng browser thực. Các kiểm tra mô phỏng không chứng minh kết nối dịch vụ thật.
