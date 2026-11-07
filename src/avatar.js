import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Rigged (Mixamo-style) avatars with procedural walk / sit / stand poses. No animation clips needed. */
const V=(x,y,z)=>new THREE.Vector3(x,y,z),wp=o=>o.getWorldPosition(new THREE.Vector3()),YA=V(0,1,0);
const NAMES=['LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','Spine','Spine1','Spine2','Neck','Head','LeftToeBase','RightToeBase'];
export const loadAvatars=async(progress)=>{const L=new GLTFLoader(),p=[0,0],rep=()=>progress?.((p[0]+p[1])/2),ld=(u,i)=>L.loadAsync(u,e=>{if(e.total){p[i]=e.loaded/e.total;rep()}});const[f,m]=await Promise.all([ld('/models/avatar_f.glb',0),ld('/models/avatar_m.glb',1)]);return{f,m}};
function aim(b,c,d){b.updateWorldMatrix(true,true);const v=wp(c).sub(wp(b)).normalize(),qb=b.getWorldQuaternion(new THREE.Quaternion()),qd=new THREE.Quaternion().setFromUnitVectors(v,d.clone().normalize()),pq=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();b.quaternion.copy(pq.multiply(qd.multiply(qb)));b.updateWorldMatrix(false,true)}
/** opts: height (m), tint (THREE.Color), hide (mesh names), walker (can walk), seated (start seated, e.g. audience) */
export function makeAvatar(gltf,{height=1.7,tint,hide=[],walker=false,seated=false}={}){
 const m=clone(gltf.scene),group=new THREE.Group();group.add(m);
 const bn=n=>m.getObjectByName('mixamorig'+n)||m.getObjectByName(n),B={};NAMES.forEach(n=>B[n]=bn(n));const hips=bn('Hips');
 group.updateMatrixWorld(true);const ff=()=>(wp(B.LeftFoot).y+wp(B.RightFoot).y)/2;
 m.scale.multiplyScalar((height-.3)/(wp(B.Head).y-ff()));group.updateMatrixWorld(true);m.position.y-=ff()-.08;group.updateMatrixWorld(true);
 m.traverse(k=>{if(k.isMesh){k.castShadow=k.receiveShadow=true;k.frustumCulled=false;if(hide.includes(k.name))k.visible=false;if(tint){k.material=k.material.clone();k.material.color.copy(tint)}}});
 const all=NAMES.map(n=>B[n]).concat([hips]),rest=all.map(b=>[b.quaternion.clone(),b.position.clone()]);
 const side=n=>Math.sign(wp(B[n+'UpLeg']).x-wp(hips).x)||1,sg={Left:side('Left'),Right:side('Right')};
 ['Left','Right'].forEach(S=>{const k=sg[S];aim(B[S+'UpLeg'],B[S+'Leg'],V(.05*k,-.02,1));aim(B[S+'Leg'],B[S+'Foot'],V(0,-1,.04));aim(B[S+'Arm'],B[S+'ForeArm'],V(.12*k,-1,.1));aim(B[S+'ForeArm'],B[S+'Hand'],V(.08*k,-.45,.9))});
 const hw=wp(hips).add(V(0,.08-ff(),0));hw.y=Math.max(hw.y,.58);hips.position.copy(hips.parent.worldToLocal(hw));
 const sb=all.map(b=>({b,q:b.quaternion.clone()})),hsit=hips.position.clone(),hrest=rest[all.length-1][1].clone();
 all.forEach((b,i)=>b.quaternion.copy(rest[i][0]));hips.position.copy(hrest);
 const wb=all.map((b,i)=>[b,rest[i][0]]),my=m.position.y,leg=wp(B.LeftUpLeg).y-wp(B.LeftFoot).y,headQ=sb.find(s=>s.b===B.Head).q,seed=Math.random()*9,yq=new THREE.Quaternion();
 const av={group,sit:seated?1:0,walk:0,amp:0,ph:0,wave:0,emote(n){if(n==='wave')av.wave=2.2},
  walkPose(){wb.forEach(([b,q])=>b.quaternion.copy(q));const a=av.amp;
   ['Left','Right'].forEach((n,i)=>{const f=av.ph+i*Math.PI,k=sg[n],th=.46*a*Math.sin(f),ps=th-(.12+.75*a*Math.max(0,Math.cos(f))),al=-.4*a*Math.sin(f);
    aim(B[n+'UpLeg'],B[n+'Leg'],V(.03*k,-Math.cos(th),Math.sin(th)));aim(B[n+'Leg'],B[n+'Foot'],V(0,-Math.cos(ps),Math.sin(ps)));aim(B[n+'Foot'],B[n+'ToeBase'],V(0,-.1,1));
    aim(B[n+'Arm'],B[n+'ForeArm'],V(.12*k,-Math.cos(al),Math.sin(al)));aim(B[n+'ForeArm'],B[n+'Hand'],V(.1*k,-Math.cos(al+.5),Math.sin(al+.5)))});
   m.position.y=my-leg*a*(1-Math.cos(.46*Math.abs(Math.sin(av.ph))))},
  update(dt,t){if(walker){av.amp+=((av.walk&&av.sit<.5?1:0)-av.amp)*Math.min(1,dt*8);av.ph+=dt*6.8*av.amp;if(av.sit<1)av.walkPose();
    hips.position.copy(hrest).lerp(hsit,av.sit);if(av.sit>0)for(const s of sb)s.b.quaternion.slerp(s.q,av.sit)}
   if(av.sit>.98)B.Head.quaternion.copy(headQ).multiply(yq.setFromAxisAngle(YA,Math.sin(t*.6+seed)*.3));
   if(av.wave>0){av.wave-=dt;const k=sg.Right,s=Math.sin(t*11);aim(B.RightArm,B.RightForeArm,V(.55*k,.65,.25));aim(B.RightForeArm,B.RightHand,V((.2+.5*s)*k,.9,.15))}}};
 if(seated){sb.forEach(s=>s.b.quaternion.copy(s.q));hips.position.copy(hsit)}
 return av}
/** Fill the already-taken seats with seated extras so the hall feels alive. */
export function seatAudience(scene,hall,gl){const list=[];hall.taken.forEach(id=>{const s=hall.seats.get(id),f=Math.random()<.55,h=(f?1.58:1.72)+Math.random()*.12;
 const a=makeAvatar(f?gl.f:gl.m,{height:h,seated:true,tint:new THREE.Color().setHSL(Math.random(),.12,.5+Math.random()*.3),hide:f?[]:[...(Math.random()<.65?['Wolf3D_Headwear']:[]),...(Math.random()<.5?['Wolf3D_Beard']:[])]});
 a.group.position.copy(s.pos);a.group.rotation.y=Math.PI;scene.add(a.group);list.push(a)});return list}
