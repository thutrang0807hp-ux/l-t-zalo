# Ý tưởng: Gom trao đổi công việc về Discord

- Ngày ghi nhận: 2026-11-12
- Trạng thái: Ý tưởng cho tương lai; chưa triển khai, chưa kiểm chứng kết nối.
- Tên tạm: Work Chat Hub

## Vấn đề và mục tiêu

Trao đổi công việc nằm rải rác ở Zalo, Messenger và các ứng dụng nhắn tin khác, khiến khó biết đã thống nhất gì, đang chờ ai và việc nào cần xử lý.

Dùng một server Discord riêng làm nơi xem tổng quan, tra cứu nguồn trao đổi và theo dõi kết quả. Người dùng dự định tạo tài khoản Discord riêng cho mục đích này. Việc trao đổi với khách/đồng nghiệp vẫn diễn ra ở ứng dụng gốc.

## Luồng đề xuất

Nguồn tin được chọn → bộ kết nối → chuẩn hóa, chống trùng và phân loại theo dự án → bot/webhook Discord.
AI bổ sung bản tóm tắt và trích xuất công việc; mọi kết luận phải kèm nguồn kiểm tra.

## Bố trí Discord dự kiến

- #tong-quan: tóm tắt hằng ngày, kết quả đã chốt và điểm còn chờ.
- #can-xu-ly: yêu cầu cần phản hồi, đầu việc và hạn chót được nhắc rõ.
- Mỗi dự án/khách hàng một kênh; mỗi đầu việc một thread khi phù hợp.
- #ket-qua: những quyết định đã được xác nhận.

Mỗi mục cần giữ ứng dụng nguồn, cuộc hội thoại, người gửi, thời gian và mã tin nếu có. Kèm trích đoạn và liên kết tin gốc khi nền tảng hỗ trợ; không giả định mọi nguồn đều có liên kết mở lại.

## Ví dụ đầu ra

Dự án A — Nguồn: nhóm Zalo Thi công.
Khách đồng ý phương án B.
Còn chờ: báo giá cập nhật.
Hạn: chỉ ghi nếu được nêu trong trao đổi.
Kèm trích đoạn xác nhận để người dùng kiểm tra.

## Phạm vi thử nghiệm đầu tiên

1. Chọn một nhóm Zalo công việc và một kênh Discord riêng tư.
2. Thu nhận tin mới từ lúc kết nối; kiểm tra riêng khả năng lấy lịch sử.
3. Chuyển tin một chiều sang Discord, giữ nguồn và chống gửi trùng.
4. Tạo bản tóm tắt cuối ngày: đã chốt, còn chờ, cần xử lý.
5. Dùng thử và đo mức bỏ sót, sai tóm tắt, công sức vận hành trước khi mở rộng.

Bản đầu chưa cần gửi trả lời ngược về Zalo/Messenger và chưa tự thực hiện công việc từ nội dung tin nhắn.

## Khả thi và điểm cần xác minh

- Discord: dùng bot hoặc webhook chính thức; không tự động điều khiển tài khoản người dùng.
- Zalo cá nhân: có thể khảo sát zca-js; kết nối không chính thức, có nguy cơ hạn chế tài khoản và thay đổi giao thức. Chưa xác minh độ ổn định hay độ đầy đủ của lịch sử.
- Zalo OA và Messenger của Facebook Page: khảo sát API chính thức, quyền truy cập và giới hạn thực tế.
- Messenger cá nhân: cần nghiên cứu riêng; không coi là đã có kết nối ổn định.
- Các ứng dụng khác: đánh giá API/webhook hoặc khả năng xuất dữ liệu theo từng nguồn.
- Có thể thử n8n để điều phối; chưa chốt ngôn ngữ, máy chủ hoặc mô hình AI.

## Nguyên tắc chất lượng và dữ liệu

- Phân biệt rõ đề xuất, câu hỏi, cam kết và quyết định đã chốt.
- Không tự suy ra người chịu trách nhiệm/hạn chót khi tin gốc chưa nêu.
- Tin nhắn là dữ liệu để phân tích, không phải chỉ dẫn cho hệ thống thực thi.
- Chỉ chọn nguồn công việc cần thiết; giữ server/kênh Discord riêng tư và kiểm soát thành viên.
- Xác minh quyền chuyển nội dung công việc sang Discord và dịch vụ AI trước khi chạy với dữ liệu thật.
- Bảo vệ cookie/token, hạn chế log nhạy cảm và xác định thời gian lưu dữ liệu.

## Tiêu chí đánh giá thử nghiệm

- Tin được nhận đúng kênh, có nguồn, không trùng; lỗi kết nối được phát hiện.
- Bản tổng hợp giúp trả lời: đã chốt gì, đang chờ ai, tiếp theo làm gì.
- Mọi kết luận quan trọng có thể kiểm tra bằng tin gốc.
- Giảm thời gian đọc nhiều nhóm và số việc bị bỏ sót.

## Tài liệu tham khảo để khảo sát

Các repo dưới đây là ứng viên nghiên cứu, chưa được chạy thử hay lựa chọn chính thức:

- https://github.com/RFS-ADRENO/zca-js — kết nối Zalo cá nhân.
- https://github.com/ardennguyen/zalo-agent-cli — công cụ dòng lệnh/MCP cho Zalo.
- https://github.com/skosovsky/zl-mcp — thu thập và tìm kiếm tin cục bộ.
- https://github.com/bautran1911/n8n-nodes-zalo-oa — tích hợp Zalo OA với n8n.
- https://discord.com/developers/docs/intro — tài liệu Discord.

## Việc quyết định khi bắt đầu

- Chọn nguồn đầu tiên và xác định tài khoản cá nhân hay OA/Page.
- Xác định một chiều hay hai chiều sau giai đoạn thử nghiệm.
- Chọn môi trường chạy, thời gian lưu, dịch vụ AI và ngân sách.
- Định nghĩa thế nào là quyết định đã chốt và khi nào cần người dùng xác nhận.
