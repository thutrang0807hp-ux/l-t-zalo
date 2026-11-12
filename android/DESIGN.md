# Nhà Tin — hướng thiết kế 0.2

Web mô phỏng dùng [Framework7 9.3.0](https://github.com/framework7io/framework7), giấy phép MIT. Bản JS/CSS phân phối chính thức được lưu trong `preview/vendor/` cùng toàn bộ thông báo bản quyền ở `FRAMEWORK7-LICENSE.txt`. Không dùng mẫu giao diện không rõ giấy phép.

Bản web cung cấp hộp tin theo cuộc trò chuyện, tìm kiếm không dấu, lọc ngày/chủ đề, nhóm đã lưu, danh sách nhóm, công tắc trạng thái mô phỏng và thêm tin mẫu. Tin được viết sẵn, không phải dữ liệu Zalo thật; trạng thái chỉ lưu trong localStorage của trình duyệt. Không nhập cookie, tài khoản, mật khẩu hoặc API key. Chọn Đặt lại dữ liệu mẫu trong Cài đặt để bắt đầu lại.

APK là ứng dụng native Java, không nhúng Framework7/WebView và không thêm quyền Internet. Cùng phong cách tím nhạt, thẻ hội thoại gọn, hộp tìm kiếm và thanh điều hướng dưới. Có thêm lưu nhóm bằng SharedPreferences, màn Nhóm để xem nguồn đã nhận, và màn Cài đặt. Các chức năng Android vẫn xử lý kho thông báo thật; không đưa dữ liệu mẫu vào APK. Web có phân loại chủ đề mẫu, thêm tin mẫu và sao chép bản gom để thử giao diện; APK chưa phân loại chủ đề và dùng menu chia sẻ của Android. Quyền thông báo trong web chỉ mô phỏng, APK mới mở cài đặt Android thật.

Bản APK 0.2.0 dùng versionCode 2 và cùng chứng chỉ ký với 0.1.0 của phiên này. Đã biên dịch, kiểm tra chữ ký và quy tắc dữ liệu; chưa thử UI hoặc nhận tin Zalo trên thiết bị/emulator. Môi trường Sites không có công cụ browser QA được hỗ trợ nên chưa xác minh bố cục qua trình duyệt. Không coi kiểm tra model lọc tin là kiểm tra chất lượng giao diện.

Chạy web local bằng server tĩnh tại `android/preview`, ví dụ `python3 -m http.server 8000` rồi mở `http://localhost:8000`. Trang `download.html` liên kết APK đã ký trên GitHub. Cấu hình hosting Sites nằm ngoài kho phần mềm; trang demo đã triển khai tại URL được ghi trong README.
