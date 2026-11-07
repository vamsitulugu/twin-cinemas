import * as THREE from 'three';
import {floorY} from './hall.js';
const ease=u=>u*u*(3-2*u),tw=(ms,f)=>new Promise(r=>{const s=performance.now(),k=()=>{const u=Math.min(1,(performance.now()-s)/ms);f(ease(u));u<1?requestAnimationFrame(k):r()};k()});
/** A person in the hall (me, or the partner). Wraps an avatar; same API for local control and (Phase 3) network playback. */
const mkBucket=()=>{const b=new THREE.Group(),w=new THREE.MeshStandardMaterial({color:0xfff3c4,roughness:.9});b.add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.1,.22,16),new THREE.MeshStandardMaterial({color:0xd8283c,roughness:.6})));
 for(let i=0;i<10;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.06,8,8),w);s.position.set((Math.random()-.5)*.18,.14+Math.random()*.06,(Math.random()-.5)*.18);b.add(s)}b.position.set(0,.95,.42);b.visible=false;return b};
export class Player{
 constructor(av,color){this.bucket=mkBucket();av.group.add(this.bucket);this.popcorn=false;this.av=av;this.group=av.group;this.pos=av.group.position;this.script=null;this.seated=false;this.speed=2.2;this._mv=false;
  this.mark=new THREE.Mesh(new THREE.OctahedronGeometry(.1),new THREE.MeshBasicMaterial({color}));this.mark.scale.y=1.5;this.group.add(this.mark)}
 face(a,k=1){const g=this.group,d=Math.atan2(Math.sin(a-g.rotation.y),Math.cos(a-g.rotation.y));g.rotation.y+=d*k}
 walk(pts,speed=1.8){return new Promise(res=>{this.script={pts:[...pts],speed,res}})}
 move(dx,dz,dt,hall){const m=Math.hypot(dx,dz);if(m<.01)return false;this.pos.x+=dx/m*this.speed*dt;this.pos.z+=dz/m*this.speed*dt;hall.resolve(this.pos);this.face(Math.atan2(dx,dz),Math.min(1,dt*10));this._mv=true;return true}
 async sit(seat){this.seated=true;const g=this.group,z0=this.pos.z,r0=g.rotation.y,d=Math.atan2(Math.sin(Math.PI-r0),Math.cos(Math.PI-r0));
  await tw(900,e=>{g.rotation.y=r0+d*e;this.av.sit=e;this.pos.z=z0+(seat.z-z0)*e;this.pos.y=floorY(this.pos.z)})}
 async stand(seat){const z0=this.pos.z;await tw(800,e=>{this.av.sit=1-e;this.pos.z=z0+(seat.aisle.z-z0)*e;this.pos.y=floorY(this.pos.z)});this.seated=false}
 setPop(on){this.popcorn=on;this.bucket.visible=on}
 net(m,snap){this.tgt=m;if(snap){this.pos.x=m.x;this.pos.z=m.z;this.group.rotation.y=m.r}}
 snapSit(seat){this.seated=true;this.pos.set(seat.x,seat.y,seat.z);this.group.rotation.y=Math.PI;this.av.sit=1}
 update(dt,t){const s=this.script;
  if(this.tgt&&!this.busy&&!this.seated&&!s){const k=1-Math.exp(-dt*12),g=this.group;this.pos.x+=(this.tgt.x-this.pos.x)*k;this.pos.z+=(this.tgt.z-this.pos.z)*k;g.rotation.y+=Math.atan2(Math.sin(this.tgt.r-g.rotation.y),Math.cos(this.tgt.r-g.rotation.y))*k;this._mv=!!this.tgt.w}
 if(s){const p=s.pts[0],dx=p[0]-this.pos.x,dz=p[1]-this.pos.z,d=Math.hypot(dx,dz),st=s.speed*dt;
   if(d<=st){this.pos.x=p[0];this.pos.z=p[1];s.pts.shift();if(!s.pts.length){this.script=null;s.res()}}else{this.pos.x+=dx/d*st;this.pos.z+=dz/d*st;this.face(Math.atan2(dx,dz),Math.min(1,dt*10))}}
  this.av.walk=this.script||this._mv?1:0;this._mv=false;if(!this.seated&&!(this.av.sit>0))this.pos.y=floorY(this.pos.z);
  this.av.update(dt,t);this.bucket.position.y=.95-.25*this.av.sit;this.mark.position.y=(this.av.sit>.5?1.65:2.05)+Math.sin(t*3)*.04;this.mark.rotation.y=t*2}}
