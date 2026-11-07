import * as THREE from 'three';
const {Vector3}=THREE,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
/** One camera, many shots. Modes: door, follow, seat, orbit (free 360), screen, couple, full. Every switch is a smooth spring blend. */
export class CameraRig{
 constructor(cam,dom,{onManual}={}){Object.assign(this,{cam,mode:'door',yaw:0,pitch:.55,dist:4,k:3,onManual,moved:0,dragging:false,ctx:{me:new Vector3(),couple:new Vector3(),lobbyY:1.9}});
  this.D=new Vector3();this.L=new Vector3();this.look=new Vector3(0,2,7);let last=null;
  dom.addEventListener('pointerdown',e=>{last=[e.clientX,e.clientY];this.moved=0;this.dragging=true});
  addEventListener('pointerup',()=>{this.dragging=false;last=null});
  dom.addEventListener('pointermove',e=>{if(!last)return;const dx=e.clientX-last[0],dy=e.clientY-last[1];last=[e.clientX,e.clientY];this.moved+=Math.abs(dx)+Math.abs(dy);if(this.moved<8||['door','full'].includes(this.mode))return;
   if(this.mode==='screen'||this.mode==='couple'){this.dist=4.5;this.pitch=.35;onManual?.()}this.yaw-=dx*.006;this.pitch=cl(this.pitch+dy*.004,-.05,1.3)});
  dom.addEventListener('wheel',e=>{this.dist=cl(this.dist+e.deltaY*.004,2,9)},{passive:true})}
 /** returns true if the last pointer gesture was a tap rather than a drag */
 get wasTap(){return this.moved<6}
 setMode(m,o={}){this.mode=m;if(o.yaw!==undefined)this.yaw=o.yaw;if(o.pitch!==undefined)this.pitch=o.pitch;if(o.dist!==undefined)this.dist=o.dist}
 pose(t){const c=this.ctx,m=this.mode;this.k=3;
  if(m==='door'){this.D.set(0,c.lobbyY+1.55,12.4);this.L.set(0,c.lobbyY+1.4,7.4)}
  else if(m==='screen'){this.D.set(c.couple.x+Math.sin(t*.25)*.12,c.couple.y+2,Math.min(7.1,c.couple.z+1.5));this.L.set(0,3.3,-10);this.k=1.6}
  else if(m==='couple'){this.D.set(c.couple.x+.4,c.couple.y+1.8,c.couple.z-3.6);this.L.set(c.couple.x,c.couple.y+1.05,c.couple.z);this.k=1.8}
  else if(m==='full'){this.D.set(0,3.4,-4.8);this.L.set(0,3.4,-10.3);this.k=2.5}
  else{const tg=(m==='orbit'?c.couple:c.me),cp=Math.cos(this.pitch);this.L.set(tg.x,tg.y+1.2,tg.z);
   this.D.set(Math.sin(this.yaw)*cp,Math.sin(this.pitch),Math.cos(this.yaw)*cp).multiplyScalar(this.dist).add(this.L);
   this.D.set(cl(this.D.x,-4.6,4.6),cl(this.D.y,.6,6.6),cl(this.D.z,-9.3,7.25));this.k=9}}
 update(dt,t){this.pose(t);this.cam.position.lerp(this.D,1-Math.exp(-dt*this.k));this.look.lerp(this.L,1-Math.exp(-dt*Math.min(this.k,4)));this.cam.lookAt(this.look)}}
