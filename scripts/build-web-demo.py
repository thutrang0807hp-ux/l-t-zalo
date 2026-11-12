#!/usr/bin/env python3
"""Build a static mock using the ORIGINAL app UI. Never included by the real backend."""
from pathlib import Path
import shutil,sys
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]) if len(sys.argv)>1 else root/'work/web-demo'
out.mkdir(parents=True,exist_ok=True)
for name in ['index.html','app.js','categories.js','calendar.js','style.css','calendar.css','workspace-theme.css']:
    shutil.copy2(root/'public'/name,out/name)
for name in ['mock-api.mjs','demo-bootstrap.mjs']:
    shutil.copy2(root/'demo'/name,out/name)
mock=(out/'mock-api.mjs').read_text().replace("'../public/categories.js'", "'./categories.js'")
(out/'mock-api.mjs').write_text(mock)
page=(out/'index.html').read_text()
page=page.replace('<body>','<body class="demo-mode"><div class="demo-disclosure"><strong>MÔ PHỎNG PHẦN MỀM GỐC</strong><span>Tin, tài khoản, AI và Telegram đều là mẫu. Không nhập khóa thật.</span><button id="demoTick" type="button">Thử lịch gửi</button><button id="demoReset" type="button">Đặt lại mẫu</button></div>')
page=page.replace('<div id="notice" role="status"></div>','<div id="notice" role="status"></div><section class="demo-flow-log"><strong>Nhật ký luồng mẫu · Zalo → AI → Telegram</strong><ol id="demoEvents"></ol></section>')
page=page.replace('<script type="module" src="/app.js"></script>','<script type="module" src="/demo-bootstrap.mjs"></script>')
page=page.replace('<title>Nhà Tin</title>','<title>Nhà Tin — Mô phỏng đúng luồng gốc</title>')
(out/'index.html').write_text(page)
# Prefix simulation-only success labels; the actual source UI remains unchanged.
js=(out/'app.js').read_text()
js=js.replace("$('#qrImage').src = '/api/accounts/' + activeId + '/qr?t=' + Date.now();", "$('#qrImage').src = window.__demoQrSvg;")
for old,new in [
 ('Zalo đã kết nối','Zalo · kết nối mẫu'),
 ('Đã gửi bản tin qua Telegram','Mô phỏng gửi Telegram — không gửi tin thật'),
 ('Telegram đã chấp nhận tin gửi thử.','Mô phỏng tin thử — Telegram thật chưa được gọi.'),
 ('AI trả lời đúng định dạng. Có thể tạo bản tin.','Mô phỏng AI — không gọi model thật, không tính token.'),
 ('Đã quét và gửi Telegram.','Mô phỏng quét và gửi Telegram — không gửi thật.'),
 ('Đã có cấu hình. Bấm Gửi thử để xác nhận bot nhắn được.','Cấu hình mẫu; nút Gửi thử chỉ mô phỏng.'),
 ('Đã lưu khóa AI. Bấm Kiểm tra AI để thử một lần gọi.','Cấu hình AI mẫu; chưa có khóa hay kết nối model thật.')]:js=js.replace(old,new)
(out/'app.js').write_text(js)
print('Demo built from original public UI:',out)
