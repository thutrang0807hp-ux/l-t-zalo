import { groupTopics, validateGroupTopics, topicLabel } from './categories.js';
const $ = (s) => document.querySelector(s),
  PLATFORMS = ['Zalo', 'Discord', 'Telegram'];
let notificationEntries = null;
let activeTopic = '',
  sourceView = 'topics';
let state,
  current = 'Zalo',
  report,
  botPlatform = '',
  botGroup = '',
  activeId,
  available = [],
  draft = new Set(),
  filterTarget,
  mainView = 'feed',
  feedExpanded = false,
  chatExpanded = false,
  scanTarget = null,
  scanPreviewToken = 0;
const text = (tag, value, cls) => {
  const e = document.createElement(tag);
  if (value !== undefined) e.textContent = value;
  if (cls) e.className = cls;
  return e;
};
const request = async (path, data, method = data ? 'POST' : 'GET') => {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (r.status === 204) return {};
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Yêu cầu thất bại');
  return d;
};
async function act(fn) {
  try {
    $('#notice').textContent = '';
    await fn();
  } catch (e) {
    $('#notice').textContent = e.message;
    if ($('#connectDialog').open) $('#qrStatus').textContent = e.message;
  }
}
const statusLabel = {
  disconnected: 'Mất/chưa kết nối',
  connecting: 'Đang kết nối',
  restoring: 'Đang khôi phục phiên',
  qr_pending: 'Chờ quét QR',
  qr_scanned: 'Đã quét, chờ xác nhận',
  qr_expired: 'QR hết hạn — tạo lại',
  qr_declined: 'Đăng nhập bị từ chối',
  qr_write_failed: 'Không lưu được QR — kiểm tra quyền thư mục dữ liệu',
  login_failed: 'Đăng nhập thất bại — thử QR mới',
  replaced: 'Zalo đang mở ở nơi khác — bấm kết nối lại',
  listening: 'Đang mở kết nối nhận tin',
  connected: 'Đã kết nối',
  receive_error: 'Lỗi nhận tin',
};
const clock = (ts) =>
  ts ? new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa nhận tin';
function renderAccounts() {
  const tabs = $('#platforms');
  tabs.replaceChildren();
  for (const p of PLATFORMS) {
    const b = text('button', p, p === current ? 'active' : '');
    b.onclick = () => {
      current = p;
      renderAccounts();
    };
    tabs.append(b);
  }
  const host = $('#accounts');
  host.replaceChildren();
  $('#byTopic').classList.toggle('active', sourceView === 'topics');
  $('#byAccount').classList.toggle('active', sourceView === 'accounts');
  if (sourceView === 'topics') {
    renderTopicGroups(host);
    return;
  }
  if (current === 'Discord') {
    renderDiscordAccounts(host);
    return;
  }
  if (current !== 'Zalo') {
    host.append(
      text(
        'p',
        'Nguồn ' + current + ' chưa được tích hợp. Telegram vẫn dùng để nhận báo cáo.',
        'empty',
      ),
    );
    return;
  }
  for (const a of state.accounts.filter((a) => a.platform === current)) {
    const box = text('div', undefined, 'account'),
      head = text('div', undefined, 'accounthead');
    head.append(text('div', a.name[0], 'avatar'));
    const name = text('div', undefined, 'grow');
    name.append(
      text('div', a.name, 'name'),
      text(
        'div',
        a.enabled ? statusLabel[a.status] || a.status : 'Đã tạm dừng',
        'status-badge ' +
          (!a.enabled ? 'status-off' : a.status === 'connected' ? 'status-ok' : 'status-bad'),
      ),
    );
    head.append(name);
    const toggle = text(
      'button',
      a.enabled ? 'Tạm dừng' : 'Bật',
      'switch' + (a.enabled ? '' : ' off'),
    );
    toggle.onclick = () =>
      act(async () => {
        await request('/api/accounts/' + a.id + '/toggle', { enabled: !a.enabled });
        await refresh();
      });
    head.append(toggle);
    box.append(head);
    const info = text('div', 'Tin mới nhất: ' + clock(a.last_seen), 'status-line');
    info.style.padding = '0 15px';
    box.append(info);
    if (a.enabled) {
      const connect = text(
        'button',
        a.status === 'connected' ? 'Đăng nhập lại' : 'Kết nối',
        'secondary',
      );
      connect.style.margin = '10px';
      connect.onclick = () =>
        act(async () => {
          activeId = a.id;
          $('#connectDialog').showModal();
          if (state.zaloEnabled &&
            !['qr_pending', 'qr_scanned', 'connecting', 'restoring', 'listening'].includes(a.status)
          )
            await request('/api/accounts/' + a.id + '/connect', { qr: false });
          await refresh();
        });
      box.append(connect);
    }
    for (const g of a.groups) {
      const row = text('div', undefined, 'group'),
        check = text('input');
      check.type = 'checkbox';
      check.checked = !!g.enabled;
      check.onchange = () =>
        act(async () => {
          await request('/api/accounts/' + a.id + '/group', {
            groupId: g.group_id,
            instructions: g.instructions,
            enabled: check.checked,
          });
          await refresh();
        });
      row.append(check);
      const body = text('div', undefined, 'grow');
      body.append(
        text('div', g.name, 'name'),
        text(
          'div',
          (g.mode === 'quick' ? '⚡ Đọc lướt · ' : '') +
            (g.instructions || 'AI đánh giá nội dung; bỏ chuyện phiếm và quảng cáo'),
          'sub',
        ),
      );
      row.append(body);
      const edit = text('button', 'Sửa', 'edit');
      edit.onclick = () => openGroupEditor(a, g);
      const scan = text('button', 'Quét', 'edit');
      scan.onclick = () => act(() => openScan(a, g));
      row.append(edit, scan);
      box.append(row);
    }
    const choose = text('button', '+ Chọn nhóm theo dõi', 'secondary');
    choose.style.margin = '12px';
    choose.disabled = a.status !== 'connected';
    choose.onclick = () =>
      act(async () => {
        activeId = a.id;
        available = await request('/api/accounts/' + a.id + '/catalog');
        draft = new Set(a.groups.map((g) => g.group_id));
        $('#groupSearch').value = '';
        renderCatalog();
        $('#groupDialog').showModal();
        void loadNotificationStates();
      });
    box.append(choose);
    const logout = text('button', 'Quên phiên đăng nhập', 'edit');
    logout.onclick = () =>
      act(async () => {
        if (!confirm('Xóa phiên đăng nhập đã lưu của tài khoản này?')) return;
        await request('/api/accounts/' + a.id + '/logout', {});
        await refresh();
      });
    box.append(logout);
    host.append(box);
  }
  if (!host.children.length)
    host.append(text('p', 'Thêm một tài khoản Zalo rồi quét QR để bắt đầu.', 'empty'));
}
function renderCatalog() {
  const catalogAccountId = activeId;
  $('#catalogCount').textContent = available.length + ' nhóm đã tham gia';
  const host = $('#availableGroups');
  host.replaceChildren();
  for (const g of available.filter((g) =>
    g.name.toLocaleLowerCase('vi').includes($('#groupSearch').value.toLocaleLowerCase('vi')),
  )) {
    const label = text('label', undefined, 'group-choice'),
      check = text('input');
    check.type = 'checkbox';
    check.checked = draft.has(g.id);
    check.onchange = () => (check.checked ? draft.add(g.id) : draft.delete(g.id));
    label.append(check, text('span', g.name, 'grow'));
    const info = notificationEntries?.find((n) => n.id === g.id),
      muted = notificationEntries === null ? null : !!info?.muted;
    const control = text('button', muted === true ? 'Bật thông báo' : 'Tắt thông báo Zalo', 'edit');
    control.type = 'button';
    control.onclick = (e) => {
      e.preventDefault();
      void act(async () => {
        control.disabled = true;
        try {
          const r = await request('/api/accounts/' + catalogAccountId + '/mute', {
            groupIds: [g.id],
            muted: muted !== true,
            duration: Number($('#muteDuration').value),
          });
          if (catalogAccountId !== activeId) return;
          if (!r.results[0]?.ok) throw Error('Zalo chưa xác nhận thay đổi; thử lại sau');
          const mutedNow = muted !== true;
          notificationEntries = (notificationEntries || []).filter((n) => n.id !== g.id);
          notificationEntries.push({ id: g.id, muted: mutedNow });
          $('#muteNotice').textContent = mutedNow
            ? 'Đã yêu cầu tắt thông báo nhóm trên Zalo. App vẫn nhận tin nếu nhóm được theo dõi.'
            : 'Đã yêu cầu bật lại thông báo nhóm trên Zalo.';
          renderCatalog();
        } finally {
          control.disabled = false;
        }
      });
    };
    label.append(control);
    host.append(label);
  }
  if (!host.children.length) host.append(text('p', 'Không thấy nhóm phù hợp.', 'muted'));
}
function renderReport() {
  renderFeed();
  const host = $('#chat');
  host.replaceChildren();
  if (!report) {
    host.append(
      text('div', 'Chưa có bản tin. Kết nối tài khoản, chọn nhóm và đợi tin mới.', 'bubble'),
    );
    return;
  }
  const intro = text('div', undefined, 'bubble');
  intro.append(
    text('strong', '☀ Bản tin ngày ' + report.day),
    text('div', report.items.length + ' mục đáng xem'),
  );
  if (report.warnings.some((w) => w.type !== 'ai'))
    intro.append(text('p', '⚠ Có thời gian chưa nhận được tin. Bản tin có thể thiếu.', 'muted'));
  const skipped = report.warnings.filter((w) => w.type === 'ai');
  if (skipped.length)
    intro.append(
      text(
        'p',
        '⚠ AI chưa tóm tắt được: ' +
          skipped.map((w) => w.group).join(', ') +
          '. Tạo lại bản tin sau.',
        'muted',
      ),
    );
  if (!chatExpanded) {
    for (const [n, i] of highlights(report).entries())
      intro.append(
        text(
          'div',
          n +
            1 +
            '. ' +
            i.title +
            '\n' +
            i.summary.slice(0, 160) +
            (i.summary.length > 160 ? '…' : ''),
          'short-item',
        ),
      );
    const more = text('button', 'Xem thêm · chọn nguồn và nhóm', 'secondary');
    more.onclick = () => {
      chatExpanded = true;
      botPlatform = '';
      renderReport();
    };
    const send = text('button', 'Gửi qua Telegram', 'edit');
    send.onclick = () => act(() => request('/api/reports/' + report.id + '/send', {}));
    intro.append(more, send);
    host.append(intro);
    return;
  }
  const short = text('button', '← Bản ngắn', 'edit');
  short.onclick = () => {
    (chatExpanded = false), (scanTarget = null), (scanPreviewToken = 0);
    renderReport();
  };
  intro.append(short);
  const kb = text('div', undefined, 'keyboard');
  for (const p of PLATFORMS) {
    const b = text(
      'button',
      p + ' (' + report.items.filter((i) => i.platform === p).length + ')',
      p === botPlatform ? 'active' : '',
    );
    b.onclick = () => {
      botPlatform = p;
      botGroup = '';
      renderReport();
    };
    kb.append(b);
  }
  intro.append(kb);
  const send = text('button', 'Gửi bản này qua Telegram', 'secondary');
  send.onclick = () =>
    act(async () => {
      await request('/api/reports/' + report.id + '/send', {});
      $('#notice').textContent = 'Đã gửi bản tin qua Telegram';
    });
  intro.append(send);
  host.append(intro);
  if (!botPlatform) return;
  const all = report.items.filter((i) => i.platform === botPlatform);
  if (!all.length) {
    host.append(
      text(
        'div',
        botPlatform === 'Zalo' ? 'Không có mục hữu ích từ Zalo.' : 'Nguồn này chưa được tích hợp.',
        'bubble',
      ),
    );
    return;
  }
  if (!botGroup) {
    for (const [id, name] of new Map(all.map((i) => [i.groupId, i.groupName]))) {
      const b = text('button', name, 'news-button');
      b.onclick = () => {
        botGroup = id;
        renderReport();
      };
      host.append(b);
    }
    return;
  }
  const back = text('button', '← Chọn nhóm', 'news-button');
  back.onclick = () => {
    botGroup = '';
    renderReport();
  };
  host.append(back);
  for (const i of all.filter((i) => i.groupId === botGroup)) {
    const b = text('div', undefined, 'bubble');
    b.append(
      text('strong', i.title),
      text('p', i.summary),
      text('div', 'Vì sao đáng xem: ' + i.why, 'why'),
      text('div', i.groupName, 'source'),
    );
    for (const link of i.links) {
      try {
        if (!['http:', 'https:'].includes(new URL(link).protocol)) continue;
      } catch {
        continue;
      }
      const a = text('a', link, 'link');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      b.append(a);
    }
    const original = text('button', 'Xem nguồn gốc đã lưu', 'edit');
    original.onclick = () =>
      act(async () => {
        const host = $('#sourceContent');
        host.replaceChildren();
        for (const id of i.refs) {
          try {
            const m = await request('/api/sources/' + id);
            host.append(
              text('div', m.sender + ' · ' + clock(m.ts), 'sub'),
              text(
                'div',
                (m.quote_text ? '[Trích dẫn] ' + m.quote_text + '\n\n' : '') + m.content,
                'bubble',
              ),
            );
          } catch {
            host.append(text('p', 'Tin gốc đã hết thời gian lưu.', 'muted'));
          }
        }
        $('#sourceDialog').showModal();
      });
    b.append(original);
    host.append(b);
  }
}
async function refresh() {
  state = await request('/api/state');
  $('#connectionBadge').textContent = state.accounts.some((a) => a.status === 'connected')
    ? 'Zalo đã kết nối'
    : 'Chưa kết nối nguồn';
  $('#botStatus').textContent = state.telegram;
  $('#hourLabel').textContent = state.hour;
  $('#integrationStatus').textContent =
    'AI: ' +
    (state.ai ? 'đã cấu hình, chưa kiểm chứng bằng trạng thái này' : 'chưa cấu hình') +
    ' · Telegram: ' +
    state.telegram;
  $('#cost').textContent =
    'Phí AI ghi nhận / dự phòng: $' + state.spend.toFixed(3) + ' / $5 tháng này';
  if (!$('#settingsDialog').open) {
    $('#settingsForm [name=hour]').value = state.hour;
    renderSendDays(state.sendDays);
    $('#settingsForm [name=retention]').value = state.retention;
  }
  renderAccounts();
  if (!report || (state.report && state.report.created > report.created)) {
    report = state.report;
    renderReport();
  }
  renderFeed();
  const history = $('#reportHistory');
  history.replaceChildren();
  for (const r of state.reports.slice(0, 10)) {
    const b = text('button', 'Bản ' + r.day, 'edit');
    b.onclick = () =>
      act(async () => {
        report = await request('/api/reports/' + r.id);
        botPlatform = '';
        botGroup = '';
        renderReport();
      });
    history.append(b);
  }
  if ($('#connectDialog').open) {
    const a = state.accounts.find((a) => a.id === activeId);
    $('#zaloEnablePanel').hidden = state.zaloEnabled;
    $('#freshQR').hidden = !state.zaloEnabled;
    $('#freshQR').disabled = ['connecting', 'restoring', 'listening'].includes(a?.status);
    $('#qrStatus').textContent = state.zaloEnabled
      ? statusLabel[a?.status] || 'Chưa kết nối'
      : 'Kết nối Zalo chưa được bật. Xác nhận bên trên để đăng nhập thật.';
    if (a?.status === 'connected') {
      const accountId = activeId;
      $('#connectDialog').close();
      available = await request('/api/accounts/' + accountId + '/catalog');
      activeId = accountId;
      draft = new Set(a.groups.map((g) => g.group_id));
      $('#groupSearch').value = '';
      renderCatalog();
      $('#groupDialog').showModal();
      void loadNotificationStates();
    }
    $('#qrImage').hidden = !['qr_pending', 'qr_scanned'].includes(a?.status);
    if (!$('#qrImage').hidden)
      $('#qrImage').src = '/api/accounts/' + activeId + '/qr?t=' + Date.now();
  }
  const scans = await request('/api/scans');
  $('#scanHistory').replaceChildren();
  for (const scan of scans) {
    const row = text('div', undefined, 'status-line');
    row.append(
      text('span', scan.scan.groupName + ' · ' + scan.scan.from + ' → ' + scan.scan.to + ' '),
    );
    const send = text('button', 'Gửi lại Telegram', 'edit');
    send.onclick = () =>
      act(async () => {
        await request('/api/reports/' + scan.id + '/send', {});
        $('#notice').textContent = 'Đã gửi kết quả quét';
      });
    row.append(send);
    $('#scanHistory').append(row);
  }
  const deliveries = await request('/api/delivery');
  $('#delivery').replaceChildren();
  for (const d of deliveries.filter((d) => d.state === 'failed').slice(0, 2))
    $('#delivery').append(
      text(
        'p',
        'Gửi tự động ' + d.day + ' thất bại: ' + d.error + ' — thử tạo/gửi lại thủ công.',
        'muted',
      ),
    );
}
for (const b of document.querySelectorAll('[data-close]'))
  b.onclick = () => $('#' + b.dataset.close).close();
$('#openSettings').onclick = () => {
  $('#settingsDialog').showModal();
  void act(loadTelegramConfig);
  void act(loadAIConfig);
};
$('#addAccount').onclick = () => $('#accountDialog').showModal();
$('#groupSearch').oninput = renderCatalog;
$('#selectPinnedGroups').onclick = () =>
  act(async () => {
    const ids = await request('/api/accounts/' + activeId + '/pinned');
    if (!ids.length) throw Error('Không thấy nhóm nào đang ghim trên Zalo của tài khoản này.');
    draft = new Set(ids);
    renderCatalog();
    $('#muteNotice').textContent =
      'Đã chọn ' + ids.length + ' nhóm đang ghim trên Zalo. Bấm Lưu nhóm đã chọn để theo dõi.';
  });
$('#accountForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    const a = await request('/api/accounts', {
      name: e.target.elements.namedItem('name').value,
      platform: e.target.elements.namedItem('platform').value,
    });
    $('#accountDialog').close();
    e.target.reset();
    activeId = a.id;
    await refresh();
    if (a.platform === 'Discord') {
      openDiscord(a.id);
      return;
    }
    $('#connectDialog').showModal();
    if (state.zaloEnabled) await request('/api/accounts/' + a.id + '/connect', { qr: true });
    await refresh();
  });
};
$('#enableZalo').onclick = () => act(async () => {
  if (!$('#acceptZaloRisk').checked) throw Error('Hãy đọc và xác nhận rủi ro trước khi kết nối');
  const button = $('#enableZalo');
  button.disabled = true;
  try {
    await request('/api/zalo/enable', { acceptRisk: true });
    await request('/api/accounts/' + activeId + '/connect', { qr: true });
    await refresh();
  } finally {
    button.disabled = false;
  }
});
$('#freshQR').onclick = () =>
  act(async () => {
    await request('/api/accounts/' + activeId + '/connect', { qr: true });
    await refresh();
  });
$('#groupForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    await request('/api/accounts/' + activeId + '/groups', { ids: [...draft] });
    $('#groupDialog').close();
    setMainView('sources');
    await refresh();
  });
};
$('#filterForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    await request('/api/accounts/' + filterTarget.a.id + '/group', {
      groupId: filterTarget.g.group_id,
      instructions: e.target.elements.namedItem('instructions').value,
      categories:
        e.target.elements.namedItem('categoryMode').value === 'auto'
          ? null
          : validateGroupTopics(
              e.target.elements
                .namedItem('categories')
                .value.split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            ),
      enabled: e.target.elements.namedItem('enabled').checked,
      mode: e.target.elements.namedItem('mode').value,
    });
    $('#filterDialog').close();
    await refresh();
  });
};
$('#settingsForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    await request('/api/settings', {
      hour: e.target.elements.namedItem('hour').value,
      sendDays: chosenSendDays(),
      retention: Number(e.target.elements.namedItem('retention').value),
    });
    $('#settingsDialog').close();
    await refresh();
  });
};
$('#testTelegram').onclick = () =>
  act(async () => {
    await request('/api/telegram/test', {});
    $('#notice').textContent = 'Đã gửi tin thử';
  });
$('#reportForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    const b = e.target.querySelector('button');
    b.disabled = true;
    b.textContent = 'AI đang đọc…';
    try {
      report = await request('/api/reports', { day: e.target.elements.namedItem('day').value });
      botPlatform = 'Zalo';
      botGroup = '';
      setMainView('feed');
      renderReport();
      await refresh();
    } finally {
      b.disabled = false;
      b.textContent = 'Tạo bản tin';
    }
  });
};

function setMainView(view) {
  mainView = view;
  document.body.classList.toggle('managing-sources', view === 'sources');
  $('#sourcesPanel').classList.toggle('hidden', view !== 'sources');
  $('#feedPanel').classList.toggle('hidden', view === 'sources');
  for (const b of document.querySelectorAll('[data-view]'))
    b.classList.toggle('active', b.dataset.view === view);
  renderFeed();
}
async function bookmark(item) {
  if (state.bookmarks.some((x) => x.id === item.id))
    await request('/api/bookmarks/' + item.id, undefined, 'DELETE');
  else await request('/api/bookmarks', { reportId: report.id, itemId: item.id });
  await refresh();
}
function renderFeed() {
  if (!state) return;
  $('#savedCount').textContent = state.bookmarks.length;
  $('#feedTitle').textContent =
    mainView === 'saved'
      ? 'Tin đã lưu'
      : report
        ? 'Bản tin ngày ' + report.day
        : 'Bản tin gần nhất';
  const host = $('#feedItems');
  host.replaceChildren();
  const q = $('#feedSearch').value.trim().toLocaleLowerCase('vi'),
    platform = $('#feedPlatform').value;
  const allItems = (mainView === 'saved' ? state.bookmarks : report?.items || []).filter(
    (i) =>
      (!platform || i.platform === platform) &&
      [i.title, i.summary, i.groupName].join(' ').toLocaleLowerCase('vi').includes(q),
  );
  const compact = mainView === 'feed' && !feedExpanded && !q && !platform;
  const items = compact ? highlights(report) : allItems;
  if (!items.length) {
    const msg =
      mainView === 'saved'
        ? 'Chưa lưu tin nào.'
        : 'Chưa có tin phù hợp. Kết nối nguồn và tạo bản tin để bắt đầu.';
    host.append(text('p', msg, 'empty'));
    if (mainView !== 'saved') {
      const b = text('button', 'Quản lý nguồn theo dõi', 'secondary');
      b.onclick = () => setMainView('sources');
      host.append(b);
    }
    return;
  }
  for (const i of items) {
    const card = text('article', undefined, 'feed-story');
    card.append(
      text('div', i.platform + ' · ' + i.groupName, 'feed-source'),
      text('h4', i.title),
      ...(i.messageCount
        ? [
            text(
              'div',
              i.messageCount + ' tin · ' + (i.participants?.length || 0) + ' người trao đổi',
              'sub',
            ),
          ]
        : []),
      text(
        'p',
        compact ? i.summary.slice(0, 180) + (i.summary.length > 180 ? '…' : '') : i.summary,
      ),
      ...(compact ? [] : [text('div', i.why, 'why')]),
    );
    const actions = text('div', undefined, 'story-actions'),
      source = text('button', '↗ Xem nguồn', 'edit');
    source.onclick = () =>
      act(async () => {
        const host = $('#sourceContent');
        host.replaceChildren();
        for (const id of i.refs) {
          try {
            const m = await request('/api/sources/' + id);
            host.append(
              text('div', m.sender + ' · ' + clock(m.ts), 'sub'),
              text(
                'div',
                (m.quote_text ? '[Trích dẫn] ' + m.quote_text + '\n\n' : '') + m.content,
                'bubble',
              ),
            );
          } catch {
            host.append(text('p', 'Tin gốc đã hết thời gian lưu.', 'muted'));
          }
        }
        $('#sourceDialog').showModal();
      });
    const save = text(
      'button',
      state.bookmarks.some((x) => x.id === i.id) ? '✓ Đã lưu' : '☆ Lưu xem sau',
      'secondary',
    );
    save.onclick = () => act(() => bookmark(i));
    actions.append(source, save);
    card.append(actions);
    host.append(card);
  }
  if (mainView === 'feed' && !q && !platform && (!compact || allItems.length > items.length)) {
    const more = text(
      'button',
      compact
        ? 'Xem thêm · ' + (allItems.length - items.length) + ' mục còn lại'
        : 'Thu gọn · 5 ý nổi bật',
      'secondary',
    );
    more.onclick = () => {
      feedExpanded = !feedExpanded;
      renderFeed();
    };
    host.append(more);
  }
}
for (const b of document.querySelectorAll('[data-view]'))
  b.onclick = () => setMainView(b.dataset.view);
$('#feedSearch').oninput = renderFeed;
$('#feedPlatform').onchange = renderFeed;

$('#reportForm [name=day]').value = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(Date.now() - 86400000));
act(refresh);
let polling = false;
setInterval(async () => {
  if (polling) return;
  polling = true;
  try {
    await refresh();
  } catch {
    $('#notice').textContent = 'Không kết nối được app. Kiểm tra cửa sổ chạy trên máy.';
  } finally {
    polling = false;
  }
}, 5000);

function highlights(r) {
  if (!r) return [];
  return (
    Array.isArray(r.highlights)
      ? r.highlights.map((id) => r.items.find((i) => i.id === id)).filter(Boolean)
      : r.items
  ).slice(0, 5);
}

function dateVN(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
function setScanDates() {
  const f = $('#scanForm'),
    n = Number(f.elements.namedItem('preset').value);
  if (!n) return;
  f.elements.namedItem('from').value = dateVN(new Date(Date.now() - n * 86400000));
  f.elements.namedItem('to').value = dateVN(new Date(Date.now() - 86400000));
}
function scanBody() {
  const f = $('#scanForm');
  return {
    accountId: scanTarget.a.id,
    groupId: scanTarget.g.group_id,
    from: f.elements.namedItem('from').value,
    to: f.elements.namedItem('to').value,
    query: f.elements.namedItem('query').value,
    send: f.elements.namedItem('send').checked,
  };
}
async function previewScan() {
  const token = ++scanPreviewToken;
  $('#runScan').disabled = true;
  try {
    const p = await request('/api/scans/preview', scanBody());
    if (token !== scanPreviewToken) return;
    $('#scanCoverage').replaceChildren(
      text('strong', p.count + ' tin đang có trong kho'),
      ...p.warnings.map((w) => text('p', w, 'muted')),
    );
    $('#runScan').disabled = !p.count;
  } catch (e) {
    if (token === scanPreviewToken) $('#scanCoverage').textContent = e.message;
  }
}
async function openScan(a, g) {
  scanTarget = { a, g };
  $('#scanGroupName').textContent = a.name + ' › ' + g.name;
  $('#scanForm').reset();
  setScanDates();
  $('#scanDialog').showModal();
  await previewScan();
}
$('#scanForm [name=preset]').onchange = () => {
  setScanDates();
  void previewScan();
};
for (const name of ['from', 'to'])
  $('#scanForm [name=' + name + ']').onchange = () => {
    $('#scanForm [name=preset]').value = 'custom';
    void previewScan();
  };
$('#scanForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    const button = $('#runScan');
    button.disabled = true;
    button.textContent = 'AI đang quét…';
    try {
      const r = await request('/api/scans', scanBody());
      $('#scanDialog').close();
      $('#notice').textContent =
        r.deliveryError ||
        (scanBody().send
          ? 'Đã quét và gửi Telegram.'
          : 'Đã quét xong; kết quả được lưu để gửi sau.');
      await refresh();
    } catch (e) {
      $('#scanCoverage').textContent = e.message;
      throw e;
    } finally {
      button.disabled = false;
      button.textContent = 'Quét một lần';
    }
  });
};

async function loadNotificationStates() {
  const id = activeId;
  notificationEntries = null;
  try {
    const entries = await request('/api/accounts/' + id + '/notifications');
    if (id !== activeId) return;
    notificationEntries = entries;
    $('#muteNotice').textContent =
      'Tắt thông báo áp dụng cho Zalo, không phải cài đặt âm thanh Windows. Chưa kiểm chứng đồng bộ trên mọi thiết bị.';
  } catch {
    if (id !== activeId) return;
    $('#muteNotice').textContent =
      'Chưa đọc được trạng thái thông báo Zalo. Vẫn có thể gửi yêu cầu tắt từng nhóm.';
  }
  renderCatalog();
}
$('#reloadCatalog').onclick = () =>
  act(async () => {
    available = await request('/api/accounts/' + activeId + '/catalog?refresh=true');
    await loadNotificationStates();
  });

$('#selectAllGroups').onclick = () => {
  for (const g of available) draft.add(g.id);
  renderCatalog();
};
$('#clearAllGroups').onclick = () => {
  draft.clear();
  renderCatalog();
};

function openGroupEditor(a, g) {
  filterTarget = { a, g };
  const f = $('#filterForm');
  $('#filterGroupName').textContent = g.name + ' · ' + a.name;
  f.elements.namedItem('instructions').value = g.instructions;
  f.elements.namedItem('enabled').checked = !!g.enabled;
  f.elements.namedItem('mode').value = g.mode || 'deep';
  f.elements.namedItem('categoryMode').value = g.categories === null ? 'auto' : 'manual';
  f.elements.namedItem('categories').value = [
    ...new Set(groupTopics(g).map((t) => topicLabel(t, state.topicSettings))),
  ]
    .filter((t) => t !== 'Chưa phân loại')
    .join(', ');
  f.elements.namedItem('categories').disabled = g.categories === null;
  $('#filterDialog').showModal();
}
$('#filterForm [name=categoryMode]').onchange = (e) => {
  $('#filterForm [name=categories]').disabled = e.target.value === 'auto';
};
$('#byTopic').onclick = () => {
  sourceView = 'topics';
  renderAccounts();
};
$('#byAccount').onclick = () => {
  sourceView = 'accounts';
  renderAccounts();
};
function renderTopicGroups(host) {
  const groups = new Map();
  for (const a of state.accounts.filter((a) => a.platform === current))
    for (const g of a.groups) {
      const old = groups.get(g.group_id);
      if (old) old.bindings.push({ a, g });
      else groups.set(g.group_id, { name: g.name, bindings: [{ a, g }] });
    }
  const sections = new Map();
  for (const value of groups.values()) {
    const { a, g } = value.bindings[0];
    for (const topic of [
      ...new Set(groupTopics(g).map((t) => topicLabel(t, state.topicSettings))),
    ]) {
      if (!sections.has(topic)) sections.set(topic, []);
      sections.get(topic).push(value);
    }
  }
  const topics = [...new Set([...sections.keys(), ...(state.topicSettings?.custom || [])])];
  if (activeTopic && !topics.includes(activeTopic)) activeTopic = '';
  const tabs = text('div', undefined, 'topic-tabs');
  for (const topic of ['', ...topics]) {
    const b = text(
      'button',
      (topic || 'Tất cả') + ' · ' + (topic ? sections.get(topic)?.length || 0 : groups.size),
      topic === activeTopic ? 'active' : '',
    );
    b.onclick = () => {
      activeTopic = topic;
      renderAccounts();
    };
    tabs.append(b);
  }
  const manage = text('button', '⚙ Nhóm & chủ đề', 'topic-customize');
  manage.onclick = () => openTopicHub(topics);
  tabs.append(manage);
  host.append(tabs);
  const values = activeTopic ? sections.get(activeTopic) || [] : [...groups.values()];
  for (const value of values) {
    const { a, g } = value.bindings.find((b) => b.a.enabled && b.g.enabled) || value.bindings[0];
    const row = text('div', undefined, 'topic-group-row'),
      info = text('div', undefined, 'grow');
    info.append(
      text('div', value.name, 'name'),
      text('div', value.bindings.map((b) => b.a.name).join(' · '), 'sub'),
    );
    const tags = text('div', undefined, 'topics');
    for (const tag of [...new Set(groupTopics(g).map((t) => topicLabel(t, state.topicSettings)))])
      tags.append(text('span', tag, 'topic'));
    info.append(tags);
    const edit = text('button', 'Sửa', 'edit');
    edit.onclick = () => openGroupEditor(a, g);
    const scan = text('button', 'Quét', 'edit');
    scan.onclick = () => act(() => openScan(a, g));
    row.append(info, edit, scan);
    host.append(row);
  }
  if (!values.length)
    host.append(
      text(
        'p',
        activeTopic
          ? 'Chưa có nhóm trong chủ đề này. Bấm Sửa ở nhóm để gán chủ đề.'
          : 'Chưa có nhóm. Chuyển Theo tài khoản để kết nối và chọn nhóm.',
        'empty',
      ),
    );
}

let topicEditing = null;
function topicNameMode(name = null) {
  topicEditing = name;
  $('#topicNameLabel').textContent = name ? 'Đổi tên “' + name + '”' : 'Thêm chủ đề mới';
  $('#topicNameInput').value = name || '';
  $('#saveTopicName').textContent = name ? 'Lưu tên' : 'Thêm';
  $('#cancelTopicEdit').hidden = !name;
  $('#topicNameError').textContent = '';
}
function openTopicManager(topics) {
  topicNameMode();
  const list = $('#topicManagerList');
  list.replaceChildren();
  for (const name of topics) {
    const row = text('div', undefined, 'topic-manager-row');
    row.append(text('span', name, 'grow'));
    const edit = text('button', '✎', 'topic-pencil');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Đổi tên ' + name);
    edit.onclick = () => {
      topicNameMode(name);
      $('#topicNameInput').focus();
    };
    row.append(edit);
    list.append(row);
  }
  if (!topics.length)
    list.append(text('p', 'Chưa có chủ đề. Thêm tên đầu tiên bên dưới.', 'muted'));
  if (!$('#topicManager').open) $('#topicManager').showModal();
}
$('#closeTopicManager').onclick = () => $('#topicManager').close();
$('#cancelTopicEdit').onclick = () => topicNameMode();
$('#addTopicForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    try {
      const name = e.target.elements.namedItem('name').value.trim();
      if (!name) throw Error('Nhập tên chủ đề.');
      const value = JSON.parse(JSON.stringify(state.topicSettings));
      if (topicEditing) {
        const old = topicEditing;
        for (const [key, label] of Object.entries(value.aliases))
          if (label === old) value.aliases[key] = name;
        value.aliases[old] = name;
        value.custom = value.custom.map((t) => (t === old ? name : t));
      } else value.custom = [...new Set([...value.custom, name])];
      await request('/api/topics', value);
      activeTopic = name;
      await refresh();
      $('#topicManager').close();
    } catch (error) {
      $('#topicNameError').textContent = error.message;
      throw error;
    }
  });
};

let topicGroupDraft = new Set(),
  topicGroupOptions = [];
function openTopicGroups(topics) {
  const choices = [...new Set(topics)].filter((t) => t !== 'Chưa phân loại');
  if (!choices.length) {
    $('#notice').textContent = 'Mở Quản lý chủ đề để thêm một chủ đề trước.';
    return;
  }
  const map = new Map();
  for (const a of state.accounts.filter((a) => a.platform === current))
    for (const g of a.groups) {
      if (!map.has(g.group_id)) map.set(g.group_id, { a, g, accounts: [] });
      map.get(g.group_id).accounts.push(a.name);
    }
  topicGroupOptions = [...map.values()];
  const select = $('#topicGroupsForm [name=topic]');
  select.replaceChildren();
  for (const t of choices) {
    const option = text('option', t);
    option.value = t;
    select.append(option);
  }
  select.value = choices.includes(activeTopic) ? activeTopic : choices[0];
  $('#topicGroupSearch').value = '';
  $('#topicGroupError').textContent = '';
  resetTopicGroupDraft();
  if (!$('#topicManager').open) $('#topicManager').showModal();
}
function resetTopicGroupDraft() {
  const topic = $('#topicGroupsForm [name=topic]').value;
  topicGroupDraft = new Set(
    topicGroupOptions
      .filter((x) =>
        groupTopics(x.g)
          .map((t) => topicLabel(t, state.topicSettings))
          .includes(topic),
      )
      .map((x) => x.g.group_id),
  );
  renderTopicGroupChoices();
}
function renderTopicGroupChoices() {
  const q = $('#topicGroupSearch').value.toLocaleLowerCase('vi'),
    host = $('#topicGroupChoices');
  host.replaceChildren();
  for (const x of topicGroupOptions.filter((x) =>
    (x.g.name + ' ' + x.accounts.join(' ')).toLocaleLowerCase('vi').includes(q),
  )) {
    const row = text('label', undefined, 'group-choice'),
      check = text('input');
    check.type = 'checkbox';
    check.checked = topicGroupDraft.has(x.g.group_id);
    check.onchange = () => {
      if (check.checked) topicGroupDraft.add(x.g.group_id);
      else topicGroupDraft.delete(x.g.group_id);
      updateAssignmentUI();
    };
    const body = text('div');
    body.append(text('div', x.g.name, 'name'), text('div', x.accounts.join(' · '), 'sub'));
    row.append(check, body);
    host.append(row);
  }
  if (!host.children.length) host.append(text('p', 'Không có nhóm phù hợp.', 'empty'));
  updateAssignmentUI();
}
$('#topicGroupsForm [name=topic]').onchange = resetTopicGroupDraft;
$('#topicGroupSearch').oninput = renderTopicGroupChoices;
$('#topicGroupsForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    try {
      const topic = e.target.elements.namedItem('topic').value;
      await request('/api/topics/groups', {
        platform: current,
        topic,
        groupIds: [...topicGroupDraft],
      });
      activeTopic = topic;
      await refresh();
      $('#topicManager').close();
    } catch (error) {
      $('#topicGroupError').textContent = error.message;
      throw error;
    }
  });
};

let hubTopicNames = [];
function showHubTab(name) {
  $('#hubGroupPanel').hidden = name !== 'groups';
  $('#hubTopicPanel').hidden = name !== 'topics';
  $('#hubGroups').classList.toggle('active', name === 'groups');
  $('#hubTopics').classList.toggle('active', name === 'topics');
}
function openTopicHub(topics) {
  hubTopicNames = topics;
  openTopicManager(topics);
  $('#hubGroups').disabled = !topics.some((t) => t !== 'Chưa phân loại');
  if (topics.some((t) => t !== 'Chưa phân loại')) {
    openTopicGroups(topics);
    showHubTab('groups');
  } else showHubTab('topics');
}
$('#hubGroups').onclick = () => showHubTab('groups');
$('#hubTopics').onclick = () => showHubTab('topics');

function updateAssignmentUI() {
  const topic = $('#topicGroupsForm [name=topic]').value;
  $('#assignmentTitle').textContent = topic || 'Chọn nhóm';
  $('#assignmentTotal').textContent = topicGroupOptions.length + ' nhóm trong ứng dụng';
  $('#assignmentSelected').textContent = 'Đã chọn ' + topicGroupDraft.size + ' nhóm';
  const host = $('#topicSideList');
  host.replaceChildren();
  for (const option of $('#topicGroupsForm [name=topic]').options) {
    const button = text('button', undefined, option.value === topic ? 'active' : '');
    button.type = 'button';
    button.append(text('span', option.textContent));
    if (option.value === topic) button.append(text('small', String(topicGroupDraft.size)));
    button.onclick = () => {
      $('#topicGroupsForm [name=topic]').value = option.value;
      resetTopicGroupDraft();
    };
    host.append(button);
  }
}
$('#selectVisibleTopicGroups').onclick = () => {
  for (const row of $('#topicGroupChoices').querySelectorAll('input')) {
    row.checked = true;
    row.dispatchEvent(new Event('change'));
  }
  updateAssignmentUI();
};
$('#clearVisibleTopicGroups').onclick = () => {
  for (const row of $('#topicGroupChoices').querySelectorAll('input')) {
    row.checked = false;
    row.dispatchEvent(new Event('change'));
  }
  updateAssignmentUI();
};

function chosenSendDays() {
  return [...document.querySelectorAll('#weekdayButtons button[aria-pressed="true"]')].map((b) =>
    Number(b.dataset.day),
  );
}
function updateWeekdayHint() {
  const days = chosenSendDays();
  $('#weekdayHint').textContent =
    days.length === 7
      ? 'Nhận mỗi ngày'
      : !days.length
        ? 'Đã tắt gửi tự động. App vẫn nhận và lưu tin.'
        : 'Nhận vào ' + days.map((d) => (d === 7 ? 'Chủ nhật' : 'Thứ ' + (d + 1))).join(', ');
}
function renderSendDays(days) {
  const host = $('#weekdayButtons');
  host.replaceChildren();
  for (let day = 1; day <= 7; day++) {
    const button = text('button', day === 7 ? 'CN' : 'T' + (day + 1));
    button.type = 'button';
    button.dataset.day = day;
    button.setAttribute('aria-label', day === 7 ? 'Chủ nhật' : 'Thứ ' + (day + 1));
    button.setAttribute('aria-pressed', String(days.includes(day)));
    button.onclick = () => {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
      updateWeekdayHint();
    };
    host.append(button);
  }
  updateWeekdayHint();
}

function openDiscord(id) {
  activeId = id;
  $('#discordConfigStatus').textContent = state.discordConfigured
    ? 'Công cụ đã được cấu hình; quyền truy cập chỉ được xác nhận khi lấy tin thành công.'
    : 'Cần cấu hình DISCORD_EXPORTER_PATH và DISCORD_TOKEN trong .env trên máy. Không dán token vào link kênh.';
  $('#discordChannels').replaceChildren();
  $('#saveDiscordChannels').hidden = true;
  $('#discordPickerStatus').textContent = '';
  $('#discordDialog').showModal();
}
$('#loadDiscordGuilds').onclick = () =>
  act(async () => {
    $('#discordPickerStatus').textContent = 'Đang hỏi Discord…';
    try {
      const guilds = await request('/api/discord/guilds');
      $('#discordGuild').replaceChildren(
        text('option', 'Chọn server', undefined),
        ...guilds.map((g) => Object.assign(text('option', g.name), { value: g.id })),
      );
      $('#discordGuild').firstChild.value = '';
      $('#discordPickerStatus').textContent =
        guilds.length + ' server. Chọn một server để xem kênh.';
    } catch (e) {
      $('#discordPickerStatus').textContent = e.message;
      throw e;
    }
  });
$('#discordGuild').onchange = (e) =>
  act(async () => {
    const host = $('#discordChannels');
    host.replaceChildren();
    $('#saveDiscordChannels').hidden = true;
    if (!e.target.value) return;
    $('#discordPickerStatus').textContent = 'Đang tải kênh…';
    const channels = await request('/api/discord/guilds/' + e.target.value + '/channels');
    const followed = new Set(
      state.accounts.find((a) => a.id === activeId)?.groups.map((g) => g.group_id) || [],
    );
    for (const c of channels) {
      const label = text('label', undefined, 'group-choice'),
        check = text('input');
      check.type = 'checkbox';
      check.value = c.id;
      check.checked = followed.has(c.id);
      label.append(check, text('span', c.name, 'grow'));
      host.append(label);
    }
    $('#saveDiscordChannels').hidden = !channels.length;
    $('#discordPickerStatus').textContent = channels.length
      ? 'Tick kênh muốn theo dõi rồi bấm Lưu.'
      : 'Server này không có kênh chữ tài khoản xem được.';
  });
$('#saveDiscordChannels').onclick = () =>
  act(async () => {
    const ids = [...$('#discordChannels').querySelectorAll('input:checked')].map((c) => c.value);
    await request('/api/discord/' + activeId + '/guilds/' + $('#discordGuild').value, { ids });
    $('#discordPickerStatus').textContent = 'Đã lưu ' + ids.length + ' kênh của server này.';
    await refresh();
  });
function renderDiscordAccounts(host) {
  host.append(
    text(
      'p',
      'Lấy tin ngày hôm trước trước giờ gửi, không đọc liên tục. Chọn kênh từ danh sách server; thread cần thêm bằng link.',
      'muted',
    ),
  );
  for (const a of state.accounts.filter((a) => a.platform === 'Discord')) {
    const box = text('div', undefined, 'account'),
      head = text('div', undefined, 'accounthead');
    head.append(
      text('strong', a.name, 'grow'),
      text(
        'span',
        a.status === 'sync_failed'
          ? 'Lấy tin thất bại'
          : a.status === 'syncing'
            ? 'Đang lấy tin'
            : a.status === 'connected'
              ? 'Lần lấy gần nhất thành công'
              : 'Chưa lấy tin',
        'muted',
      ),
    );
    box.append(head);
    for (const g of a.groups) {
      const row = text('div', undefined, 'group'),
        check = text('input');
      check.type = 'checkbox';
      check.checked = !!g.enabled;
      check.onchange = () =>
        act(async () => {
          await request('/api/accounts/' + a.id + '/group', {
            groupId: g.group_id,
            instructions: g.instructions,
            enabled: check.checked,
          });
          await refresh();
        });
      const edit = text('button', 'Sửa', 'edit');
      edit.onclick = () => openGroupEditor(a, g);
      row.append(check, text('span', g.name, 'grow'), edit);
      box.append(row);
    }
    const add = text('button', '+ Chọn kênh theo dõi', 'secondary');
    add.onclick = () => openDiscord(a.id);
    const sync = text('button', 'Lấy tin hôm qua', 'secondary');
    sync.disabled = state.discordBusy;
    sync.onclick = () =>
      act(async () => {
        sync.disabled = true;
        try {
          const r = await request('/api/discord/sync', {});
          $('#notice').textContent = 'Đã lưu ' + r.count + ' tin Discord mới';
        } finally {
          await refresh();
        }
      });
    box.append(add, sync);
    host.append(box);
  }
  if (!host.querySelector('.account'))
    host.append(text('p', 'Bấm Thêm tài khoản và chọn Discord.', 'empty'));
}
$('#discordChannelForm').onsubmit = (e) => {
  e.preventDefault();
  act(async () => {
    await request('/api/discord/' + activeId + '/channel', {
      name: e.target.elements.namedItem('name').value,
      link: e.target.elements.namedItem('link').value,
    });
    e.target.reset();
    $('#discordDialog').close();
    await refresh();
  });
};

async function loadTelegramConfig() {
  const data = await request('/api/telegram/config');
  $('#telegramChatInput').value = data.chatId;
  $('#telegramTokenInput').value = '';
  $('#telegramConfigStatus').textContent = data.needsRestart
    ? 'Đã lưu. Khởi động lại app trên máy chạy bot để áp dụng lịch gửi; có thể Gửi thử ngay.'
    : data.configured
      ? 'Đã có cấu hình. Bấm Gửi thử để xác nhận bot nhắn được.'
      : 'Chưa cấu hình Telegram.';
}
$('#saveTelegramConfig').onclick = () =>
  act(async () => {
    await request('/api/telegram/config', {
      token: $('#telegramTokenInput').value.trim(),
      chatId: $('#telegramChatInput').value.trim(),
    });
    $('#telegramTokenInput').value = '';
    await loadTelegramConfig();
  });
$('#testSavedTelegram').onclick = () =>
  act(async () => {
    const button = $('#testSavedTelegram');
    button.disabled = true;
    try {
      if ($('#telegramTokenInput').value.trim()) throw Error('Lưu kết nối trước khi gửi thử.');
      await request('/api/telegram/config/test', {});
      $('#telegramConfigStatus').textContent =
        'Telegram đã chấp nhận tin gửi thử. Mở bot để kiểm tra. Cấu hình mới cần khởi động lại app để áp dụng lịch.';
    } finally {
      button.disabled = false;
    }
  });

const AI_PRESETS = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    inputPrice: 0,
    outputPrice: 0,
    interval: 6000,
    hint: 'Lấy khóa miễn phí ở aistudio.google.com/apikey. Gói miễn phí giới hạn số lần gọi mỗi phút/ngày; app tự chờ giữa các lần gọi. Google có thể dùng nội dung gói miễn phí để cải thiện sản phẩm.',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    inputPrice: '',
    outputPrice: '',
    interval: 0,
    hint: 'Lấy khóa ở platform.openai.com/api-keys (cần nạp tiền). Điền giá theo trang giá của OpenAI để app chặn đúng trần chi phí.',
  },
  custom: { hint: 'Nhập địa chỉ API, model và giá theo tài liệu nhà cung cấp.' },
};
function presetFor(baseUrl) {
  if (baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (baseUrl.startsWith('https://api.openai.com')) return 'openai';
  return baseUrl ? 'custom' : 'gemini';
}
function applyPreset(name, fill) {
  const p = AI_PRESETS[name];
  $('#aiPresetHint').textContent = p.hint;
  if (!fill || name === 'custom') return;
  $('#aiBaseInput').value = p.baseUrl;
  $('#aiInputPrice').value = p.inputPrice;
  $('#aiOutputPrice').value = p.outputPrice;
  $('#aiInterval').value = p.interval;
}
async function loadAIConfig() {
  const data = await request('/api/ai/config');
  const preset = presetFor(data.baseUrl);
  $('#aiPreset').value = preset;
  $('#aiKeyInput').value = '';
  $('#aiModelInput').value = data.model;
  $('#aiBaseInput').value = data.baseUrl;
  $('#aiInputPrice').value = data.inputPrice;
  $('#aiOutputPrice').value = data.outputPrice;
  $('#aiInterval').value = data.interval;
  applyPreset(preset, !data.baseUrl);
  $('#aiConfigStatus').textContent = !data.hasKey
    ? 'Chưa có khóa AI.'
    : data.source === 'env'
      ? 'Đang dùng khóa trong file .env. Lưu ở đây sẽ thay thế cấu hình đó.'
      : 'Đã lưu khóa AI. Bấm Kiểm tra AI để thử một lần gọi.';
}
$('#aiPreset').onchange = (e) => applyPreset(e.target.value, true);
$('#saveAIConfig').onclick = () =>
  act(async () => {
    await request('/api/ai/config', {
      key: $('#aiKeyInput').value.trim(),
      model: $('#aiModelInput').value.trim(),
      baseUrl: $('#aiBaseInput').value.trim(),
      inputPrice: $('#aiInputPrice').value.trim() || 0,
      outputPrice: $('#aiOutputPrice').value.trim() || 0,
      interval: $('#aiInterval').value.trim() || 0,
    });
    await loadAIConfig();
    $('#aiConfigStatus').textContent = 'Đã lưu. Áp dụng ngay, không cần khởi động lại.';
  });
$('#testAIConfig').onclick = () =>
  act(async () => {
    const button = $('#testAIConfig');
    button.disabled = true;
    $('#aiConfigStatus').textContent = 'Đang gọi thử AI…';
    try {
      if ($('#aiKeyInput').value.trim()) throw Error('Lưu AI trước khi kiểm tra.');
      await request('/api/ai/config/test', {});
      $('#aiConfigStatus').textContent = 'AI trả lời đúng định dạng. Có thể tạo bản tin.';
    } catch (e) {
      $('#aiConfigStatus').textContent = e.message;
      throw e;
    } finally {
      button.disabled = false;
    }
  });
