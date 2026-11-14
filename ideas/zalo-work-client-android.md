# Ý tưởng: Một app Android vừa nhắn Zalo vừa gom thông tin công việc

- Ngày ghi nhận: 15/11/2026.
- Trạng thái: ý tưởng phát triển; chưa triển khai hoặc chứng minh khả thi trên Android.
- Mục tiêu: một ứng dụng dùng hằng ngày thay chỗ đọc/trả lời Zalo, có thêm trợ lý gom tin, AI tổng hợp và bản sáng Telegram.

## Nhu cầu đã thống nhất

Người dùng muốn chỉ dùng điện thoại, không phải duy trì máy tính hoặc máy chủ riêng. Trong cùng một app và một tài khoản, người dùng cần:

1. Đăng nhập, nhận và đọc tin nhắn.
2. Tự soạn và gửi trả lời như một ứng dụng chat bình thường.
3. Gom thông tin đáng chú ý từ các nhóm.
4. Dùng AI khi cần hoặc theo lịch.
5. Nhận bản tổng hợp/nhắc việc qua bot Telegram.

Đây là ý tưởng **ứng dụng khách Zalo có trợ lý**, không phải chỉ thêm một app đọc thông báo bên cạnh Zalo gốc. Người dùng cần có thể trả lời ngay trong app mới nếu phiên đăng nhập không cho dùng song song với ứng dụng gốc. Không giả định việc dùng đồng thời đã được bảo đảm.

## Nguyên tắc sản phẩm

Nhắn tin là chức năng chính; AI hỗ trợ phía sau. Nhận, lưu, đọc và gửi tin không được phụ thuộc vào việc AI có khóa, còn hạn mức hay đang hoạt động.

Một bản tóm tắt hữu ích phải dẫn về đúng cuộc trao đổi để kiểm tra và trả lời. Cần phân biệt đề xuất, câu hỏi, cam kết và quyết định đã chốt; không tự biến lời khuyên thành kết quả đã xác nhận.

Không tự gửi câu trả lời thay người dùng. AI có thể tạo bản nháp nhưng người dùng phải kiểm tra và bấm Gửi.

## Các tính năng đáng phát triển

### 1. Hộp chat để làm việc

- Danh sách cuộc trò chuyện, nhóm và trạng thái chưa đọc.
- Đọc và gửi tin văn bản, xem kết quả gửi và lỗi.
- Trích dẫn/trả lời đúng tin khi kết nối hỗ trợ; cần kiểm chứng khả năng của thư viện.
- Từ bản tổng hợp mở về đúng nhóm, đúng đoạn nguồn đã lưu.
- Xử lý gửi lỗi/gửi lại rõ ràng, không âm thầm tạo tin trùng.

### 2. Theo dõi việc ngay từ tin nhắn

Ba mục: **Cần trả lời / Đang chờ / Đã xong**.

Người dùng tự đánh dấu trước; gợi ý AI bổ sung sau. Ví dụ: đã gửi báo giá thì đưa vào Đang chờ để nhớ kiểm tra phản hồi. Mỗi mục giữ liên kết tới cuộc trao đổi, người gửi, thời gian và trích đoạn nguồn. Không tự suy ra người phụ trách hay hạn chót khi tin chưa nêu.

### 3. “Từ lần đọc cuối có gì mới?”

Khi quay lại một nhóm nhiều tin, có thể yêu cầu bản xem nhanh: vừa bàn gì, đã chốt gì, còn chờ gì và có câu hỏi nào liên quan tới mình. Phải hiển thị phạm vi dữ liệu đã đọc và cảnh báo khoảng thiếu. Không coi chưa nhận được tin là không có việc mới.

### 4. AI theo yêu cầu trên đoạn được chọn

- Tóm tắt các tin được chọn.
- Chỉ ra điểm còn chưa thống nhất.
- Gợi ý đầu việc từ nội dung có bằng chứng.
- Soạn nháp trả lời để người dùng duyệt.

Tin nhắn là dữ liệu để phân tích, không phải chỉ dẫn cho hệ thống tự thực thi. AI không tự gửi tin, mở link hoặc làm việc thay người dùng từ yêu cầu nằm trong tin nhóm.

### 5. Giữ bản sáng Telegram của repo gốc

- Tổng hợp theo giờ và ngày nhận do người dùng chọn.
- Bản ngắn trước, xem thêm theo nhóm và mở nguồn khi cần.
- Giữ yêu cầu lọc riêng từng nhóm, đọc kỹ/đọc lướt và lưu xem sau.
- Gửi lại bản đã tạo không cần gọi AI lại.
- Không chuyển tiếp mọi tin sang Telegram làm phát sinh thêm một hộp thư bị ngập.

## Kiểm soát token và chi phí

- Không gọi AI theo từng tin mới.
- Chỉ phân tích khi được yêu cầu hoặc tới lịch.
- Ưu tiên phần tin mới; tránh gửi lại lịch sử không cần thiết.
- Có thể tái sử dụng kết quả cũ khi nguồn, yêu cầu và cấu hình liên quan chưa đổi; không bỏ ngữ cảnh cần thiết chỉ để giảm token.
- Hiển thị model đang dùng, token đầu vào/đầu ra, chi phí theo giá cấu hình và phần ước tính chưa đối chiếu được.
- Bước phân nhóm, tóm tắt, hợp nhất và chọn ý có thể phát sinh nhiều lượt gọi; cần ghi nhận riêng để biết chỗ nào tốn tiền.
- Hết hạn mức AI thì chat và lưu tin vẫn hoạt động; báo rõ bản tổng hợp chưa hoàn thành.
- Hạn mức trong app không thay thế hạn mức thanh toán của nhà cung cấp. Chưa có số liệu chi phí thật từ tin nhắn của người dùng.

## Bản thử nghiệm đầu tiên

Phạm vi nhỏ: **một tài khoản, một nhóm thử, chat văn bản, đánh dấu cần trả lời, một bản tổng hợp và một lần gửi Telegram theo cấu hình**.

Không bắt đầu bằng việc xây cả ứng dụng thay Zalo. Ảnh, file, gọi điện, nhiều tài khoản, tìm kiếm toàn bộ lịch sử và tự động phân loại đầu việc để sau khi luồng cơ bản được chứng minh.

### Cửa kiểm chứng kỹ thuật trước khi làm giao diện lớn

1. Kết nối chạy ngay trên Android, không dựa vào backend máy tính/máy chủ riêng.
2. Đăng nhập bằng cơ chế của kết nối được chọn; xác định loại phiên và ảnh hưởng tới Zalo gốc, không suy ra từ việc đóng gói APK.
3. Nhận được tin thật trong nhóm thử.
4. Người dùng tự gõ và gửi được tin tới đúng nhóm; có trạng thái gửi/lỗi, tránh gửi trùng khi thử lại.
5. Đóng/mở app khôi phục được phiên; ngắt/kết nối lại không âm thầm mất hoặc nhân đôi tin.
6. Thử lúc màn hình tắt và Android hạn chế chạy nền; ghi rõ khả năng nhận tin và lịch gửi trong thực tế.
7. Nếu lấy tin bị thiếu, báo được giới hạn; không hứa nhận đủ lịch sử.

Nếu không vượt được cửa này, dừng để đánh giá lại kết nối. Không dùng bản mô phỏng hoặc việc APK cài được làm bằng chứng ứng dụng đã chạy được với Zalo thật.

## Tận dụng repo hiện có

- [Kết nối và chuẩn hóa tin Zalo](../lib/zalo.js): khảo sát khả năng dùng lại giao thức, cấu trúc dữ liệu và quản lý phiên; không giả định mã Node.js chạy nguyên trạng trong Android.
- [AI và tạo báo cáo](../lib/reports.js), [gom cuộc trao đổi](../lib/conversations.js): tham khảo luồng, kiểm tra nguồn và kiểm soát ngân sách.
- [Bot Telegram](../lib/telegram.js): tham khảo menu, gửi bản ngắn/xem thêm và kiểm soát chat nhận.
- [Quét kho tin](../lib/scans.js), [lịch gửi](../lib/schedule.js): giữ hành vi sản phẩm, đánh giá lại cách thực thi trên Android.

`zca-js` là ứng viên kết nối không chính thức cần khảo sát. Nếu chọn nó, phải nghiên cứu môi trường chạy Node.js trên Android hoặc cách triển khai kết nối tương thích. Chưa chọn giải pháp, chưa chứng minh độ ổn định và không coi đóng gói web/Node thành APK là đã giải quyết được.

App đọc thông báo Android có thể là một sản phẩm khác ít vướng đăng nhập hơn, nhưng không thay thế nhu cầu ứng dụng khách vừa nhắn vừa gom và có thể thiếu nội dung. Bản APK NotificationListener thử trước không được coi là triển khai của ý tưởng này.

## Dữ liệu và đánh giá sử dụng

Phiên đăng nhập, API key và bot token phải được bảo vệ trên thiết bị; không đưa vào mã nguồn, log, bản web mô phỏng hoặc gói phát hành. Người dùng chọn nhóm, thời gian giữ tin và dữ liệu được gửi tới AI/Telegram; cần biết rõ nội dung rời thiết bị khi dùng các dịch vụ này.

Sau khi kỹ thuật chạy được, thử nhu cầu thật: có giảm thời gian lục nhóm không, có tìm lại được việc từng bỏ lỡ không, có thể trả lời đúng chỗ nhanh hơn không, AI có làm sai trạng thái trao đổi không và chi phí thực tế có chấp nhận được không. Không đặt tỷ lệ thành công hoặc chi phí giả định làm kết quả đã đạt.
