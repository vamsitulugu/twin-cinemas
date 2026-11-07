import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyLook,randomLook} from './look.js';
/** Rigged (Mixamo-style) avatars with procedural walk / sit / stand poses. No animation clips needed. */
const V=(x,y,z)=>new THREE.Vector3(x,y,z),wp=o=>o.getWorldPosition(new THREE.Vector3()),YA=V(0,1,0);
const NAMES=['LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','Spine','Spine1','Spine2','Neck','Head','LeftToeBase','RightToeBase'];
const FILES={cf:'/models/couple_f.glb',cm:'/models/couple_m.glb',ma:'/models/aud_a.glb',fa:'/models/aud_b.glb',fb:'/models/aud_c.glb',rpm:'/models/avatar_m.glb'};
/** cf/cm = the couple's own MetaPerson avatars (Person 1 / Person 2). ma/fa/fb/rpm + extra = audience bases (never the couple's own faces). */
export const loadAvatars=async(progress)=>{const L=new GLTFLoader(),keys=Object.keys(FILES),p=keys.map(()=>0),rep=()=>progress?.(p.reduce((a,b)=>a+b,0)/keys.length),
 ld=(u,i)=>L.loadAsync(u,e=>{if(e.total){p[i]=e.loaded/e.total;rep()}}).then(g=>(p[i]=1,rep(),g));
 const out=await Promise.all(keys.map((k,i)=>ld(FILES[k],i))),gl={};keys.forEach((k,i)=>gl[k]=out[i]);
 gl.extra={f:[],m:[]};try{const idx=await(await fetch('/models/audience/index.json')).json();   // optional: more MetaPerson avatars dropped in /public/models/audience
  for(const g of['f','m'])for(const f of idx[g]||[]){try{gl.extra[g].push(await L.loadAsync('/models/audience/'+f))}catch{}}}catch{}
 return gl};
const _a1=new THREE.Vector3(),_a2=new THREE.Vector3(),_a3=new THREE.Vector3(),_qA=new THREE.Quaternion(),_qB=new THREE.Quaternion(),_qC=new THREE.Quaternion();
/** point bone b so that the direction b->c matches d. Uses shared scratch objects: no garbage per frame. */
function aim(b,c,d){b.updateWorldMatrix(true,true);c.getWorldPosition(_a1);b.getWorldPosition(_a2);_a1.sub(_a2).normalize();b.getWorldQuaternion(_qA);
 _qB.setFromUnitVectors(_a1,_a3.copy(d).normalize());b.parent.getWorldQuaternion(_qC).invert();b.quaternion.copy(_qC.multiply(_qB.multiply(_qA)));b.updateWorldMatrix(false,true)}
/** ring of reusable vectors for the per-frame pose directions (aim() consumes each one immediately) */
const VT=(()=>{const p=Array.from({length:96},()=>new THREE.Vector3());let i=0;return(x,y,z)=>p[i++%96].set(x,y,z)})();
/** opts: height (m), look (see look.js: per-part recolour), hide (mesh names), walker (can walk), seated (start seated, e.g. audience), headScale (number or [x,y,z]), relaxed (straight legs, straight arms: use for the couple) */
export function makeAvatar(gltf,{height=1.7,look,hide=[],walker=false,seated=false,headScale=1,relaxed=false,style=''}={}){
 const m=clone(gltf.scene),group=new THREE.Group();group.add(m);const _q=new THREE.Quaternion(),_ad=new THREE.Vector3(),A=(b,c,d)=>aim(b,c,_ad.copy(d).applyQuaternion(group.getWorldQuaternion(_q)));   // pose directions are in the avatar's own frame, so limbs follow its facing
 const bn=n=>m.getObjectByName('mixamorig'+n)||m.getObjectByName(n),B={};NAMES.forEach(n=>B[n]=bn(n));const hips=bn('Hips');
 group.updateMatrixWorld(true);const ff=()=>(wp(B.LeftFoot).y+wp(B.RightFoot).y)/2;
 m.scale.multiplyScalar((height-.3)/(wp(B.Head).y-ff()));group.updateMatrixWorld(true);m.position.y-=ff()-.08;group.updateMatrixWorld(true);
 if(look)applyLook(m,look);
 m.traverse(k=>{if(k.isMesh){k.castShadow=k.receiveShadow=true;k.frustumCulled=false;if(hide.includes(k.name))k.visible=false;if(/Cornea/i.test(k.name))k.visible=false;
  else if(k.material.transparent&&!look){k.material=k.material.clone();k.material.transparent=false;k.material.alphaTest=.45;k.material.depthWrite=true}}});   // hair cards: alpha-test instead of blending (no sorting artefacts)
 const all=NAMES.map(n=>B[n]).concat([hips]),rest=all.map(b=>[b.quaternion.clone(),b.position.clone()]);
 const side=n=>Math.sign(wp(B[n+'UpLeg']).x-wp(hips).x)||1,sg={Left:side('Left'),Right:side('Right')};
 ['Left','Right'].forEach(S=>{const k=sg[S];A(B[S+'UpLeg'],B[S+'Leg'],V(.05*k,-.02,1));A(B[S+'Leg'],B[S+'Foot'],V(0,-1,.04));A(B[S+'Arm'],B[S+'ForeArm'],V(.12*k,-1,.1));A(B[S+'ForeArm'],B[S+'Hand'],V(.08*k,-.45,.9))});
 const hw=wp(hips).add(V(0,.08-ff(),0));hw.y=Math.max(hw.y,.58);hips.position.copy(hips.parent.worldToLocal(hw));
 const sb=all.map(b=>({b,q:b.quaternion.clone()})),hsit=hips.position.clone(),hrest=rest[all.length-1][1].clone();
 all.forEach((b,i)=>b.quaternion.copy(rest[i][0]));hips.position.copy(hrest);
 const wb=all.map((b,i)=>[b,rest[i][0]]),my=m.position.y,leg=wp(B.LeftUpLeg).y-wp(B.LeftFoot).y,headQ=sb.find(s=>s.b===B.Head).q,seed=Math.random()*9,yq=new THREE.Quaternion();
 if(Array.isArray(headScale))B.Head.scale.set(...headScale);else if(headScale!==1)B.Head.scale.setScalar(headScale);
 const ST={m:{sw:.4,as:.42,hy:.1,tw:.3,roll:.05,lean:.03,bend:.38,cad:6,bob:.014,chest:.025},f:{sw:.36,as:.3,hy:.18,tw:.26,roll:.09,lean:.02,bend:.3,cad:5.8,bob:.01,chest:.012}}[style],
  P={...(relaxed?{knee:.015,fore:.08,spread:.05,sw:.36,lift:.5,as:.5}:{knee:.12,fore:.5,spread:.12,sw:.46,lift:.75,as:.4}),...(ST?{sw:ST.sw,as:ST.as,lift:.55,spread:.07}:{})},_e=new THREE.Euler(0,0,0,'YXZ'),_r=new THREE.Quaternion(),_g=new THREE.Quaternion(),_p=new THREE.Quaternion(),_Rw=new THREE.Quaternion(),_gi=new THREE.Quaternion(),_pi=new THREE.Quaternion();
 /** rotate bone b by an (x pitch, y yaw, z roll) turn measured in the avatar's own frame (so it works whatever way it faces) */
 const rotW=(b,x,y,z)=>{group.getWorldQuaternion(_g);_r.setFromEuler(_e.set(x,y,z));_gi.copy(_g).invert();_Rw.copy(_g).multiply(_r).multiply(_gi);b.parent.getWorldQuaternion(_p);_pi.copy(_p).invert().multiply(_Rw).multiply(_p);b.quaternion.premultiply(_pi);b.updateWorldMatrix(false,true)};
 /** stylish body language: pelvis sway, counter-twisting shoulders, steady head, soft weight shift when idle */
 const stylePose=(a,t,ph)=>{const s=Math.sin(ph),c=Math.cos(ph),id=1-a,w=Math.sin(t*.55+seed),h=Math.sin(t*.33+seed*2);
  rotW(hips,ST.lean*a,-ST.hy*s*a,ST.roll*s*a+.03*w*id);
  rotW(B.Spine,ST.lean*.5*a-.01*id,ST.tw*.25*s*a,-ST.roll*.5*s*a-.02*w*id);
  rotW(B.Spine1,ST.lean*.3*a+ST.chest*id*Math.sin(t*1.6+seed),ST.tw*.35*s*a,-ST.roll*.3*s*a);
  rotW(B.Spine2,ST.lean*.2*a,ST.tw*.4*s*a,-ST.roll*.2*s*a);
  rotW(B.Neck,-ST.lean*.8*a,.3*(-ST.hy+ST.tw)*s*a*-1,0);
  rotW(B.Head,-ST.lean*.6*a,(.12*h+.05*Math.sin(t*.9+seed))*id,.04*h*id)};
 let lastPose=-1;const av={group,sit:seated?1:0,walk:0,amp:0,ph:0,wave:0,emote(n){if(n==='wave')av.wave=2.2},
  walkPose(t=0){wb.forEach(([b,q])=>b.quaternion.copy(q));const a=av.amp;if(ST)stylePose(a,t,av.ph);
   ['Left','Right'].forEach((n,i)=>{const f=av.ph+i*Math.PI,k=sg[n],th=P.sw*a*Math.sin(f),ps=th-(P.knee+P.lift*a*Math.max(0,Math.cos(f))),al=-P.as*a*Math.sin(f);
    A(B[n+'UpLeg'],B[n+'Leg'],VT(.03*k,-Math.cos(th),Math.sin(th)));A(B[n+'Leg'],B[n+'Foot'],VT(0,-Math.cos(ps),Math.sin(ps)));A(B[n+'Foot'],B[n+'ToeBase'],VT(0,-.1,1));
    A(B[n+'Arm'],B[n+'ForeArm'],VT(P.spread*k,-Math.cos(al),Math.sin(al)));A(B[n+'ForeArm'],B[n+'Hand'],VT((P.spread*.6)*k,-Math.cos(al+P.fore+(ST?ST.bend*a*Math.max(0,-Math.sin(f))+.12*a:0)),Math.sin(al+P.fore+(ST?ST.bend*a*Math.max(0,-Math.sin(f))+.12*a:0))))});
   m.position.y=my-leg*a*(1-Math.cos(P.sw*Math.abs(Math.sin(av.ph))))+(ST?ST.bob*a*Math.cos(2*av.ph):0)},
  update(dt,t){if(walker){av.amp+=((av.walk&&av.sit<.5?1:0)-av.amp)*Math.min(1,dt*8);av.ph+=dt*(ST?ST.cad:6.8)*av.amp;if(av.sit<1&&(av.amp>.02||av.walk||av.sit>0||t-lastPose>.045||t<lastPose)){lastPose=t;av.walkPose(t)}   // only a fully idle, standing avatar is refreshed at ~22 Hz
    hips.position.copy(hrest).lerp(hsit,av.sit);if(av.sit>0)for(const s of sb)s.b.quaternion.slerp(s.q,av.sit)}
   if(av.sit>.98)B.Head.quaternion.copy(headQ).multiply(yq.setFromAxisAngle(YA,Math.sin(t*.6+seed)*.3));
   if(av.wave>0){av.wave-=dt;const k=sg.Right,s=Math.sin(t*11);A(B.RightArm,B.RightForeArm,VT(.55*k,.65,.25));A(B.RightForeArm,B.RightHand,VT((.2+.5*s)*k,.9,.15))}}};
 if(seated){sb.forEach(s=>s.b.quaternion.copy(s.q));hips.position.copy(hsit)}
 return av}
/** Fill the already-taken seats with a varied crowd. Never uses the couple's avatars: 4 different people models (+ any in /models/audience), shared out evenly, each with its own skin, hair, clothes, height and face proportions. */
export const CROWD_SHADOWS=false;   // the seated crowd is static: letting it cast shadows doubles the triangles the GPU draws for little visible gain
export function seatAudience(scene,hall,gl){const list=[],bases=[{g:gl.ma,k:'m'},{g:gl.fa,k:'f'},{g:gl.rpm,k:'rpm'},{g:gl.fb,k:'f',gl:1},...gl.extra.f.map(g=>({g,k:'f',x:1})),...gl.extra.m.map(g=>({g,k:'m',x:1}))];
 const seats=[...hall.taken].sort(()=>Math.random()-.5);let i=Math.random()*bases.length|0;
 seats.forEach(id=>{const s=hall.seats.get(id),b=bases[i++%bases.length],look=randomLook(b.k);if(b.x)look.skin=[1,1,1];
  const a=makeAvatar(b.g,{height:look.height,seated:true,look,headScale:look.head,hide:b.k==='rpm'?[...(look.capOn?[]:['Wolf3D_Headwear']),...(look.beard?[]:['Wolf3D_Beard'])]:b.gl&&Math.random()<.5?['Wolf3D_Glasses']:[]});
  a.group.position.copy(s.pos);a.group.rotation.y=Math.PI+(Math.random()-.5)*.12;if(!CROWD_SHADOWS)a.group.traverse(k=>{if(k.isMesh)k.castShadow=false});scene.add(a.group);list.push(a)});return list}
