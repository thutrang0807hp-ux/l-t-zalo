import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MockApi,installMock} from '../demo/mock-api.mjs';
const now=()=>Date.parse('2026-11-12T07:00:00Z');
const make=()=>new MockApi({now});
test('report, source and bookmark use the original API shape',()=>{
 const api=make(),r=api.handle('POST','/api/reports',{day:'2026-11-11'});
 assert.equal(r.items.length,6);assert.equal(r.highlights.length,5);
 for(const item of r.items)for(const ref of item.refs)assert.ok(api.handle('GET','/api/sources/'+ref).content.startsWith('[TIN MẪU]'));
 api.handle('POST','/api/bookmarks',{reportId:r.id,itemId:r.items[0].id});
 assert.equal(api.handle('GET','/api/state').bookmarks.length,1);
 api.handle('DELETE','/api/bookmarks/'+r.items[0].id);assert.equal(api.state.bookmarks.length,0);
});
test('quick/deep instructions and selected groups remain in the original workflow',()=>{
 const api=make();api.handle('POST','/api/accounts/account-sample/group',{groupId:'g-video',mode:'deep',instructions:'Lấy mẹo dựng phim',enabled:false});
 const g=api.state.accounts[0].groups[0];assert.equal(g.mode,'deep');assert.equal(g.instructions,'Lấy mẹo dựng phim');
 assert.ok(!api.handle('POST','/api/reports',{day:'2026-11-11'}).items.some(i=>i.groupId==='g-video'));
});
test('Telegram is a separate delivery step and does not create another AI report',()=>{
 const api=make(),r=api.state.report,count=api.reports.length;api.handle('POST','/api/reports/'+r.id+'/send',{});
 assert.equal(api.reports.length,count);assert.equal(api.delivery.length,1);assert.equal(api.delivery[0].simulated,true);
 assert.match(api.events[0],/Không gọi Bot API/);
});
test('schedule respects enabled days and prevents a repeated simulated send',()=>{
 const api=make();api.handle('POST','/api/settings',{hour:'07:45',sendDays:[],retention:30});assert.equal(api.tick().skipped,true);
 api.handle('POST','/api/settings',{hour:'07:45',sendDays:[4],retention:30});api.tick();assert.equal(api.delivery.length,1);assert.equal(api.tick().skipped,true);assert.equal(api.delivery.length,1);
});
test('scan reuses local sample sources, keeps query and can send without replacing daily report',()=>{
 const api=make(),before=api.state.report.id,body={accountId:'account-sample',groupId:'g-video',from:'2026-11-10',to:'2026-11-11',query:'proxy',send:true};
 assert.equal(api.handle('POST','/api/scans/preview',body).count,1);
 const scan=api.handle('POST','/api/scans',body);assert.equal(scan.scan.query,'proxy');assert.equal(scan.items.length,1);assert.equal(api.state.report.id,before);assert.equal(api.delivery.length,1);
 assert.throws(()=>api.handle('POST','/api/scans',{...body,from:'2026-01-01'}),/90 ngày/);
});
test('preview does not store API keys or bot tokens',()=>{
 const api=make();api.handle('POST','/api/ai/config',{key:'SECRET-DO-NOT-STORE',model:'demo',baseUrl:'https://example.invalid/v1',inputPrice:0,outputPrice:0,interval:0});
 api.handle('POST','/api/telegram/config',{token:'SECRET-TOKEN-DO-NOT-STORE',chatId:'chat-mau'});
 assert.ok(!JSON.stringify(api).includes('SECRET'));
});
test('preview fetch cannot forward an unknown API to a real server',async()=>{
 const api=make();let network=0;const target={location:{href:'https://preview.invalid/'},fetch:async()=>{network++;},dispatchEvent(){},Event:class{}};installMock(api,target);
 const response=await target.fetch('/api/unknown',{method:'POST',body:'{}'});assert.equal(response.status,400);assert.equal(network,0);
 const state=await(await target.fetch('/api/state')).json();assert.equal(state.accounts.length,1);
});
