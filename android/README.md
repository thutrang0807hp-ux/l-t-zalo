# Nhà Tin Android — bản thử nghiệm 0.1.0

Ứng dụng Android native Java (Android 8.0/API 26 trở lên). Chạy độc lập trên điện thoại, không cần Node.js, PC, đăng nhập Zalo trong app hay máy chủ. Đây là một bản Android mới; không phải chuyển giao diện web thành APK.

## Làm được

- Xin quyền Notification Access qua cài đặt Android và chỉ xử lý thông báo từ `com.zing.zalo`.
- Gom phần nội dung có trong thông báo theo tên cuộc trò chuyện, lưu SQLite cục bộ và chống lặp chính xác theo tên cuộc trò chuyện/người gửi/nội dung/thời gian.
- Tìm không dấu theo nội dung/người gửi/tên nhóm, lọc hôm nay/hôm qua/7 ngày và chọn nhóm để xem.
- Xem nội dung thông báo đã lưu, chia sẻ bản gom bằng Android share sheet, tạm dừng và xóa tin.
- Giữ tối đa 7 ngày hoặc 10.000 tin. Tối đa 50 nhóm hiển thị ở một lượt; dùng bộ lọc để tìm nhóm khác. Cửa sổ chi tiết/chia sẻ giới hạn 200 tin.
- Không xin quyền Internet, không có AI, không gọi API, không tốn token. Không có analytics, không backup lên đám mây.

## Không làm được / giới hạn quan trọng

- Không đọc toàn bộ tài khoản hay lịch sử Zalo. Chỉ nhận thông báo mới sau khi cấp quyền, bao gồm cả tin riêng nếu chúng tạo thông báo. Lọc nhóm chỉ đổi cách xem, không ngăn lưu các thông báo Zalo khác; tạm dừng để ngừng thu nhận.
- Nhóm tắt thông báo, Zalo ẩn nội dung, đang mở cuộc trò chuyện, điện thoại ngắt dịch vụ nền hoặc phiên bản Zalo/OEM khác có thể làm thiếu nội dung. Tên nhóm trùng nhau có thể bị gộp vì thông báo không cung cấp ID Zalo ổn định.
- Thông báo đơn không có MessagingStyle chỉ lấy phần văn bản mở rộng/text; chưa tách các dòng trong thông báo gộp, ảnh và tệp không được đọc. Cập nhật thông báo có timestamp thay đổi có thể tạo mục trùng. Thông báo tổng hợp group-summary bị bỏ qua.
- Không tự tóm tắt AI, không gửi Telegram tự động, không theo dõi thu hồi/sửa tin ở Zalo. Mở Zalo chỉ mở ứng dụng, không nhảy tới tin cụ thể.
- Dọn vật lý lúc có tin mới; truy vấn ẩn tin quá 7 ngày. Gỡ app xóa toàn bộ dữ liệu. SQLite không có mã hóa riêng; dựa trên sandbox/khóa màn hình của Android.
- Chưa thử trên điện thoại thật với Zalo. Build, chữ ký APK và quy tắc xử lý được kiểm tra riêng; chúng không chứng minh thu đủ thông báo Zalo.

## Cài và thử

1. Tải APK từ trang Nhà Tin, mở APK và cho phép trình duyệt/Files cài ứng dụng khi Android yêu cầu. Có thể xuất hiện cảnh báo về nguồn ngoài cửa hàng; xem kỹ trước khi cài.
2. Mở Nhà Tin → Quyền đọc thông báo → đọc giải thích → mở cài đặt Android → bật Nhà Tin.
3. Một số Android mới cần Thông tin ứng dụng → menu ⋮ → Cho phép cài đặt bị hạn chế trước khi cấp quyền. Chỉ bật khi bạn tin nguồn APK.
4. Cho Zalo hiện nội dung thông báo. Thoát màn hình cuộc trò chuyện, nhờ người khác gửi tin mới. Mở Nhà Tin kiểm tra tên nhóm/nội dung/thời gian.
5. Nếu không có tin, xem mục Cài đặt → Cách kiểm tra nhận tin; kiểm tra pin và bật lại quyền. Không dựa vào app làm nguồn duy nhất cho việc quan trọng.

## Build từ mã nguồn

Cần JDK 21, Android SDK Platform 35, Build Tools 35.0.0, Bash, Python 3. Không cần Gradle hoặc thư viện Android bên thứ ba. Cài công cụ từ Android SDK chính thức.

```sh
export ANDROID_SDK_ROOT=/duong-dan/android-sdk
export NHATIN_KEYSTORE=/duong-dan-rieng/nhatin.jks
export NHATIN_KEY_ALIAS=nhatin
# Nhập mật khẩu vào biến môi trường, không đưa khóa/mật khẩu vào Git.
read -s NHATIN_KEY_PASSWORD
export NHATIN_KEY_PASSWORD
./android/build-apk.sh
```

Tạo keystore riêng bằng `keytool -genkeypair` nếu chưa có; giữ lại để ký những bản cập nhật sau. Gói APK thử nghiệm hiện được ký bằng khóa riêng của phiên build, không phải chứng nhận phát hành Play Store. Mất khóa ký thì không thể cập nhật đè app với cùng application ID; có thể phải gỡ app (mất dữ liệu) trước khi cài bản ký khác.

`build-apk.sh` biên dịch tài nguyên/Java/DEX, zipalign, ký APK, xác minh chữ ký và chạy các kiểm tra JVM cho quy tắc tìm kiếm, bỏ thông báo đếm tin và thời hạn lưu. Đầu ra nằm ở `android/build/NhaTin-Android-0.1.0.apk`, không commit file khóa hoặc dữ liệu người dùng.
