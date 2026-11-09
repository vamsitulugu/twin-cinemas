// Run: node tests/watch-sync.test.mjs   (no install needed; three.js, supabase, the DOM and the Twin Hearts server are stubbed)
// Tests the theatre's playback engine (src/watch.js) = the Twin Hearts movie page rules: shared room, shared clock, numbered actions, buffering hold, drift correction.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws-'));
let code=fs.readFileSync(new URL('../src/watch.js',import.meta.url),'utf8')
 .replace("import * as THREE from 'three';","const THREE={VideoTexture:class{dispose(){}},SRGBColorSpace:'srgb'};")
 .replace("import {createClient} from '@supabase/supabase-js';","const createClient=()=>{throw new Error('no realtime in tests')};")
 .replace("import.meta.env||{}","{}");
fs.writeFileSync(path.join(dir,'watch.mjs'),code);
let clock=1_000_000;                                   // ms; one fake wall clock for Date.now and performance.now
Date.now=()=>clock;globalThis.performance={now:()=>clock};
class FakeVideo{constructor(){this.listeners={};this.paused=true;this.seeking=false;this.readyState=4;this.currentTime=0;this.duration=100;this.playbackRate=1;this._src='';this.error=null;this.buffered={length:0};this.ended=false}
 addEventListener(n,f){(this.listeners[n]??=[]).push(f)}emit(n){(this.listeners[n]||[]).forEach(f=>f())}
 set src(x){this._src=x;this.readyState=0;setTimeout(()=>{if(this.failNext){this.error={code:this.failNext};this.failNext=0;this.onerror?.();this.emit('error')}else if(!this.hang){this.readyState=4;this.onloadedmetadata?.()}},0)}get src(){return this._src}
 removeAttribute(){this._src=''}load(){}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
globalThis.document={createElement:()=>new FakeVideo(),body:{appendChild(){}},hidden:false,visibilityState:'visible',addEventListener(){},removeEventListener(){}};
globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
globalThis.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
// the Twin Hearts server, reduced to the rules that matter (routes/routes-movie.js): one row, numbered actions, anchor = client timestamp
let row,calls;const newRow=o=>({status:'ready',playing:false,position_sec:0,updated_at:new Date(clock).toISOString(),action_seq:0,updated_by:null,...o});
globalThis.fetch=async(url,o={})=>{calls.push((o.method||'GET')+' '+url.replace(/^https?:\/\/[^/]+/,''));const j=x=>({ok:true,json:async()=>x});
 if(url.endsWith('/api/movie/time'))return j({now:clock+2000});                      // the server clock is 2 s ahead
 if(o.method==='PATCH'){const b=JSON.parse(o.body);if(!(b.actionSeq>row.action_seq))return j({...row,server_now:clock});
  row={...row,playing:!!b.playing,position_sec:b.positionSec,action_seq:b.actionSeq,status:'watching',updated_by:b.role,updated_at:new Date(Math.min(b.clientTs,clock+2000)).toISOString()};return j(row)}
 if(o.method==='POST')return j({...row,status:'ended'});
 return j(row)};
const {Watch}=await import(path.join(dir,'watch.mjs'));
let n=0;const t=(name,fn)=>Promise.resolve().then(fn).then(()=>{n++;console.log('ok  -',name)},e=>{console.log('FAIL-',name,'\n',e.stack.split('\n').slice(0,3).join('\n'));process.exitCode=1});
const iso=(ms=0)=>new Date(clock+2000+ms).toISOString();         // a timestamp on the shared (server) clock
const mk=async(role='user1',opts={})=>{row=newRow(opts.row||{});calls=[];const w=new Watch({api:'https://api',couple:'c1',role});await w.loadUrl('https://cdn/x.mp4','x');await w.syncClock(1);w.rm=row;w.live=true;w.v.paused=false;w.v.currentTime=10;return w};
const tick=()=>new Promise(r=>setTimeout(r,0));

await t('shared clock: offset to the server is learned (server 2 s ahead)',async()=>{const w=await mk();assert.equal(Math.round(w.off),2000);assert.equal(w.now(),clock+2000)});
await t('expected position = position_sec + time since updated_at (shared clock)',async()=>{const w=await mk();w.rm={playing:true,position_sec:30,updated_at:iso(-5000)};assert.equal(Math.round(w.expected()),35);w.rm.playing=false;assert.equal(w.expected(),30)});
await t('play action: PATCH /state carries role, position and the shared-clock timestamp; room becomes watching',async()=>{const w=await mk();await w.act(true,12);const c=calls.find(x=>x.startsWith('PATCH'));assert.ok(c.endsWith('/api/movie/c1/state'));assert.equal(row.playing,true);assert.equal(row.position_sec,12);assert.equal(row.updated_by,'user1');assert.equal(row.status,'watching')});
await t('my own action is the local room truth immediately (follow() cannot undo it)',async()=>{const w=await mk();w.pause();const p=w.act(true,10);assert.equal(w.rm.playing,true);w.follow();assert.equal(w.v.paused,false);await p});
await t('server holds a NEWER action number (partner clock ahead): my action is re-sent after it',async()=>{const w=await mk();row.action_seq=Date.now()+50000;row.status='watching';await w.act(false,20);assert.equal(row.playing,false);assert.equal(row.position_sec,20)});
await t('partner pauses: this video pauses and seeks to the paused position',async()=>{const w=await mk('user2');w._remote({actionSeq:5,playing:false,positionSec:42,updated_at:iso(),updated_by:'user1'});assert.equal(w.v.paused,true);assert.equal(w.v.currentTime,42)});
await t('partner plays at 30 s five seconds ago: this video jumps to ~35 s and plays',async()=>{const w=await mk('user2');w.v.paused=true;w._remote({actionSeq:6,playing:true,positionSec:30,updated_at:iso(-5000),updated_by:'user1'});assert.equal(w.v.paused,false);assert.ok(Math.abs(w.v.currentTime-35)<.01)});
await t('stale / out-of-order actions are ignored',async()=>{const w=await mk('user2');w._remote({actionSeq:10,playing:false,positionSec:50,updated_at:iso(),updated_by:'user1'});w._remote({actionSeq:9,playing:true,positionSec:1,updated_at:iso(),updated_by:'user1'});assert.equal(w.v.paused,true);assert.equal(w.v.currentTime,50)});
await t('remote change is kept but not applied while the scene is not live (door / hall / seated)',async()=>{const w=await mk('user2');w.live=false;w._remote({actionSeq:7,playing:false,positionSec:77,updated_at:iso(),updated_by:'user1'});assert.equal(w.v.currentTime,10);w.live=true;w.follow();assert.equal(w.v.currentTime,77)});
await t('onremote tells the scene who did what, with the reason (buffering vs pause)',async()=>{const w=await mk('user2');let got;w.onremote=x=>got=x;w._remote({actionSeq:8,playing:false,positionSec:5,updated_at:iso(),updated_by:'user1',reason:'buffering'});assert.deepEqual(got,{playing:false,reason:'buffering',by:'user1'})});
await t('polling (Android partner writes only to the server): a newer row by the partner is applied',async()=>{const w=await mk('user2');row={...row,status:'watching',playing:false,position_sec:61,action_seq:20,updated_by:'user1',updated_at:iso()};await w._poll();assert.equal(w.v.paused,true);assert.equal(w.v.currentTime,61)});
await t('polling ignores my own writes',async()=>{const w=await mk('user1');row={...row,status:'watching',playing:false,position_sec:61,action_seq:20,updated_by:'user1',updated_at:iso()};await w._poll();assert.equal(w.v.currentTime,10)});
await t('drift 0.5 s -> speed nudge, no seek (room playing)',async()=>{const w=await mk();w.lastSeek=0;w.rm={playing:true,position_sec:10.5,updated_at:iso()};w._drift();assert.equal(w.v.currentTime,10);assert.equal(w.v.playbackRate,1.05)});
await t('video ahead by 0.5 s -> slows down',async()=>{const w=await mk();w.rm={playing:true,position_sec:9.5,updated_at:iso()};w._drift();assert.equal(w.v.playbackRate,.95)});
await t('tiny drift (<0.4 s) resets the speed to 1',async()=>{const w=await mk();w.v.playbackRate=1.05;w.rm={playing:true,position_sec:10.1,updated_at:iso()};w._drift();assert.equal(w.v.playbackRate,1)});
await t('big drift (3 s) -> one hard seek; then 4 s cooldown (no seek thrash)',async()=>{const w=await mk();w.rm={playing:true,position_sec:13,updated_at:iso()};w._drift();assert.equal(w.v.currentTime,13);w.rm={playing:true,position_sec:30,updated_at:iso()};clock+=1000;w._drift();assert.equal(w.v.currentTime,13);clock+=4000;w.rm={playing:true,position_sec:30,updated_at:iso()};w._drift();assert.ok(w.v.currentTime>=30)});
await t('no drift correction while buffering, seeking, suspended (ad break) or not live',async()=>{const w=await mk();w.rm={playing:true,position_sec:50,updated_at:iso()};w.v.readyState=1;w._drift();assert.equal(w.v.currentTime,10);w.v.readyState=4;w.v.seeking=true;w._drift();assert.equal(w.v.currentTime,10);w.v.seeking=false;w.suspend=true;w._drift();assert.equal(w.v.currentTime,10);w.suspend=false;w.live=false;w._drift();assert.equal(w.v.currentTime,10)});
await t('room is playing but this video stopped (autoplay blocked): it is kicked, not in a tight loop',async()=>{const w=await mk();w.v.paused=true;w.rm={playing:true,position_sec:10,updated_at:iso()};w._drift();assert.equal(w.v.paused,false)});
await t('stall for 1.5 s while the room plays -> pause and tell the partner "buffering"',async()=>{const w=await mk();w.rm={...row,playing:true};w.v.readyState=1;w._waiting();await new Promise(r=>setTimeout(r,1600));assert.equal(w.hold,true);assert.equal(w.v.paused,true);await tick();assert.equal(row.playing,false)});
await t('after buffering and nobody else acted: I resume it and the room plays again (reason resume)',async()=>{const w=await mk();w._hold();await tick();await tick();w.v.readyState=4;w._recovered(true);await tick();await tick();assert.equal(w.hold,false);assert.equal(w.v.paused,false);assert.equal(row.playing,true)});
await t('after buffering but the partner acted meanwhile: just follow the room',async()=>{const w=await mk('user2');w._hold();await tick();w._remote({actionSeq:Date.now()+9,playing:false,positionSec:33,updated_at:iso(),updated_by:'user1'});assert.equal(w.hold,false);w._recovered(true);assert.equal(w.v.paused,true);assert.equal(w.v.currentTime,33)});
await t('ad break: remote changes wait (suspend) and follow() applies them after',async()=>{const w=await mk('user2');w.suspend=true;w._remote({actionSeq:30,playing:false,positionSec:80,updated_at:iso(),updated_by:'user1'});assert.equal(w.v.currentTime,10);w.suspend=false;w.follow();assert.equal(w.v.currentTime,80)});
await t("my own play / pause goes to the room; while the partner's change is being applied it does not echo back",async()=>{const w=await mk();await w.send(false);assert.equal(row.playing,false);w.applying=true;calls.length=0;assert.equal(w.send(true),0);assert.equal(calls.length,0)});
await t('finish (End) posts the session end with title and duration, like the movie page',async()=>{const w=await mk();let body;const f=fetch;globalThis.fetch=async(u,o)=>{if(o?.method==='POST'&&u.endsWith('/end'))body=JSON.parse(o.body);return f(u,o)};await w.finish('Dune');globalThis.fetch=f;assert.equal(body.movieTitle,'Dune');assert.equal(body.role,'user1');assert.equal(body.durationSec,100)});
await t('Sync button: reads the room, jumps to its position, keeps playing',async()=>{const w=await mk();row={...row,status:'watching',playing:true,position_sec:70,updated_at:iso(),action_seq:1};await w.resync();assert.ok(Math.abs(w.v.currentTime-70)<.01);assert.equal(w.v.paused,false)});
await t('local mode (cinema opened on its own): no network, no sync, demo clock works',async()=>{calls=[];const w=new Watch({});assert.equal(w.sync,false);await w.connect();assert.equal(await w.act(true,1),0);assert.equal(calls.length,0);w.play();w.tick(5);assert.equal(w.time,5);w.seek(40);assert.equal(w.time,30)});
await t('load error gives a friendly message (unsupported format)',async()=>{const w=new Watch({});w.v.failNext=4;await assert.rejects(w.loadUrl('u'),/MP4 \(H\.264/);assert.equal(w.src,false)});
await t('load timeout after 30 s (metadata never arrives)',async()=>{const w=new Watch({});w.v.hang=true;const real=globalThis.setTimeout;globalThis.setTimeout=(f,ms)=>real(f,ms===30000?5:ms);try{await assert.rejects(w.loadUrl('u'),/too long/)}finally{globalThis.setTimeout=real}});
await t('cloud movie error mid-way: reloads with a fresh signed URL at the same second and keeps playing',async()=>{const w=await mk();w.onrefresh=async()=>'https://cdn/fresh.mp4';w.v.currentTime=42;w.v.emit('timeupdate');w.v.paused=false;w.v.failNext=2;
 const done=new Promise(r=>{const o=w.v.play.bind(w.v);w.v.play=()=>{r();return o()}});w.v.src=w.v.src;await Promise.race([done,new Promise((_,j)=>setTimeout(()=>j(new Error('no recovery')),500))]);assert.equal(w.url,'https://cdn/fresh.mp4');assert.ok(Math.abs(w.v.currentTime-42)<.01)});
console.log(n+' passed');
