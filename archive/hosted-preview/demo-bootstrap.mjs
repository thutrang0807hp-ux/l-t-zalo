import {MockApi,installMock} from './mock-api.mjs';
const api=new MockApi();installMock(api);
const qr='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="140"><rect width="300" height="140" rx="12" fill="#f0eafa"/><text x="150" y="57" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#7561df">MÔ PHỎNG</text><text x="150" y="90" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#8d7c9f">Không có QR hay đăng nhập Zalo thật</text></svg>';
window.__demoQrSvg='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr);
function log(){const host=document.querySelector('#demoEvents');host.replaceChildren(...api.events.map(message=>{const li=document.createElement('li');li.textContent=message;return li;}));}
window.addEventListener('nhatin-demo-update',log);log();
for(const id of ['aiKeyInput','telegramTokenInput']){const field=document.getElementById(id);field.disabled=true;field.placeholder='Bản mô phỏng không nhận khóa/token thật';}
const loginButton=document.createElement('button');loginButton.type='button';loginButton.className='primary';loginButton.textContent='Xác nhận tài khoản MẪU (không đăng nhập thật)';loginButton.onclick=()=>{try{api.confirmLogin();log();loginButton.textContent='Đã xác nhận mẫu · chờ giao diện cập nhật';}catch(e){document.getElementById('qrStatus').textContent=e.message;}};document.getElementById('connectDialog').append(loginButton);
document.getElementById('demoTick').onclick=()=>{api.tick();log();};
document.getElementById('demoReset').onclick=()=>{if(confirm('Đặt lại toàn bộ dữ liệu mô phỏng? Không tác động tới repo hay tài khoản thật.'))location.reload();};
for(const id of ['notice','qrStatus','aiConfigStatus','telegramConfigStatus']){
 const element=document.getElementById(id);
 const label=()=>{if(element.textContent.trim()&&!element.textContent.startsWith('[MÔ PHỎNG]'))element.textContent='[MÔ PHỎNG] '+element.textContent;};
 new MutationObserver(label).observe(element,{childList:true,subtree:true,characterData:true});label();
}
await import('./app.js');
