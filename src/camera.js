import * as THREE from 'three';
import {DOOR_Z,HALF,FRONT_Z,LW,LD,LH} from './hall.js';
const {Vector3}=THREE,cl=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
/** One camera, many shots. Modes: door, follow, seat, orbit (free 360), screen, couple, full.
    yaw/pitch/dist are what you ask for; vy/vp/vd are the smoothed values actually used (so drags glide and nothing snaps).
    Drag = free look all the way round (with inertia), wheel / two-finger pinch = zoom, orbit with {auto:true} slowly spins until you touch it. */
export class CameraRig{
 constructor(cam,dom,{onManual}={}){Object.assign(this,{cam,mode:'door',yaw:0,pitch:.55,dist:4,vy:0,vp:.55,vd:4,ks:3,k:3,yv:0,pv:0,idle:99,auto:false,_t:0,onManual,moved:0,dragging:false,ctx:{me:new Vector3(),couple:new Vector3(),lobbyY:1.9,lobby:false}});
  this.D=new Vector3();this.L=new Vector3();this.look=new Vector3(0,2,7);
  const ptrs=new Map(),pd=()=>{const a=[...ptrs.values()];return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])};let pinch=0;
  dom.addEventListener('pointerdown',e=>{ptrs.set(e.pointerId,[e.clientX,e.clientY]);this.idle=0;if(ptrs.size===1){this.moved=0;this.dragging=true;this.yv=this.pv=0;this._t=0}else if(ptrs.size===2)pinch=pd()});
  const up=e=>{ptrs.delete(e.pointerId);if(!ptrs.size){this.dragging=false;pinch=0}else if(ptrs.size===1)pinch=0};addEventListener('pointerup',up);addEventListener('pointercancel',up);
  dom.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;this.idle=0;
   if(ptrs.size>=2){const d=pd();if(pinch)this.dist=cl(this.dist-(d-pinch)*.012,2,9);pinch=d;this.moved+=99;return}
   this.moved+=Math.abs(dx)+Math.abs(dy);if(this.moved<8||['door','full'].includes(this.mode))return;
   if(this.mode==='screen'||this.mode==='couple'){this.dist=4.5;this.pitch=.35;onManual?.()}
   const ay=-dx*.0055,ap=dy*.0038;this.yaw+=ay;this.pitch=cl(this.pitch+ap,-.15,1.35);
   const now=performance.now(),dtm=this._t?Math.max(8,now-this._t):16;this._t=now;this.yv=this.yv*.4+ay/dtm*1000*.6;this.pv=this.pv*.4+ap/dtm*1000*.6});
  dom.addEventListener('wheel',e=>{this.dist=cl(this.dist+e.deltaY*.004,2,9);this.idle=0},{passive:true})}
 /** returns true if the last pointer gesture was a tap rather than a drag */
 get wasTap(){return this.moved<6}
 setMode(m,o={}){this.mode=m;if(o.yaw!==undefined)this.yaw=this.vy+wrap(o.yaw-this.vy);if(o.pitch!==undefined)this.pitch=o.pitch;if(o.dist!==undefined)this.dist=o.dist;this.auto=!!o.auto;this.yv=this.pv=0;this.idle=0}
 pose(t){const c=this.ctx,m=this.mode;this.k=3;
  if(m==='door'){this.D.set(0,c.lobbyY+1.55,DOOR_Z+4.9);this.L.set(0,c.lobbyY+1.4,DOOR_Z-.1)}
  else if(m==='screen'){this.D.set(c.couple.x+Math.sin(t*.25)*.12,c.couple.y+2,Math.min(DOOR_Z-.5,c.couple.z+1.5));this.L.set(0,3.4,FRONT_Z);this.k=1.6}
  else if(m==='couple'){this.D.set(c.couple.x+.4,c.couple.y+1.8,c.couple.z-3.6);this.L.set(c.couple.x,c.couple.y+1.05,c.couple.z);this.k=1.8}
  else if(m==='full'){this.D.set(0,3.4,-4.4);this.L.set(0,3.45,FRONT_Z);this.k=2.5}
  else{const tg=(m==='orbit'?c.couple:c.me),cp=Math.cos(this.vp);this.L.set(tg.x,tg.y+1.2,tg.z);
   this.D.set(Math.sin(this.vy)*cp,Math.sin(this.vp),Math.cos(this.vy)*cp).multiplyScalar(this.vd).add(this.L);
   if(c.lobby)this.D.set(cl(this.D.x,-LW+.5,LW-.5),cl(this.D.y,c.lobbyY+.7,c.lobbyY+LH-.5),cl(this.D.z,DOOR_Z+.5,DOOR_Z+LD-.5));
   else this.D.set(cl(this.D.x,-HALF+.4,HALF-.4),cl(this.D.y,.6,6.4),cl(this.D.z,FRONT_Z+1.2,DOOR_Z-.3));this.k=7}}
 update(dt,t){
  // inertia after you let go; stale velocity fades while the finger is held still
  if(this.dragging){const f=Math.exp(-dt*12);this.yv*=f;this.pv*=f}
  else if(['follow','seat','orbit'].includes(this.mode)&&(Math.abs(this.yv)>.01||Math.abs(this.pv)>.01)){this.yaw+=this.yv*dt;this.pitch=cl(this.pitch+this.pv*dt,-.15,1.35);const f=Math.exp(-dt*3.2);this.yv*=f;this.pv*=f}
  this.idle+=dt;if(this.auto&&this.mode==='orbit'&&!this.dragging&&this.idle>3)this.yaw+=dt*.3;       // gentle 360 spin
  this.vy=damp(this.vy,this.yaw,12,dt);this.vp=damp(this.vp,this.pitch,12,dt);this.vd=damp(this.vd,this.dist,8,dt);
  this.pose(t);this.ks=damp(this.ks,this.k,4,dt);                                                   // blend between shots instead of switching speed
  this.cam.position.lerp(this.D,1-Math.exp(-dt*this.ks));this.look.lerp(this.L,1-Math.exp(-dt*this.ks*1.1));this.cam.lookAt(this.look)}}
