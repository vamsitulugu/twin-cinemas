import * as THREE from 'three';
/** One movie, two sources: a local video file, or a 30 s demo clock (so every flow works without a file). Same API either way. */
export class Movie{
 constructor(){this.v=document.createElement('video');Object.assign(this.v,{playsInline:true,preload:'auto',className:'hv'});document.body.appendChild(this.v);
  this.tex=null;this.src=false;this.meta=null;this.demo={t:0,playing:false,dur:30};this.onend=null;this.onblocked=null;
  this.v.addEventListener('ended',()=>this.onend?.())}
 async load(file){if(this.v.src)URL.revokeObjectURL(this.v.src);this.v.src=URL.createObjectURL(file);
  await new Promise((r,j)=>{this.v.onloadedmetadata=r;this.v.onerror=()=>j(new Error('Cannot play this file'))});
  this.tex?.dispose();this.tex=new THREE.VideoTexture(this.v);this.tex.colorSpace=THREE.SRGBColorSpace;this.src=true;
  return this.meta={name:file.name,size:file.size,dur:Math.round(this.v.duration)}}
 get time(){return this.src?this.v.currentTime:this.demo.t}
 get dur(){return(this.src?this.v.duration:this.demo.dur)||0}
 get playing(){return this.src?!this.v.paused&&!this.v.ended:this.demo.playing}
 get aspect(){return this.src&&this.v.videoHeight?this.v.videoWidth/this.v.videoHeight:0}
 get muted(){return this.v.muted}set muted(x){this.v.muted=x}
 play(){if(this.src){this.v.play()?.catch(()=>this.onblocked?.())}else this.demo.playing=true}
 pause(){this.src?this.v.pause():this.demo.playing=false}
 seek(t){t=Math.max(0,Math.min(t,this.dur||0));this.src?this.v.currentTime=t:this.demo.t=t}
 tick(dt){if(!this.src&&this.demo.playing){this.demo.t+=dt;if(this.demo.t>=this.demo.dur){this.demo.t=this.demo.dur;this.demo.playing=false;this.onend?.()}}}
 /** drift correction against the host clock: hard seek if far off, gentle speed nudge if close */
 correct(vt){const d=vt-this.time;if(Math.abs(d)>1.2)this.seek(vt);else if(this.src)this.v.playbackRate=Math.abs(d)>.25?(d>0?1.04:.96):1}}
export const fmt=s=>{s=Math.max(0,s|0);return`${s/60|0}:${String(s%60).padStart(2,'0')}`};
