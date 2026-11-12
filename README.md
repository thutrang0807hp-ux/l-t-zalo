# Nhà Tin — ứng dụng Zalo → AI → Telegram

Node.js >=22.13 (khuyến nghị 24 LTS). Chạy `npm ci --ignore-scripts`, tạo `.env` từ `.env.example`, rồi `npm start`. App chỉ lắng nghe máy hiện tại trên cổng 3000. Trên Windows: giải nén và dùng CHAY-APP.bat. Không chạy trong ZIP.

## Cách dùng

1. Đọc cảnh báo kết nối Zalo không chính thức. Nếu chấp nhận, bật ZALO_ENABLED=true; Windows dùng KET-NOI-ZALO.bat. Khởi động lại app.
2. Thêm tài khoản Zalo, quét QR bằng điện thoại và xác nhận đăng nhập. Sau khi kết nối, chọn nhóm từ danh sách. Không nhập ID thủ công.
3. Sửa yêu cầu riêng từng nhóm, ví dụ: “Lấy mẹo dựng video và tài nguyên; bỏ quảng cáo, chuyện phiếm”. Có thể tạm dừng nhóm hoặc tài khoản.
4. Đến giờ gửi (mặc định 6h30), app tự đăng nhập lại bằng phiên đã lưu và đọc lịch sử tin của từng nhóm đang theo dõi, nên máy chỉ cần bật lúc đó (mở muộn thì gửi bù). Zalo chỉ trả về khoảng 200 tin mới nhất mỗi nhóm (chỉnh bằng ZALO_HISTORY_COUNT); nhóm nói quá nhiều có thể thiếu tin đầu ngày và bản tin sẽ ghi cảnh báo. Nếu app đang mở trong ngày, tin mới cũng được lưu ngay để bù phần này. Nút "Chọn nhóm đã ghim" chọn nhanh các nhóm đang ghim trên Zalo. Mở Zalo Web ở nơi khác có thể ngắt phiên.
5. Điền khóa API/Telegram trong .env riêng, lưu rồi khởi động lại. Không gửi khóa, cookie, file phiên hoặc QR vào chat.
6. AI tổng hợp theo nhóm, không chỉ dò từ khóa. Bản tin có tóm tắt, lý do đáng xem, nguồn và link có trong tin. Nếu không có link mở tin Zalo, xem trích đoạn gốc đã lưu.
7. Mặc định 6h30 giờ Việt Nam: gửi bản ngày hôm trước. Nếu app mở muộn, gửi bù ngày hôm trước sau giờ đã chọn. Bản đã gửi không tự gửi lặp. Gửi lỗi cần tạo/gửi lại thủ công, có cảnh báo trong app.
8. Discord: điền DISCORD_EXPORTER_PATH (bản CLI của DiscordChatExporter) và DISCORD_TOKEN trong .env, thêm tài khoản Discord, bấm "+ Chọn kênh theo dõi", tải danh sách server rồi tick kênh. Dùng token cá nhân trái điều khoản Discord, có thể bị khóa; nên dùng tài khoản phụ.
9. Với bot Telegram: gõ /start hoặc /tin, chọn Zalo → nhóm → từng tin → xem nguồn. Discord/Telegram nguồn chưa tích hợp, hiện rõ trong bot và app.

## Giao diện

Trang chính mở vào Bản tin gần nhất. Tìm tin theo nội dung/tên nhóm, lọc nguồn, mở nguồn gốc và lưu xem sau. Mục Đã lưu giữ bản tóm tắt độc lập với nguồn; khi tin gốc hết hạn lưu thì không còn mở được trích đoạn. Nguồn theo dõi là khu vực quản lý tài khoản/nhóm riêng. Sau đăng nhập thành công, giao diện tự dẫn sang chọn nhóm.

## Gom cuộc trao đổi

AI phân loại từng tin vào một cuộc trao đổi cụ thể hoặc chuyện phiếm. Các lô sau nhận danh sách/ngữ cảnh cuộc trao đổi trước để nối câu trả lời xen kẽ. Một người có thể thuộc nhiều chủ đề; cùng từ khóa không đủ để gộp. Lưu quan hệ trả lời và nội dung trích dẫn nếu Zalo cung cấp. Tin trích dẫn ngày trước còn trong kho được đưa vào làm ngữ cảnh, không phát lại như tin mới. Chưa tự nối mọi chủ đề kéo dài qua ngày nếu không có quan hệ trích dẫn.

Sau phân nhóm, AI tóm tắt từng cuộc trao đổi. Cuộc trao đổi dài được xử lý từng phần rồi hợp nhất thành một mục. App kiểm tra không thiếu/lặp ID ở bước phân loại và không có nguồn bị bịa. Nếu AI trả cấu trúc sai hoặc hết ngân sách ở bất kỳ bước nào, chưa lưu/gửi báo cáo như đã hoàn chỉnh. Cần nhiều lượt API hơn bản trước, vẫn chặn theo trần $5. Chất lượng gom chủ đề chưa được đánh giá bằng Muse thật.

Demo chỉ có nút Xem bản tin, gộp ví dụ thảo luận nhiều chủ đề vào bản tin mẫu. Mặc định tối đa 5 ý nổi bật; Xem thêm giữ toàn bộ các mục. Demo chọn ý theo thứ tự viết sẵn, không phải AI đang chạy.

## Cách hoạt động trong ngày

Kết nối Zalo nhận và lưu tin mới khi app chạy, không gọi AI mỗi 10 phút. Đến giờ gửi (mặc định 6h30), AI gom cuộc trao đổi và tổng hợp toàn bộ ngày hôm trước rồi gửi Telegram. Không có cảnh báo AI định kỳ trong ngày. Người dùng vẫn có thể tạo bản tin thủ công nếu muốn.

## Bản ngắn và xem thêm

Sau tổng hợp, nếu có hơn 5 mục, AI chọn 5 ý nổi bật từ các bản tóm tắt; bước này cũng dùng ngân sách chung. Telegram gửi bản ngắn kèm nút nguồn và Xem thêm → nền tảng → nhóm → tin. Toàn bộ mục vẫn được lưu, không bị xóa vì không nằm trong top 5. Giao diện web mặc định bản ngắn; tìm kiếm/lọc nguồn hoặc Xem thêm để đọc các mục khác. Chất lượng chọn ý chưa được kiểm chứng bằng Muse thật.

## Menu Telegram

Khi bot chạy, app đăng ký menu lệnh Telegram: /tin, /nguon, /daluu, /help và nút Menu cạnh ô nhập. Bản sáng vẫn tự gửi, không cần mở menu. Xem từng tin có nút Lưu xem sau; các mục được lưu chung với Đã lưu trên web. Lệnh và nút chỉ nhận từ chat đã cấu hình. Đăng ký menu chưa kiểm chứng với Telegram thật; nếu Telegram từ chối vẫn có thể nhập các lệnh trực tiếp. Demo mô phỏng menu mở/đóng, không bảo đảm hình thức giống mọi phiên bản Telegram.

## Quét theo yêu cầu

Trong Quản lý nguồn, mỗi nhóm có nút Quét. Chọn 7 ngày trước, 30 ngày trước hoặc tự chọn tối đa 90 ngày; ngày kết thúc được tính trọn ngày theo giờ Việt Nam. Có thể nhập câu yêu cầu riêng cho lần quét và chọn gửi Telegram. Chỉ chạy khi bấm Quét một lần, không thêm lịch lặp hoặc đổi yêu cầu lọc mặc định của nhóm.

Trước khi gọi AI, xem số tin hiện trong kho, cảnh báo thời điểm bắt đầu theo dõi, khoảng mất kết nối và giới hạn giữ tin. Không có tin thì dừng, không gọi AI. Chỉ xử lý kho local, không backfill lịch sử từ Zalo. Số tin/đầu-cuối dữ liệu không chứng minh đã nhận đủ tin trong khoảng. Tăng giữ tin chỉ áp dụng dữ liệu còn tồn tại. Quét dùng chung ngân sách $5.

Kết quả quét lưu riêng, không thay bản tin sáng. Nếu gửi thất bại có thể dùng Lần quét gần đây → Gửi lại Telegram mà không gọi AI lại. Bản Telegram có nhóm, khoảng ngày, câu yêu cầu, bản ngắn và nguồn. Demo chỉ minh họa bằng tin viết sẵn; không có AI thực hoặc lịch sử 7 ngày thật.

## Danh sách nhóm và tắt thông báo

Sau kết nối, app lấy danh sách các nhóm tài khoản tham gia, có tìm kiếm, theo dõi tất cả/bỏ chọn và làm mới danh sách. Đây là liệt kê nhóm, không phải tải toàn bộ lịch sử. Chỉ các nhóm được chọn mới lưu tin mới.

Từng nhóm có Tắt thông báo Zalo / Bật thông báo, thời hạn 1 giờ, 4 giờ hoặc đến khi bật lại. Dùng getMute/setMute của zca-js, không phải chỉ tắt tiếng giao diện Nhà Tin. Không tự đổi thông báo khi đăng nhập hoặc khi chọn theo dõi nhóm. Tắt thông báo không dừng listener nhận tin. Nếu không đọc được trạng thái hiện tại, app báo chưa biết thay vì khẳng định đã tắt. Đã kiểm tra bằng SDK giả lập, chưa thử Zalo thật và chưa xác nhận đồng bộ với Zalo PC/điện thoại; không phải điều khiển popup/âm thanh toàn bộ Windows.

## Hiển thị Telegram

Bot thật gửi một bản ngắn với tiêu đề in đậm, 1–2 câu xem trước và tên nguồn từng mục. Cảnh báo dữ liệu thiếu ghi rõ tài khoản/khoảng thời gian ở đầu bản. Nút mang tiêu đề mở bản đầy đủ, sau đó có nguồn và lưu; dưới cùng bản ngắn có Xem tất cả và Đã lưu. Nội dung nhóm được escape trước khi dùng Telegram HTML để tránh chèn định dạng/link ngoài ý muốn. Màu, font và bố cục bong bóng của ứng dụng Telegram không do bot tùy chỉnh. Demo hiện dùng mô hình tin nhắn + nút inline gần Telegram thật hơn; font, màu và kích thước chính xác vẫn tùy ứng dụng Telegram.

## Xếp nhóm theo chủ đề

Quản lý nguồn có Theo chủ đề / Theo tài khoản. Chủ đề hiện dưới dạng nút ngang có số nhóm, gồm Tất cả và các nhãn hiện có. Nút + Thêm nhóm vào chủ đề cho chọn nhiều nhóm đã có trong app, có tìm kiếm; bỏ chọn chỉ gỡ khỏi chủ đề hiện tại, không ngừng nhận tin. Nút + Chủ đề cho thêm và đổi tên, lưu riêng trong cấu hình; bấm Sửa ở nhóm để gán nhiều nhãn. Gợi ý chủ đề dựa trên tên nhóm bằng quy tắc cục bộ, không gọi AI hoặc đọc thêm tin để phân loại. Ví dụ Editor/Premiere → Dựng video, preset/tài liệu → Tài nguyên, tuyển dụng → Việc làm. Tên không rõ vào Chưa phân loại. Có thể sửa chế độ thủ công và tạo nhiều nhãn trong Sửa nhóm; tối đa 8 nhãn, 50 ký tự/nhãn. Muốn quay lại gợi ý chọn chế độ tự động.

Phân loại dùng chung theo nền tảng và ID nhóm, nên nhiều nick cùng nhóm dùng một phân loại. Chế độ chủ đề gộp các nick vào một dòng trong mỗi chủ đề; nhóm nhiều chủ đề có thể xuất hiện ở các mục tương ứng nhưng không tạo thêm đăng ký nhận tin hay gọi AI. Yêu cầu lọc và trạng thái theo dõi từng nick vẫn riêng. Chuyển Theo tài khoản để quản lý phiên/nhóm đầy đủ.

## Cấu hình

TELEGRAM_BOT_TOKEN: tạo qua @BotFather. Bấm Start với bot. TELEGRAM_CHAT_ID: ID cuộc trò chuyện nhận báo cáo. Bot chỉ xử lý yêu cầu đến từ chat ID đã cấu hình. Mỗi bot chỉ chạy một tiến trình nhận cập nhật; không chạy hai bản cùng token.

Dùng khóa Gemini miễn phí: lấy khóa ở https://aistudio.google.com/apikey. Cách dễ nhất: mở app → Cài đặt → AI tóm tắt, chọn Google Gemini, dán khóa, nhập tên model, bấm Lưu AI rồi Kiểm tra AI. Lưu ở đây áp dụng ngay, không cần khởi động lại, và thay thế cấu hình AI trong .env. Hoặc điền vào .env:

```
MODEL_API_KEY=khóa_của_bạn
MODEL_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
MODEL_NAME=gemini-2.5-flash-lite
MODEL_INPUT_USD_PER_MILLION=0
MODEL_OUTPUT_USD_PER_MILLION=0
MODEL_MIN_INTERVAL_MS=6000
```

Tên model thay đổi theo thời gian, xem danh sách trong AI Studio. Gói miễn phí giới hạn số lần gọi mỗi phút/ngày; app tự chờ giữa các lần gọi và tự thử lại khi bị báo vượt hạn mức (lỗi 429). Nhóm nhiều tin cần nhiều lượt gọi, có thể hết hạn mức ngày. Với gói miễn phí, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm; kiểm tra điều khoản trước khi gửi tin nhóm riêng tư.

MODEL_API_KEY, MODEL_API_BASE_URL và MODEL_NAME: theo tài liệu/quyền truy cập tài khoản nhà cung cấp, tương thích Chat Completions. Đường dẫn gốc phải HTTPS, ví dụ gốc có /v1 nếu tài liệu yêu cầu. Không tự suy đoán endpoint Muse. Gói token khuyến mãi chưa được kiểm chứng có dùng cho API không. Giá mặc định lấy từ ảnh người dùng cung cấp, cần kiểm tra giá thực tế trước khi dùng.

MODEL_INPUT_USD_PER_MILLION và MODEL_OUTPUT_USD_PER_MILLION: dùng tính trần AI $5/tháng. App đặt trước khoản dự phòng bảo thủ trước từng lô; đối chiếu usage nếu API trả về. Yêu cầu lỗi giữ khoản dự phòng vì phí chưa chắc chắn. Không tiếp tục khi hết ngân sách; không gửi một phần báo cáo như thể đầy đủ. Trần phụ thuộc giá cấu hình đúng và thông tin usage nhà cung cấp; không phải cơ chế đặt trần tài khoản thanh toán phía nhà cung cấp. Không tính tiền máy chủ. Không tự retry các yêu cầu AI bị lỗi để tránh phí lặp.

DATA_DIR mặc định data. Phiên từng tài khoản lưu ở đây, chỉ quyền truy cập riêng trên hệ thống hỗ trợ. Windows thừa hưởng quyền thư mục người dùng; không đặt trong thư mục chia sẻ, đồng bộ Drive/OneDrive hay gửi kèm ZIP. Dùng tài khoản Windows riêng. App không trả cookie/session qua HTTP. Không mở app công khai: chưa có đăng nhập quản trị. Muốn truy cập từ xa dùng đường hầm riêng.

## Dữ liệu và nhiều tài khoản

Tin được chống trùng theo nền tảng/nhóm/ID tin, nên hai nick cùng nhóm không làm nhân đôi. Mỗi nick có phiên, trạng thái, nhóm, yêu cầu riêng và nút quên phiên. Trùng một tài khoản Zalo đang chạy sẽ bị từ chối; chưa có thông báo chi tiết phân biệt lỗi này với đăng nhập thất bại. Nhóm dùng nhiều nick có thể có yêu cầu khác nhau; app đưa các yêu cầu đang bật vào AI cùng nhau.

Chỉ nhận tin mới khi kết nối còn hoạt động. App ghi khoảng ngắt kết nối và cảnh báo báo cáo có thể thiếu; đây là ước lượng quan sát, không bảo đảm lịch sử đầy đủ. Mất kết nối nguồn không bị che bằng trạng thái “đã đăng nhập”. Thời gian nhận tin gần nhất chỉ thay đổi khi có tin từ nhóm đang theo dõi.

Tin gốc mặc định dọn sau 7 ngày khi app chạy; có thể đổi 7/14/30/90 ngày trong Cài đặt. Bản tin đã tổng hợp giữ lại; nút nguồn sẽ báo hết thời gian lưu nếu tin bị dọn. Link đính kèm giữ nguyên, không bịa link mở tin Zalo. Không tải video/ảnh về máy và chưa phân tích nội dung ảnh. Tin bị thu hồi ở Zalo hiện chưa được đồng bộ xóa trong kho — cần cân nhắc khi dùng với nội dung nhạy cảm.

Dữ liệu thử từ phiên bản đầu vẫn giữ nguyên ở các bảng cũ; không tự chuyển sang nhóm/tài khoản thật để tránh lẫn tin mẫu. Trước khi chạy phiên bản mới, đóng tiến trình cũ dùng cùng thư mục dữ liệu.

## Đã kiểm tra / chưa kiểm tra

`npm test` kiểm tra mốc ngày Việt Nam, QR/lưu/khôi phục phiên qua SDK giả lập, chọn nhóm, chống trùng, yêu cầu AI, nguồn hợp lệ, giới hạn ngân sách, nút bot và quyền chat, API/giao diện HTTP. Kết nối giả lập không chứng minh Zalo thật hoạt động.

Chưa đăng nhập Zalo thật, chưa gọi Muse thật, chưa gửi Telegram thật và chưa chạy Windows thật. Cần người dùng quét QR, điền cấu hình riêng rồi chạy thử với một nhóm. Đây là các bước còn thiếu để xác nhận ứng dụng hoạt động thực tế.

Nguồn tham khảo: https://github.com/luonghaianh1208/2anh-zalo-bot và https://github.com/RFS-ADRENO/zca-js . Không cài Hermes, không tự nhắn trong nhóm Zalo. Kết nối không chính thức có nguy cơ bị khóa tài khoản.

Trong Cài đặt, chọn ngày nhận bản tin từ Thứ 2 đến Chủ nhật theo giờ Việt Nam. Mặc định nhận cả tuần. Bỏ chọn tất cả để tắt gửi tự động; app vẫn nhận và lưu tin. Mỗi bản tin tổng hợp ngày hôm trước, không tự gộp những ngày đã bỏ qua.

## Discord: lấy tin theo ngày

Tích hợp DiscordChatExporter CLI: https://github.com/Tyrrrz/DiscordChatExporter . Tải bản CLI phù hợp Windows từ Releases của dự án, giải nén và đặt đường dẫn tuyệt đối tới `DiscordChatExporter.Cli.exe` vào `DISCORD_EXPORTER_PATH` trong `.env`. Đặt `DISCORD_TOKEN` riêng trên máy; không gửi token vào chat, không đưa lên Git. Token không được truyền qua tham số dòng lệnh hay trả qua API. Dùng tài khoản cá nhân vẫn có nguy cơ bị Discord khóa theo quy định của họ.

Khởi động lại app → Thêm tài khoản → Discord → Theo tài khoản → Thêm kênh bằng link. Dán link dạng `https://discord.com/channels/server-id/channel-id`, đặt tên dễ nhớ. Chỉ dùng kênh tài khoản có quyền xem. Hiện hỗ trợ một tài khoản Discord, thêm kênh bằng link; chưa tự liệt kê server/kênh, chưa đăng nhập QR. Thread cần thêm riêng bằng link kênh thread; không tự quét tất cả thread hoặc forum.

Bấm Lấy tin hôm qua để kiểm tra. Khi tạo bản tin thủ công hoặc đến lịch gửi, app tự xuất tin ngày đó thành JSON tạm, đưa vào kho chung, chống trùng rồi xóa file tạm. Không tải ảnh/file về máy; giữ đường dẫn đính kèm. Respect rate limits giữ bật. Không có bộ hẹn đọc mỗi 10 phút. Lấy tin thất bại sẽ dừng gửi bản tin, hiện trạng thái lỗi; có thể lấy và tạo lại thủ công. Tính năng Quét theo yêu cầu vẫn chỉ đọc kho local, chưa tự tải lại Discord cho khoảng 7 ngày.

Đã kiểm tra luồng bằng dữ liệu xuất giả lập. Chưa kiểm chứng đăng nhập hoặc bản CLI thực tế bằng tài khoản Discord thật; cần cấu hình công cụ/token trên máy trước khi sử dụng.

### Lưu kết nối Telegram trong giao diện

Cài đặt → Kết nối Telegram: nhập token từ BotFather và Chat ID cuộc trò chuyện riêng, bấm Lưu kết nối. Token trống giữ token cũ. Cấu hình lưu tại `DATA_DIR/telegram-private.json`, quyền file 0600 trên hệ điều hành hỗ trợ; file nằm trong thư mục data được Git bỏ qua. Không trả token qua API. Bấm Gửi thử để gửi thật bằng cấu hình đã lưu; cần mở bot và bấm Start trước. Khởi động lại app để cấu hình mới áp dụng cho nhận lệnh và lịch gửi. Cấu hình giao diện được ưu tiên hơn TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID trong .env. APK offline vẫn chỉ thử cấu hình mẫu, chưa kết nối backend.
