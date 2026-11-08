import * as THREE from 'three';
/** One movie, two sources: a local video file, or a 30 s demo clock (so every flow works without a file). Same API either way.
 *  Sync-safety rules (shared with the Watch Together page / Android app):
 *   - drift is fixed by a gentle speed nudge (>0.4 s); only drift over 1.5 s causes a hard seek, and at most one every 4 s
 *   - no correction at all while the video is buffering / seeking (that was the "stuck" thrash)
 *   - loading has a 30 s timeout and friendly errors; a cloud movie that errors mid-way is reloaded at the same time */
const LOAD_MS=30000,COOLDOWN=4000,NUDGE=.4,HARD=1.5;
const ERR={1:'Loading the movie was interrupted',2:'Network problem while loading the movie — check your connection',3:'This video could not be decoded — use an MP4 (H.264 + AAC) copy',4:'This video format is not supported here — use an MP4 (H.264 + AAC) copy'};
export class Movie{
 constructor(){this.v=document.createElement('video');Object.assign(this.v,{playsInline:true,preload:'auto',className:'hv'});document.body.appendChild(this.v);
  this.tex=null;this.src=false;this.meta=null;this.demo={t:0,playing:false,dur:30};this.onend=null;this.onblocked=null;
  this.onfail=null;this.onrefresh=null;           // onfail(message): unrecoverable error · onrefresh(): async -> a fresh cloud URL (or null)
  this.url=null;this.loading=false;this.lastSeek=0;this.lastGood=0;this.recov=0;this.recAt=0;
  this.v.addEventListener('ended',()=>this.onend?.());
  this.v.addEventListener('timeupdate',()=>{if(!this.v.seeking&&!this.loading)this.lastGood=this.v.currentTime});
  this.v.addEventListener('playing',()=>{if(performance.now()-this.recAt>20000)this.recov=0});
  this.v.addEventListener('error',()=>this._err())}
 /** resolves when metadata is loaded; rejects after 30 s or with a readable message */
 _ready(){const v=this.v;return new Promise((res,rej)=>{let done=false;
   const fin=f=>x=>{if(done)return;done=true;clearTimeout(t);v.onloadedmetadata=v.onerror=null;f(x)},
    t=setTimeout(()=>fin(rej)(new Error('The movie took too long to load — check your connection and try again')),LOAD_MS);
   v.onloadedmetadata=fin(res);v.onerror=()=>fin(rej)(new Error(ERR[v.error?.code]||'Cannot play this file'))})}
 _free(){if(this.v.src&&this.v.src.startsWith('blob:'))URL.revokeObjectURL(this.v.src)}
 _bad(){this.loading=false;this.src=false;this.url=null;this.v.removeAttribute('src');try{this.v.load()}catch(e){}}
 _tex(){this.tex?.dispose();this.tex=new THREE.VideoTexture(this.v);this.tex.colorSpace=THREE.SRGBColorSpace;this.src=true;this.lastGood=0;this.recov=0}
 /** play a movie straight from a (signed) URL — used for Twin Hearts cloud movies. The movie host must allow CORS (see CINEMA_FLOW.md). */
 async loadUrl(url,name='Movie'){this._free();this.src=false;this.loading=true;this.v.crossOrigin='anonymous';this.v.src=url;
  try{await this._ready()}catch(e){this._bad();throw e}
  this.loading=false;this.url=url;this._tex();
  return this.meta={name,size:0,dur:Math.round(this.v.duration)}}
 async load(file){this._free();this.src=false;this.loading=true;this.v.removeAttribute('crossorigin');this.v.src=URL.createObjectURL(file);
  try{await this._ready()}catch(e){this._free();this._bad();throw e}
  this.loading=false;this.url=null;this._tex();
  return this.meta={name:file.name,size:file.size,dur:Math.round(this.v.duration)}}
 /** a movie that errors while playing: a cloud link is reloaded (fresh signed URL if the app can give one) and put back at the same time, up to 3 times */
 async _err(){const v=this.v;if(!this.src||this.loading)return;const msg=ERR[v.error?.code]||'The video stopped working';
  if(!this.url||this.recov>=3){this.onfail?.(msg);return}
  this.recov++;this.recAt=performance.now();const t=this.lastGood,was=!v.paused;this.loading=true;
  try{const u=(await this.onrefresh?.())||this.url;this.url=u;v.src=u;await this._ready();this.loading=false;v.currentTime=Math.min(t,(v.duration||t)-.5);if(was)this.play()}
  catch(e){this.loading=false;this.onfail?.(e.message||msg)}}
 get time(){return this.src?this.v.currentTime:this.demo.t}
 get dur(){return(this.src?this.v.duration:this.demo.dur)||0}
 get playing(){return this.src?!this.v.paused&&!this.v.ended:this.demo.playing}
 /** false while the video is waiting for data (buffering / seeking). Always true for the demo clock. */
 get ready(){return !this.src||(!this.loading&&this.v.readyState>=3&&!this.v.seeking)}
 get aspect(){return this.src&&this.v.videoHeight?this.v.videoWidth/this.v.videoHeight:0}
 get muted(){return this.v.muted}set muted(x){this.v.muted=x}
 play(){if(this.src){this.v.play()?.catch(e=>{if(e&&e.name==='NotAllowedError')this.onblocked?.()})}else this.demo.playing=true}   // AbortError (pause during play) is normal, not "blocked"
 pause(){this.src?this.v.pause():this.demo.playing=false}
 seek(t){t=Math.max(0,Math.min(t,this.dur||0));this.lastSeek=performance.now();if(this.src){this.v.playbackRate=1;this.v.currentTime=t}else this.demo.t=t}
 tick(dt){if(!this.src&&this.demo.playing){this.demo.t+=dt;if(this.demo.t>=this.demo.dur){this.demo.t=this.demo.dur;this.demo.playing=false;this.onend?.()}}}
 /** drift correction against the host clock: speed nudge when close, rare hard seek when far, nothing while buffering */
 correct(vt){if(!this.src){if(Math.abs(vt-this.demo.t)>1.2)this.demo.t=vt;return}
  const v=this.v;if(this.loading||v.paused||v.seeking||v.readyState<3)return;
  const d=vt-v.currentTime,a=Math.abs(d);
  if(a>HARD){if(performance.now()-this.lastSeek>COOLDOWN)this.seek(vt)}
  else if(a>NUDGE)v.playbackRate=d>0?1.05:.95;
  else if(a<.15&&v.playbackRate!==1)v.playbackRate=1}}
export const fmt=s=>{s=Math.max(0,s|0);return`${s/60|0}:${String(s%60).padStart(2,'0')}`};
