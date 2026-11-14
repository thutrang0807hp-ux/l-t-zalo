let noticeTimer;
for (const link of document.querySelectorAll('.download')) {
  link.addEventListener('click', () => {
    const notice = document.getElementById('downloadNotice');
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 8000);
  });
}
fetch('downloads/release.json').then(r => r.json()).then(release => {
  if (Number.isFinite(release.bytes)) document.getElementById('fileSize').textContent = Math.round(release.bytes / 1024) + ' KB';
}).catch(() => {});
