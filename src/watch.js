import * as THREE from 'three';
import {createClient} from '@supabase/supabase-js';
/** Movie playback + sync for the theatre screen. This is the Twin Hearts MOVIE PAGE engine (us-app/public/movie.js), not a second system:
 *   - ONE room per couple on the Twin Hearts server (/api/movie/:couple). It holds: playing, position_sec, updated_at, action_seq.
 *     Every device derives the same position:  expected = position_sec + (sharedClock - updated_at)
 *   - one shared clock (GET /api/movie/time, lowest-round-trip sample), refreshed every 45 s
 *   - every play / pause / seek is a numbered action: broadcast on the realtime channel `watch_together:<couple>` AND written with PATCH /state
 *     (the Android app only polls the server, so the room is also polled every 2 s)
 *   - stalls: if MY video cannot keep up, both of us pause until it can ("buffering" action), instead of drifting apart
 *   - drift: reads only; speed nudge ±5 % when 0.4–1.5 s off, one hard seek when further, never within 4 s of a seek
 *   - cloud movie: a signed URL; on an error a fresh URL is fetched and the movie goes back to the same second
 * The surface used by the rest of the theatre (time, dur, playing, ready, play, pause, seek, tex ...) is the same as before.
 * Without a Twin Hearts room (cinema opened on its own) it is a plain local player: no sync. */
const env=import.meta.env||{},SB_URL=env.VITE_SUPABASE_URL,SB_KEY=env.VITE_SUPABASE_ANON_KEY;
const LOAD_MS=30000,STALL_MS=1500,NUDGE=.4,HARD=1.5,COOLDOWN=4000,POLL_MS=2000,DRIFT_MS=1000,CLOCK_MS=45000;
const ERR={1:'Loading the movie was interrupted',2:'Network problem while loading the movie — check your connection',3:'This video could not be decoded — use an MP4 (H.264 + AAC) copy',4:'This video format is not supported here — use an MP4 (H.264 + AAC) copy'};
export class Watch{
 /** o = {api, couple, role:'user1'|'user2'} — leave out for a local-only player */
 constructor(o={}){
  this.api=o.api||'';this.couple=o.couple||'';this.role=o.role||'';
  this.sync=!!(this.api&&this.couple&&/^user[12]$/.test(this.role));
  this.v=document.createElement('video');Object.assign(this.v,{playsInline:true,preload:'auto',className:'hv'});document.body.appendChild(this.v);
  this.tex=null;this.src=false;this.meta=null;this.demo={t:0,playing:false,dur:30};this.url=null;this.loading=false;
  this.onend=null;this.onblocked=null;this.onfail=null;this.onrefresh=null;    // onfail(message) · onrefresh(): async -> a fresh cloud URL (or null)
  this.onremote=null;this.onstatus=null;                                        // onremote({playing,reason,by}): the partner played / paused / sought · onstatus(text|''): "partner is loading…"
  this.live=false;this.suspend=false;                                           // live: the scene is watching / paused / on a break · suspend: an ad break is running
  this.rm=null;this.lastSeq=0;this.off=0;this.hold=false;this.holdSince=0;this.bufSeq=0;this.lastSeek=0;this.lastGood=0;this.recov=0;this.recAt=0;this.kick=0;this.applying=false;
  this.stalled=false;this.stallT=0;this.ch=null;this.sb=null;this.busy=false;this.timers=[];this.closed=false;
  const v=this.v;
  v.addEventListener('ended',()=>this.onend?.());
  v.addEventListener('timeupdate',()=>{if(!v.seeking&&!this.loading)this.lastGood=v.currentTime});
  v.addEventListener('playing',()=>{if(performance.now()-this.recAt>20000)this.recov=0;this._recovered()});
  v.addEventListener('canplay',()=>this._recovered());v.addEventListener('canplaythrough',()=>this._recovered());
  v.addEventListener('waiting',()=>this._waiting());v.addEventListener('stalled',()=>this._waiting());
  v.addEventListener('error',()=>this._err())}
 /* ---------- the movie file ---------- */
 _ready(){const v=this.v;return new Promise((res,rej)=>{let done=false;
   const fin=f=>x=>{if(done)return;done=true;clearTimeout(t);v.onloadedmetadata=v.onerror=null;f(x)},
    t=setTimeout(()=>fin(rej)(new Error('The movie took too long to load — check your connection and try again')),LOAD_MS);
   v.onloadedmetadata=fin(res);v.onerror=()=>fin(rej)(new Error(ERR[v.error?.code]||'Cannot play this file'))})}
 _free(){if(this.v.src&&this.v.src.startsWith('blob:'))URL.revokeObjectURL(this.v.src)}
 _bad(){this.loading=false;this.src=false;this.url=null;this.v.removeAttribute('src');try{this.v.load()}catch(e){}}
 _tex(){this.tex?.dispose();this.tex=new THREE.VideoTexture(this.v);this.tex.colorSpace=THREE.SRGBColorSpace;this.src=true;this.lastGood=0;this.recov=0}
 /** a movie from the shared cloud (signed URL) or the Android app's own stream. The host must allow CORS (see CINEMA_FLOW.md). */
 async loadUrl(url,name='Movie'){this._free();this.src=false;this.loading=true;this.v.crossOrigin='anonymous';this.v.src=url;
  try{await this._ready()}catch(e){this._bad();throw e}
  this.loading=false;this.url=url;this._tex();
  return this.meta={name,size:0,dur:Math.round(this.v.duration)}}
 /** a movie file from this device (the one picked on the Watch Together page) */
 async load(file){this._free();this.src=false;this.loading=true;this.v.removeAttribute('crossorigin');this.v.src=URL.createObjectURL(file);
  try{await this._ready()}catch(e){this._free();this._bad();throw e}
  this.loading=false;this.url=null;this._tex();
  return this.meta={name:file.name,size:file.size,dur:Math.round(this.v.duration)}}
 /** a movie that errors while playing: a cloud link is reloaded (fresh signed URL) and put back at the same time, up to 3 times */
 async _err(){const v=this.v;if(!this.src||this.loading)return;const msg=ERR[v.error?.code]||'The video stopped working';
  if(!this.url||this.recov>=3){this.onfail?.(msg);return}
  this.recov++;this.recAt=performance.now();const t=this.lastGood,was=!v.paused;this.loading=true;this.onstatus?.('Reconnecting video…');
  try{const u=(await this.onrefresh?.())||this.url;this.url=u;v.src=u;await this._ready();this.loading=false;this.onstatus?.('');v.currentTime=Math.min(t,(v.duration||t)-.5);if(was)this.play()}
  catch(e){this.loading=false;this.onstatus?.('');this.onfail?.(e.message||msg)}}
 /* ---------- local primitives (what the theatre scene and the ad breaks call) ---------- */
 get time(){return this.src?this.v.currentTime:this.demo.t}
 get dur(){return(this.src?this.v.duration:this.demo.dur)||0}
 get playing(){return this.src?!this.v.paused&&!this.v.ended:this.demo.playing}
 /** false while the video is waiting for data (buffering / seeking). Always true for the demo clock. */
 get ready(){return !this.src||(!this.loading&&this.v.readyState>=3&&!this.v.seeking)}
 get aspect(){return this.src&&this.v.videoHeight?this.v.videoWidth/this.v.videoHeight:0}
 get muted(){return this.v.muted}set muted(x){this.v.muted=x}
 play(){if(this.src){this.v.play()?.catch(e=>{if(e&&e.name==='NotAllowedError')this.onblocked?.()})}else this.demo.playing=true}   // AbortError (pause during play) is normal, not "blocked"
 pause(){this.src?this.v.pause():this.demo.playing=false}
 seek(t){t=Math.max(0,Math.min(t,this.dur||t||0));this.lastSeek=Date.now();if(this.src){this.v.playbackRate=1;this.v.currentTime=t}else this.demo.t=t}
 tick(dt){if(!this.src&&this.demo.playing){this.demo.t+=dt;if(this.demo.t>=this.demo.dur){this.demo.t=this.demo.dur;this.demo.playing=false;this.onend?.()}}}
 /* ---------- the shared clock ---------- */
 now(){return Date.now()+this.off}
 async _clockOnce(){const t0=Date.now();let r;try{r=await fetch(this.api+'/api/movie/time',{cache:'no-store'})}catch(e){return null}
  const t1=Date.now();let b;try{b=await r.json()}catch(e){return null}if(!b||typeof b.now!=='number')return null;
  return{offset:(b.now+(t1-t0)/2)-t1,rtt:t1-t0}}
 async syncClock(n=3){let best=null;for(let i=0;i<n;i++){const s=await this._clockOnce();if(s&&(!best||s.rtt<best.rtt))best=s}if(best)this.off=best.offset;return!!best}
 /* ---------- the room ---------- */
 async _req(method,path,body){const o={method,headers:{'Content-Type':'application/json'}};if(body)o.body=JSON.stringify(body);
  const r=await fetch(this.api+'/api/movie/'+this.couple+path,o),d=await r.json().catch(()=>null);if(!r.ok)throw new Error((d&&d.error)||'Request failed');return d}
 /** a countdown whose start time has passed is a movie that started at that exact moment (the server does the same) */
 _settle(r){if(r&&r.status==='countdown'&&r.scheduled_start_at&&this.now()>=new Date(r.scheduled_start_at).getTime())
   return{...r,status:'watching',playing:true,position_sec:0,playback_rate:1,updated_at:r.scheduled_start_at,action_seq:(r.action_seq||0)+1};return r}
 expected(r=this.rm){if(!r)return this.time;if(!r.playing)return r.position_sec||0;return(r.position_sec||0)+Math.max(0,(this.now()-new Date(r.updated_at).getTime())/1000)}
 async connect(){if(!this.sync||this.closed)return;
  this.syncClock(3);
  try{const r=await this._req('GET','');if(r){this.rm=this._settle(r);this.lastSeq=Math.max(this.lastSeq,r.action_seq||0)}}catch(e){}
  if(SB_URL&&SB_KEY){try{this.sb=createClient(SB_URL,SB_KEY);
    this.ch=this.sb.channel('watch_together:'+this.couple,{config:{broadcast:{self:false},presence:{key:this.role}}})
     .on('broadcast',{event:'wt_state'},m=>this._remote(m.payload)).subscribe()}catch(e){this.ch=null}}
  const every=(f,ms)=>this.timers.push(setInterval(f,ms));
  every(()=>this._poll(),POLL_MS);every(()=>this._drift(),DRIFT_MS);every(()=>{if(!document.hidden)this.syncClock(3)},CLOCK_MS);
  this._wake=()=>{if(document.visibilityState!=='hidden')this.reconcile()};
  addEventListener('online',this._wake);addEventListener('focus',this._wake);addEventListener('pageshow',this._wake);document.addEventListener('visibilitychange',this._wake)}
 close(){this.closed=true;this.timers.forEach(clearInterval);this.timers=[];
  if(this._wake){removeEventListener('online',this._wake);removeEventListener('focus',this._wake);removeEventListener('pageshow',this._wake);document.removeEventListener('visibilitychange',this._wake)}
  try{if(this.ch&&this.sb)this.sb.removeChannel(this.ch)}catch(e){}this.ch=null}
 _seq(){return this.lastSeq=Math.max(this.lastSeq+1,Date.now())}
 /** send play / pause / seek. pos = where THIS video is right now, stamped with the shared clock so the partner's position is exact. */
 async act(playing,pos,reason,retry){if(!this.sync)return 0;
  const seq=this._seq();if(reason==='buffering')this.bufSeq=seq;
  const ts=Math.round(this.now()),p={role:this.role,playing,positionSec:pos,actionSeq:seq,updated_at:new Date(ts).toISOString(),updated_by:this.role,reason:reason||null};
  this.rm={...(this.rm||{}),status:'watching',playing,position_sec:pos,updated_at:p.updated_at,updated_by:this.role,action_seq:seq};   // my own action is the room's truth right away
  try{this.ch?.send({type:'broadcast',event:'wt_state',payload:p})}catch(e){}
  try{const row=await this._req('PATCH','/state',{role:this.role,playing,positionSec:pos,actionSeq:seq,clientTs:ts});
   if(row&&row.action_seq>seq&&!retry&&row.status==='watching'){this.lastSeq=Math.max(this.lastSeq,row.action_seq);return this.act(playing,pos,reason,true)}   // the other phone's clock runs ahead: send again, numbered after it
   if(row){this.rm=this._settle(row);this.lastSeq=Math.max(this.lastSeq,row.action_seq||0)}}
  catch(e){/* the broadcast may still have arrived; the poll / reconnect reconciles */}
  return seq}
 /** the partner (web: broadcast, Android: poll) played / paused / sought */
 _remote(p){if(!p||p.actionSeq<=this.lastSeq)return;this.lastSeq=p.actionSeq;
  this.rm={...(this.rm||{}),status:'watching',playing:p.playing,position_sec:p.positionSec,updated_at:p.updated_at,updated_by:p.updated_by,action_seq:p.actionSeq};
  if(this.hold)this.hold=false;                                 // the partner took over: follow the room, do not fight it
  if(!this.live||this.suspend)return;                           // kept; follow() applies it when the scene (or the ad break) is over
  this.applying=true;const t=this.expected();
  if(Math.abs(this.time-t)>(p.playing?.6:.25))this.seek(t);
  p.playing?this.play():this.pause();setTimeout(()=>{this.applying=false},250);
  this.onstatus?.(p.playing?'':p.reason==='buffering'?'⏳ Your partner is loading…':'');
  this.onremote?.({playing:p.playing,reason:p.reason||null,by:p.updated_by})}
 async _poll(){if(this.busy||document.hidden||this.closed)return;this.busy=true;
  try{const r=await this._req('GET','');if(!r)return;
   if(r.status==='watching'&&r.action_seq>this.lastSeq&&r.updated_by&&r.updated_by!==this.role)
    this._remote({actionSeq:r.action_seq,playing:r.playing,positionSec:r.position_sec,updated_at:r.updated_at,updated_by:r.updated_by})}
  catch(e){}finally{this.busy=false}}
 /** back from a lost connection / a sleeping phone: read the room and go where it says */
 async reconcile(){if(!this.sync||this.closed)return;
  try{const r=await this._req('GET','');if(!r)return;this.rm=this._settle(r);if(r.action_seq>this.lastSeq)this.lastSeq=r.action_seq;if(this.live&&!this.hold&&!this.suspend)this.follow()}catch(e){}}
 /** bring this video to wherever the room says it should be (after a stall / reconnect / ad break / entering the scene) */
 follow(){const r=this.rm;if(!r||!this.live)return;const t=this.expected(r);
  if(Math.abs(this.time-t)>.6)this.seek(t);r.playing?this.play():this.pause()}
 /** the Sync button: read the authoritative room, jump to its position, never leave it paused */
 async resync(){if(!this.sync)return false;
  try{const r=await this._req('GET','');if(r)this.rm={...(this.rm||{}),...r}}catch(e){}
  const was=this.playing;this.seek(this.expected());if(this.src)this.v.playbackRate=1;if(was)this.play();return true}
 /** I pressed play / pause / seek (or the scene did): tell the room. Never while the partner's change is being applied. */
 send(playing,reason){if(this.applying)return 0;this.hold=false;return this.act(playing,this.time,reason)}
 /** ends the Twin Hearts session for both (writes the watch history, like the movie page's End) */
 finish(title){if(!this.sync)return Promise.resolve();
  return this._req('POST','/end',{role:this.role,movieTitle:title||this.meta?.name||'',durationSec:Math.round(this.dur||0),completedPct:this.dur?Math.min(100,Math.round(this.time/this.dur*100)):0,sessionKey:this.rm&&this.rm.scheduled_start_at,positionSec:Math.round(this.time||0)}).catch(()=>{})}
 /* ---------- stalls: pause BOTH of us until my video can keep up ---------- */
 _ahead(){const v=this.v;try{for(let i=0;i<v.buffered.length;i++)if(v.currentTime>=v.buffered.start(i)-.1&&v.currentTime<=v.buffered.end(i))return v.buffered.end(i)-v.currentTime}catch(e){}return 0}
 _videoReady(){const v=this.v;return v.readyState>=4||(v.readyState>=3&&this._ahead()>=2)}
 _waiting(){if(!this.sync||!this.live||this.suspend||this.hold||!this.src||this.v.ended)return;
  this.stalled=true;clearTimeout(this.stallT);
  this.stallT=setTimeout(()=>{if(!this.live||this.suspend||!this.stalled||this.hold)return;if(!this.rm||!this.rm.playing)return;if(this.v.readyState>=3){this.stalled=false;return}this._hold()},STALL_MS)}
 _hold(){this.hold=true;this.holdSince=Date.now();this.v.pause();this.onstatus?.('⏳ Loading — your partner will wait for you');this.act(false,this.v.currentTime,'buffering')}
 _recovered(force){this.stalled=false;clearTimeout(this.stallT);if(!this.hold)return;if(force!==true&&!this._videoReady())return;
  this.hold=false;this.onstatus?.('');
  if(this.lastSeq===this.bufSeq){this.play();this.act(true,this.v.currentTime,'resume')}   // nobody else acted while I was loading: I paused it, so I resume it — from where I am
  else this.follow()}                                                                     // the partner (or the server) changed things meanwhile: just follow the room
 /* ---------- drift: reads only, never writes to the server ---------- */
 _drift(){const v=this.v;if(!this.sync||!this.live||this.suspend||this.closed)return;
  if(this.hold){const held=Date.now()-this.holdSince;if(this._videoReady()||(v.readyState>=3&&held>4000))this._recovered(true);return}
  const r=this.rm;if(!r||!r.playing||this.applying||document.hidden)return;
  if(!this.src){const d=this.expected()-this.demo.t;if(Math.abs(d)>1.2)this.demo.t+=d;return}
  if(v.paused){if(!v.seeking&&v.readyState>=2&&Date.now()-this.kick>3000){this.kick=Date.now();this.follow()}return}   // the room is playing but this video is not: try again, not in a tight loop
  if(v.seeking||v.readyState<3||Date.now()-this.lastSeek<COOLDOWN)return;
  const d=this.expected()-v.currentTime,a=Math.abs(d);
  if(a<NUDGE){if(v.playbackRate!==1)v.playbackRate=1}
  else if(a<HARD)v.playbackRate=d>0?1.05:.95;
  else{v.playbackRate=1;this.seek(this.expected())}}}
export const fmt=s=>{s=Math.max(0,s|0);return`${s/60|0}:${String(s%60).padStart(2,'0')}`};
