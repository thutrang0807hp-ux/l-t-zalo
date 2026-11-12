// A small local date picker, including HTML previews that do not expose the native picker.
(() => {
  const vietnamDay = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let current = null,
    year,
    month,
    panel = null;
  const make = (tag, label, cls) => {
    const e = document.createElement(tag);
    if (label !== undefined) e.textContent = label;
    if (cls) e.className = cls;
    return e;
  };
  function close(focus = false) {
    if (!current) return;
    const input = current;
    input.setAttribute('aria-expanded', 'false');
    panel?.remove();
    panel = null;
    current = null;
    if (focus) input.focus();
  }
  function position() {
    if (!panel || !current) return;
    const rect = current.getBoundingClientRect(),
      width = Math.min(304, window.innerWidth - 24);
    panel.style.width = width + 'px';
    panel.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';
    const height = panel.getBoundingClientRect().height;
    panel.style.top =
      Math.max(12, Math.min(rect.bottom + 7, window.innerHeight - height - 12)) + 'px';
  }
  function render() {
    panel.replaceChildren();
    const header = make('div', undefined, 'calendar-header'),
      previous = make('button', '‹'),
      next = make('button', '›');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', 'Tháng trước');
    next.setAttribute('aria-label', 'Tháng sau');
    previous.onclick = () => {
      month--;
      if (month < 0) {
        month = 11;
        year--;
      }
      render();
    };
    next.onclick = () => {
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
      render();
    };
    header.append(previous, make('strong', 'Tháng ' + (month + 1) + ' / ' + year), next);
    panel.append(header);
    const week = make('div', undefined, 'calendar-week');
    for (const day of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) week.append(make('span', day));
    panel.append(week);
    const grid = make('div', undefined, 'calendar-grid');
    const offset = (new Date(year, month, 1).getDay() + 6) % 7,
      days = new Date(year, month + 1, 0).getDate(),
      today = vietnamDay();
    for (let i = 0; i < offset; i++) grid.append(make('span'));
    for (let day = 1; day <= days; day++) {
      const value = iso(year, month, day),
        button = make('button', String(day));
      button.type = 'button';
      button.setAttribute('aria-label', `Ngày ${day} tháng ${month + 1} năm ${year}`);
      button.setAttribute('aria-pressed', String(current.value === value));
      button.disabled = value > today;
      button.classList.toggle('selected', current.value === value);
      button.classList.toggle('today', value === today);
      button.onclick = () => {
        const input = current;
        input.value = value;
        close(true);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      grid.append(button);
    }
    panel.append(grid);
    const footer = make('div', undefined, 'calendar-footer'),
      now = make('button', 'Hôm nay'),
      done = make('button', 'Đóng');
    now.type = done.type = 'button';
    now.onclick = () => {
      const input = current;
      input.value = vietnamDay();
      close(true);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    done.onclick = () => close(true);
    footer.append(now, done);
    panel.append(footer);
    position();
  }
  function open(input) {
    if (current === input && panel) return;
    close();
    current = input;
    const value = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : vietnamDay();
    year = Number(value.slice(0, 4));
    month = Number(value.slice(5, 7)) - 1;
    panel = make('div', undefined, 'calendar-popover');
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chọn ngày');
    input.closest('dialog')?.append(panel);
    if (!panel.parentNode) document.body.append(panel);
    input.setAttribute('aria-expanded', 'true');
    render();
  }
  for (const input of document.querySelectorAll('input[data-calendar]')) {
    input.type = 'text';
    input.readOnly = true;
    input.placeholder = 'Chọn ngày';
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('aria-expanded', 'false');
    const wrap = make('div', undefined, 'calendar-field');
    input.before(wrap);
    wrap.append(input);
    const icon = make('button', '▦', 'calendar-trigger');
    icon.type = 'button';
    icon.setAttribute(
      'aria-label',
      input.name === 'from' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc',
    );
    icon.onclick = () => open(input);
    wrap.append(icon);
    input.onclick = () => open(input);
    input.onkeydown = (e) => {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        open(input);
      }
    };
  }
  document.addEventListener('click', (e) => {
    if (
      current &&
      !panel?.contains(e.target) &&
      !current.closest('.calendar-field').contains(e.target)
    )
      close();
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && current) {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      }
    },
    true,
  );
  document.addEventListener('close', () => close(), true);
  window.addEventListener('resize', position);
  document.addEventListener('scroll', position, true);
})();
