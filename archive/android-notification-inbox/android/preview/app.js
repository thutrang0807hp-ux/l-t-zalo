let noticeTimer;
for (const link of document.querySelectorAll('.download')) {
  link.addEventListener('click', () => {
    const notice = document.getElementById('downloadNotice');
    notice.textContent = 'Link tải đã mở ở tab mới. Nếu bị chặn, dùng mục Cách khác hoặc sao chép link vào Chrome.';
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 8000);
  });
}
fetch('downloads/release.json').then(r => r.json()).then(release => {
  if (Number.isFinite(release.bytes)) document.getElementById('fileSize').textContent = (release.bytes >= 1048576 ? (release.bytes / 1048576).toFixed(1) + ' MB' : Math.round(release.bytes / 1024) + ' KB');
}).catch(() => {});

const copyButton = document.getElementById('copyApkLink');
copyButton.addEventListener('click', async () => {
  const input = document.getElementById('apkDirectLink');
  const status = document.getElementById('copyStatus');
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = 'Đã sao chép. Mở Chrome và dán vào thanh địa chỉ để tải APK.';
  } catch {
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
    status.textContent = 'Đã chọn link. Nhấn giữ hoặc Ctrl+C để sao chép, rồi dán vào Chrome.';
  }
});
