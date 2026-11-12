# Nhà Tin — tài liệu bàn giao

Cập nhật: 21/10/2026, giờ Việt Nam (UTC+7). Dùng file này khi chuyển dự án sang công cụ AI, tài khoản hoặc người khác.

## Đọc phần này trước

- Đây là dự án đang làm dở. **Tiếp tục, không làm lại từ đầu.**
- Người dùng muốn trả lời ngắn gọn, bằng tiếng Việt dễ hiểu, ít thuật ngữ.
- **Không nhận là "đã chạy thật"** khi mới có giao diện hoặc mới thử bằng dữ liệu giả. Phần nào đã kiểm chứng, phần nào chưa được ghi ở mục 5.
- **Không yêu cầu người dùng gửi khóa API, token, cookie, file phiên hay mã QR vào chat.** Khóa được nhập trên máy của người dùng (Cài đặt trong app hoặc file `.env`).
- **Không tự xuất APK** hoặc công bố app khi chưa được yêu cầu rõ.
- Sau mỗi lần sửa code: chạy `npm test`, rồi commit bằng git, viết commit message dễ hiểu.

## 1. Sản phẩm

- App tự đọc tin trong các nhóm mà người dùng tham gia (người dùng chỉ là thành viên). Làm Zalo trước, sau đó Discord, rồi Telegram. Đã bỏ Facebook/Messenger.
- **AI gom các cuộc trao đổi đan xen thành từng chủ đề.** Ví dụ A hỏi sửa máy, B hỏi chọn máy, C chia sẻ tài nguyên, nhiều người bàn YouTube thì đó là các mục riêng. Không tóm tắt theo từng người hay từng tin.
- **Bỏ chuyện phiếm và quảng cáo.** Ưu tiên nội dung có ích cho công việc YouTube/dựng video: mẹo, tài liệu, công cụ, cơ hội việc làm. Không lọc theo kiểu dò chữ "quan trọng".
- **Tóm tắt ngắn nhưng giữ đủ ý:** giải pháp, kết quả đã được xác nhận, điểm còn bất đồng. Có nguồn ngay bên dưới để mở xem.
- **Bản tin tự gửi vào bot Telegram riêng.** Mặc định 06:30 giờ Việt Nam, chọn được ngày trong tuần. Mỗi bản tổng hợp ngày hôm trước, tối đa 5 ý nổi bật; ngày ít tin thì không cố cho đủ 5.
- **Không quét hay gọi AI liên tục (ví dụ mỗi 10 phút)**, người dùng phản đối kiểu đó. Chỉ tổng hợp theo lịch, hoặc quét khi người dùng bấm. Quét theo yêu cầu được chọn 7 ngày, 30 ngày, hoặc một khoảng tùy chọn tối đa 90 ngày.
- **Quản lý nguồn:** nhiều nick, chọn nhóm, bật/tắt theo dõi, xếp nhóm theo chủ đề.
- **Gộp tin giống nhau giữa nhiều nhóm theo nghĩa: CHƯA làm.** Đừng nhầm với việc chống trùng cùng một tin nhận qua nhiều nick.

## 2. Ranh giới giao diện (người dùng nhắc nhiều lần)

- **APK/app chính thức chỉ để quản lý:** tài khoản, nhóm, chủ đề, lịch, quét, API và tình trạng. **KHÔNG có tab "Đọc trên Telegram", khung chat hay hộp thư Telegram trong app.** Bản tin đọc trong ứng dụng Telegram thật.
- **Bản mô phỏng HTML** thì được giữ khung Telegram để hình dung tin nhận được.
- **Màu xanh pastel đã chốt:**
  - nền `#f3f8ff`
  - header `#dcecff` → `#eaf4ff`
  - khung trắng viền `#cbdff8`
  - tab đang chọn và nút chính `#7aafea` → `#6298d6`, chữ trắng
- **Bố cục gọn kiểu Toss:** không banner trang trí lớn, không để thừa khoảng trống.
- **Mọi hộp thoại dài đều ghim tiêu đề và nút đóng khi cuộn.** Trong demo dùng `pinDialogHeaders()` và `.pinned-dialog-head`.

## 3. Cách chạy

Cần Node.js 22.13 trở lên (khuyến nghị 24 LTS).

```sh
cd NhaTin
npm ci --ignore-scripts
cp .env.example .env      # sửa trên máy riêng, không gửi vào chat
npm start                 # mở http://127.0.0.1:3000
npm test                  # hiện có 36 test, đều đạt
```

- Trên Windows: dùng `CHAY-APP.bat` (chạy app), `CAU-HINH.bat` (mở `.env`), `KET-NOI-ZALO.bat` (bật kết nối Zalo sau khi đọc cảnh báo). Các file .bat chưa được thử trên máy Windows thật.
- App chỉ lắng nghe trên máy hiện tại (127.0.0.1) và có kiểm tra Host/Origin. **Không mở thẳng ra Internet.**
- Máy chỉ cần bật vào giờ gửi: lúc đó app đọc lịch sử tin từng nhóm (`zalo.syncDay`, dùng `getGroupChatHistory` của zca-js). Đây là ý người dùng: quét các nhóm đã ghim vào 6h30, không phải đọc từng tin suốt ngày. Listener vẫn chạy khi app mở để bù cho nhóm nhiều tin.

**Code chưa có trên GitHub.** Repo https://github.com/thutrang0807hp-ux/l-t-zalo đang trống, và trong ZIP đã có sẵn lịch sử git. Để đẩy lên, chạy trong thư mục `NhaTin`:

```sh
git remote add origin https://github.com/thutrang0807hp-ux/l-t-zalo.git
git push -u origin master:main
```

## 4. Cấu trúc code

- **Công nghệ:** Node (ESM), Express 5.2.1, zca-js 2.2.0, SQLite có sẵn trong Node (`node:sqlite`). Code được định dạng bằng Prettier (`.prettierrc`: dấu nháy đơn, mỗi dòng tối đa 100 ký tự).
- `server.js`: API, khởi động app, lịch gửi (`tick` chạy mỗi 20 giây), dọn tin hết hạn.
- `lib/store.js`: SQLite, gồm các bảng `accounts`, `followed`, `received`, `reports`, `bookmarks`, `options`, `costs`, `gaps`, `sends`, `telegram_views`. Khi đổi cấu trúc bảng thì thêm migration ngay tại đây bằng `ALTER TABLE`.
- `lib/zalo.js`: đăng nhập QR, lưu phiên, nhận tin, danh sách nhóm, tắt thông báo, tự kết nối lại.
- `lib/discord.js`: gọi công cụ DiscordChatExporter để lấy tin theo ngày.
- `lib/reports.js`: gọi AI (API tương thích OpenAI, có retry và giới hạn chi phí), tạo bản tin.
- `lib/conversations.js`: câu lệnh cho AI, gom cuộc trao đổi, kiểm tra nguồn, `parseJson`, `retryInvalid`.
- `lib/highlights.js`: chọn 5 ý nổi bật.
- `lib/ai-config.js`: cấu hình AI lưu trong app (`DATA_DIR/ai-private.json`, quyền 0600). Cấu hình này ưu tiên hơn `.env`.
- `lib/telegram.js`, `lib/telegram-config.js`: bot gửi bản tin và menu (`/tin`, `/nguon`, `/daluu`, `/help`).
- `lib/reading.js`: rút gọn tóm tắt, chọn icon và chủ đề, câu cảnh báo thiếu dữ liệu.
- `lib/scans.js`, `lib/schedule.js`, `lib/categories.js`: quét theo yêu cầu, chọn ngày gửi, chủ đề nhóm.
- `public/`: giao diện của app thật. **Giao diện này khác nhiều so với bản demo.**
- `demo/index.html`: bản mô phỏng HTML mới nhất (v59), dùng dữ liệu mẫu. `demo/mobile.html` là bản cũ.
- `android-demo/`: nguồn APK demo (WebView, chạy offline, dữ liệu mẫu). `assets/index.html` mới hơn APK v5 đã xuất.
- `test/`: test bằng dữ liệu giả (AI, Zalo, Telegram, Discord đều là giả lập), không dùng tài khoản thật.

**Demo và app thật là hai phần riêng.** Sửa demo không làm thay đổi `public/` và không tự nối với backend.

## 5. Trạng thái

| Phần | Tình trạng |
|---|---|
| Zalo | Quét buổi sáng: đọc ~200 tin mới nhất mỗi nhóm (`ZALO_HISTORY_COUNT`; zca-js 2.2.0 không lùi trang được, giới hạn tối đa của Zalo chưa rõ), nhóm vượt mức thì cảnh báo thiếu tin. Nút "Chọn nhóm đã ghim" lấy danh sách ghim trên Zalo (định dạng ID ghim chưa kiểm chứng với nick thật). Đã viết: đăng nhập QR, khôi phục phiên, nhận tin mới, chọn nhóm, tắt thông báo, tự kết nối lại. **Chưa thử với nick thật.** Không tải được lịch sử cũ, không đọc nội dung ảnh. Kết nối không chính thức nên có nguy cơ bị khóa nick. Mở Zalo Web ở nơi khác sẽ ngắt kết nối (trạng thái `replaced`, app không tự giành lại). |
| Discord | Đã viết, dùng DiscordChatExporter và token cá nhân (`DISCORD_EXPORTER_PATH`, `DISCORD_TOKEN`). Thêm kênh bằng link. **Chưa chạy thật.** |
| Bot Telegram nhận bản tin | Đã viết gửi tin, menu, lưu tin, xem nguồn. Cấu hình trong app. **Chưa thử với bot thật.** |
| Telegram đọc nhóm (tài khoản cá nhân / MTProto) | **Chưa làm**, hiện chỉ có mô phỏng. |
| AI | Dùng API tương thích OpenAI. Cấu hình trong app (Cài đặt → AI tóm tắt) hoặc `.env`. Có sẵn cài đặt Gemini miễn phí (giá 0, chờ 6 giây giữa các lần gọi). Đã gọi thật tới máy chủ Gemini bằng khóa giả và nhận đúng lỗi "khóa sai". **Chưa thử với khóa thật.** Chưa kiểm tra tên model và hạn mức gói miễn phí hiện tại (Google hay thay đổi). |
| APK | Chỉ là demo offline dùng dữ liệu mẫu, không có backend. Bản mới nhất **v0.6-demo** (versionCode 6, 21/10/2026) được build từ `android-demo/assets/index.html` bằng `android-demo/build.sh`, không cần Android SDK (cách build xem `android-demo/README.md`). Chữ ký v2 đã được kiểm tra. **Chưa cài thử trên máy Android thật.** v0.6 dùng khóa ký MỚI, nên phải gỡ các bản v1 đến v5 trước khi cài. Khóa được lưu riêng (`demo.p12` + mật khẩu), không có trong ZIP; build lại thì dùng đúng khóa đó để cài đè được. |

## 6. Những gì đã sửa ngày 21/10/2026

- Định dạng lại toàn bộ code, trước đây mỗi file bị dồn thành vài dòng rất dài.
- **AI:**
  - cho phép giá bằng 0 (gói miễn phí);
  - chờ giữa các lần gọi (`MODEL_MIN_INTERVAL_MS`);
  - tự thử lại khi gặp lỗi 429 hoặc 5xx (tôn trọng `Retry-After`);
  - hoàn lại khoản dự phòng ngân sách khi AI từ chối yêu cầu;
  - báo lỗi rõ ràng theo từng mã lỗi, đọc được cả định dạng lỗi riêng của Gemini;
  - phát hiện câu trả lời bị cắt (`finish_reason=length`);
  - bắt buộc có `MODEL_NAME`.
- **Độ tin cậy khi tóm tắt:**
  - gửi mã tin ngắn (1, 2, 3…) cho AI;
  - AI trả sai định dạng thì hỏi lại một lần;
  - một nhóm lỗi thì bỏ qua nhóm đó và ghi cảnh báo (`warnings` có `type: 'ai'`);
  - chọn 5 ý nổi bật lỗi thì dùng 5 mục đầu.
- **Lịch gửi:**
  - bản tin kẹt ở "đang gửi" hoặc bị lỗi sẽ tự thử lại tối đa 3 lần, mỗi lần cách 30 phút (cột `sends.attempts` và `last_attempt`);
  - bản tin đã tạo xong thì gửi lại mà không gọi AI;
  - gửi bằng tay cũng được tính là đã gửi.
- **Lỗi khác:**
  - Discord không còn báo "thiếu dữ liệu" sai.
  - Tin hết hạn được dọn ngay khi khởi động app.
  - "Xem nguồn" trên Telegram gộp nhiều nguồn vào ít tin, nghỉ 1,1 giây giữa các tin.
  - Tin dài được cắt theo ký tự nên không làm vỡ emoji.
  - Danh sách tài khoản không còn nhảy thứ tự.
  - Đường dẫn `public/` không còn phụ thuộc thư mục đang đứng khi chạy.

## 6b. Giảm chi phí và lấy đủ tin (21/10/2026, sau cùng)

- **Lọc tin rác trước khi gửi AI** (`lib/noise.js`): "ok", "haha", emoji, cảm ơn… không gửi cho AI nhưng vẫn lưu làm nguồn. Tin dạng link/ảnh/tệp giữ tiêu đề, mô tả và link; sticker bị bỏ.
- **Cách đọc theo nhóm** (`followed.mode`): 🔍 Đọc kỹ (mặc định, gom chủ đề rồi tóm tắt từng chủ đề) hoặc ⚡ Đọc lướt (nhóm sở thích: mỗi nhóm 1 lần gọi AI, tối đa 5 chuyện). Chọn trong nút Sửa của từng nhóm.
- **Nhóm đông tin**: khi lịch sử bị cắt ở `ZALO_HISTORY_COUNT`, app lùi trang bằng cơ chế tải tin cũ của Zalo Web (`listener.requestOldMessages`, cách làm lấy từ openzca — MIT, github.com/darkamenosa/openzca) cho tới đầu ngày. **Chưa kiểm chứng với Zalo thật.**
- Đã tìm trên GitHub: không có dự án tóm tắt nhóm Zalo nào. Có vài dự án cho Telegram (dev0x13/telegram-chat-summarizer, igoropaniuk/teledigest, belaytzev/Telebrief), đơn giản hơn app này. Ý tưởng đáng lấy sau: cho phép hỏi thêm về một tin ngay trong bot Telegram.

## 6c. Discord: chọn kênh từ danh sách (21/10/2026)

- Nút "+ Chọn kênh theo dõi" → Tải danh sách server (lệnh `guilds` của DiscordChatExporter) → chọn server → tick kênh (lệnh `channels -g <id> --include-vc false`) → Lưu. Chỉ thay đổi kênh của server đang chọn. Vẫn giữ cách thêm bằng link (cần cho thread).
- Đọc định dạng "ID | Tên" in ra của CLI (đối chiếu mã nguồn DiscordChatExporter ngày 20/10/2026). Token chỉ truyền qua biến môi trường. Đã thử bằng CLI giả; **chưa chạy CLI/tài khoản thật.**

## 7. Việc còn lại (theo thứ tự nên làm)

1. Người dùng nhập khóa Gemini thật trong app, bấm **Kiểm tra AI**. Nếu lỗi, xem câu báo lỗi (không xin khóa).
2. Chạy thử từ đầu đến cuối với **1 nhóm Zalo (nên dùng nick phụ) + Gemini + bot Telegram** trong khoảng một tuần. Đánh giá chất lượng tóm tắt và số lần gọi AI trước khi mở rộng sang nguồn khác.
3. Nếu gói miễn phí hết hạn mức: thêm cách gom ít lần gọi hơn, ví dụ gộp bước tóm tắt nhiều chủ đề vào một lần gọi.
4. File phiên Zalo trên Windows đang lưu dạng chữ thường (lệnh khóa quyền file không có tác dụng trên Windows). Nên mã hóa bằng DPAPI hoặc ít nhất cảnh báo người dùng.
5. Đưa giao diện demo mới (v59) vào `public/` của app thật. Hiện hai bên khác nhau nhiều.
6. Muốn app điện thoại dùng được thật thì cần: backend có xác thực, ghép cặp thiết bị và HTTPS. Chưa chọn nơi chạy backend.
7. Telegram đọc nhóm bằng tài khoản cá nhân (MTProto): chưa làm.
8. Gộp nội dung giống nhau giữa nhiều nhóm: chưa làm.

## 8. Lưu ý kỹ thuật

- **Không được đưa vào ZIP hay git:** `.env`, `data/`, file SQLite, file phiên và cookie, `ai-private.json`, `telegram-private.json`, `node_modules`, keystore, file build. `.gitignore` đã chặn `.env`, `data/`, `node_modules/`.
- **Lỗi từ AI** có thuộc tính `retryable`: giá trị `false` nghĩa là lỗi cấu hình, quota hoặc ngân sách thì dừng hẳn; còn lại thì được hỏi lại hoặc bỏ qua nhóm đó.
- **Trần chi phí** lưu trong `options.budget` (mặc định $5/tháng). Chi phí chỉ là ước tính, không phải hóa đơn thật.
- **Bản demo lưu dữ liệu trong localStorage.** Nếu đổi cấu trúc dữ liệu thì phải viết thêm code chuyển đổi.

## 9. Câu mở đầu khi chuyển sang công cụ khác

Gửi kèm file ZIP mã nguồn và câu sau:

> Đây là dự án Nhà Tin đang làm dở. Giải nén ZIP, đọc NhaTin/HANDOFF.md trước, chạy `npm ci --ignore-scripts` và `npm test` để kiểm tra trạng thái thực tế. Tiếp tục theo yêu cầu mới của tôi, không làm lại từ đầu. Giữ giao diện xanh pastel; APK chỉ để quản lý, không có tab/khung Telegram. Không nhầm demo với kết nối thật, không xin khóa API qua chat, không tự xuất APK. Trả lời tôi bằng tiếng Việt ngắn gọn, dễ hiểu.
