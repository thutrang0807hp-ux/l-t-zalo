import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedMessages,filterMessages,conversations} from '../demo-model.mjs';
const now=Date.parse('2026-11-12T07:00:00Z');
test('groups and saved views reflect message source and enabled groups',()=>{
 const messages=seedMessages(now);
 assert.equal(conversations(filterMessages(messages,{},now)).length,6);
 assert.equal(filterMessages(messages,{savedOnly:true,saved:['resources']},now).length,3);
 assert.equal(filterMessages(messages,{enabledGroups:[]},now).length,0);
 assert.ok(filterMessages(messages,{category:'Công việc'},now).every(x=>['project','jobs'].includes(x.group)));
});
test('search normalizes Vietnamese accents and applies all terms',()=>{
 const messages=seedMessages(now);
 assert.equal(filterMessages(messages,{query:'HOANG MINH proxy'},now).length,1);
 assert.equal(filterMessages(messages,{query:'proxy khong-co-tu-nay'},now).length,0);
});
test('date filters and seven-day retention use Bangkok calendar days',()=>{
 const messages=seedMessages(now);
 assert.equal(filterMessages(messages,{period:'yesterday'},now).length,2);
 assert.equal(filterMessages(messages,{period:'today'},now).length,10);
 assert.equal(filterMessages([...messages,{...messages[0],time:now-8*86400000}],{},now).length,messages.length);
});
