// Run: node tests/video-sync.test.mjs   (no install needed; three.js and the DOM are stubbed)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vs-'));
let code=fs.readFileSync(new URL('../src/video.js',import.meta.url),'utf8').replace("import * as THREE from 'three';","const THREE={VideoTexture:class{dispose(){}},SRGBColorSpace:'srgb'};");
fs.writeFileSync(path.join(dir,'video.mjs'),code);
let now=0;globalThis.performance={now:()=>now};
class FakeVideo{constructor(){this.listeners={};this.paused=true;this.seeking=false;this.readyState=4;this.currentTime=0;this.duration=100;this.playbackRate=1;this._src='';this.error=null;this.style={};this.attrs={}}
 addEventListener(n,f){(this.listeners[n]??=[]).push(f)}emit(n){(this.listeners[n]||[]).forEach(f=>f())}
 set src(x){this._src=x;this.readyState=0;setTimeout(()=>{if(this.failNext){this.error={code:this.failNext};this.failNext=0;this.onerror?.();this.emit('error')}else if(!this.hang){this.readyState=4;this.onloadedmetadata?.()}},0)}get src(){return this._src}
 removeAttribute(){this._src=''}load(){}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
globalThis.document={createElement:()=>new FakeVideo(),body:{appendChild(){}}};
globalThis.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
const {Movie}=await import(path.join(dir,'video.mjs'));
let n=0;const t=(name,fn)=>fn().then(()=>{n++;console.log('ok  -',name)},e=>{console.log('FAIL-',name,'\n',e.message);process.exitCode=1});
const mk=async()=>{const m=new Movie();await m.loadUrl('https://cdn/x.mp4','x');m.v.paused=false;m.v.currentTime=10;return m};

await t('small drift (0.5 s) -> speed nudge, no seek',async()=>{const m=await mk();now=10000;m.correct(10.5);assert.equal(m.v.currentTime,10);assert.equal(m.v.playbackRate,1.05)});
await t('behind by 0.5 s while partner ahead/behind -> slows down when ahead',async()=>{const m=await mk();m.correct(9.5);assert.equal(m.v.playbackRate,.95)});
await t('tiny drift (<0.15 s) resets speed to 1',async()=>{const m=await mk();m.v.playbackRate=1.05;m.correct(10.1);assert.equal(m.v.playbackRate,1)});
await t('big drift (3 s) -> one hard seek',async()=>{const m=await mk();now=20000;m.correct(13);assert.equal(m.v.currentTime,13)});
await t('4 s cooldown after a hard seek (no seek thrash)',async()=>{const m=await mk();now=30000;m.correct(13);m.v.currentTime=13;now=31000;m.correct(20);assert.equal(m.v.currentTime,13);now=35000;m.correct(20);assert.equal(m.v.currentTime,20)});
await t('no correction while buffering (readyState<3)',async()=>{const m=await mk();now=40000;m.v.readyState=1;m.correct(50);assert.equal(m.v.currentTime,10)});
await t('no correction while seeking',async()=>{const m=await mk();now=50000;m.v.seeking=true;m.correct(50);assert.equal(m.v.currentTime,10)});
await t('no correction while paused',async()=>{const m=await mk();now=60000;m.v.paused=true;m.correct(50);assert.equal(m.v.currentTime,10)});
await t('ready is false while buffering / seeking, true otherwise',async()=>{const m=await mk();assert.equal(m.ready,true);m.v.readyState=2;assert.equal(m.ready,false);m.v.readyState=4;m.v.seeking=true;assert.equal(m.ready,false)});
await t('demo clock: ready always true, correct() adjusts',async()=>{const m=new Movie();assert.equal(m.ready,true);m.correct(5);assert.equal(m.demo.t,5)});
await t('load error gives a friendly message (unsupported format)',async()=>{const m=new Movie();m.v.failNext=4;await assert.rejects(m.loadUrl('u'),/MP4 \(H\.264/);assert.equal(m.src,false)});
await t('load timeout after 30 s (metadata never arrives)',async()=>{const m=new Movie();m.v.hang=true;const realST=globalThis.setTimeout;globalThis.setTimeout=(f,ms)=>realST(f,ms===30000?5:ms);try{await assert.rejects(m.loadUrl('u'),/too long/)}finally{globalThis.setTimeout=realST}});
await t('cloud movie error mid-way: reloads with fresh URL at the same time and keeps playing',async()=>{const m=await mk();m.onrefresh=async()=>'https://cdn/fresh.mp4';m.v.currentTime=42;m.v.emit('timeupdate');m.v.paused=false;m.v.failNext=2;
  const done=new Promise(r=>{const o=m.v.play.bind(m.v);m.v.play=()=>{r();return o()}});m.v.src=m.v.src;                         // trigger the fake error path
  await Promise.race([done,new Promise((_,j)=>setTimeout(()=>j(new Error('no recovery')),500))]);assert.equal(m.url,'https://cdn/fresh.mp4');assert.ok(Math.abs(m.v.currentTime-42)<.01)});
await t('local file error mid-way: reports, does not loop',async()=>{const m=new Movie();await m.load({name:'a.mp4',size:1});let msg='';m.onfail=x=>msg=x;m.v.error={code:3};m.v.emit('error');await new Promise(r=>setTimeout(r,5));assert.match(msg,/decoded/)});
console.log(n+' passed');
