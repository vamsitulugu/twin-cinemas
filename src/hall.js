import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
export const ROWS='ABCDE',COLS=8,DOOR_Z=7.5;
export const rowZ=r=>-1+r*1.5;
export const floorY=z=>Math.max(0,(Math.min(z,DOOR_Z)+2)*.2);
export const seatX=c=>c<4?-.65-(3-c)*.75:.65+(c-4)*.75;
const noise=(rx,ry,s)=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),d=x.createImageData(128,128);for(let i=0;i<d.data.length;i+=4){d.data[i]=d.data[i+1]=d.data[i+2]=120+Math.random()*s;d.data[i+3]=255}x.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t};
function carpetTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#5a1428';x.fillRect(0,0,128,128);x.strokeStyle='#c9a24a';x.lineWidth=2;x.beginPath();x.moveTo(64,6);x.lineTo(122,64);x.lineTo(64,122);x.lineTo(6,64);x.closePath();x.stroke();const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t}

export function buildHall(scene,renderer){
 const M=(c,o)=>new THREE.MeshStandardMaterial({color:c,roughness:.8,metalness:.05,...o});
 const bumpS=noise(3,3,135),bumpW=noise(40,25,135);
 const add=(m,x,y,z,p=scene)=>{m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m};
 const box=(w,h,d,mat,x,y,z,p)=>add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),x,y,z,p);
 // environment reflections
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.35;
 // shell
 const wall=M(0x3a1224,{side:THREE.BackSide,roughness:.95,bumpMap:bumpW,bumpScale:.7}),ceil=M(0x120d1a,{side:THREE.BackSide});
 const shell=new THREE.Mesh(new THREE.BoxGeometry(10,7,18.1),[wall,wall,ceil,ceil,wall,wall]);shell.position.set(0,3.5,-1.55);scene.add(shell);
 // floors
 const ct=carpetTex();ct.repeat.set(6,10);const ang=Math.atan(.2),len=Math.hypot(9.5,1.9);
 const ramp=new THREE.Mesh(new THREE.PlaneGeometry(10,len),M(0xffffff,{map:ct,roughness:.95}));ramp.rotation.x=-Math.PI/2-ang;ramp.position.set(0,.95,2.75);ramp.receiveShadow=true;scene.add(ramp);
 const ft=ct.clone();ft.repeat.set(6,5);const flat=new THREE.Mesh(new THREE.PlaneGeometry(10,8.6),M(0xffffff,{map:ft,roughness:.95}));flat.rotation.x=-Math.PI/2;flat.position.set(0,.001,-6.3);flat.receiveShadow=true;scene.add(flat);
 box(9.8,.25,1.3,M(0x1a1220),0,.125,-9.85);
 // wall panels + sconces
 const panel=M(0x5a1830,{bumpMap:bumpS,bumpScale:.8,roughness:.95}),glowMats=[],lamps=[];
 for(const s of[-1,1])for(let i=0;i<7;i++){const z=-8.5+i*2.4;box(.15,3.4,1.1,panel,s*4.92,3.7,z);
  const gm=M(0x221a10,{emissive:0xffc98a,emissiveIntensity:1});glowMats.push(gm);box(.08,.5,.18,gm,s*4.82,3.4,z+1.2).castShadow=false;
  if(i%2===0){const l=new THREE.PointLight(0xffb878,.7,6,2);l.position.set(s*4.3,3.4,z+1.2);scene.add(l);lamps.push(l)}}
 const strip=M(0x222222,{emissive:0xffe2b0,emissiveIntensity:1});[-2.5,0,2.5].forEach(x=>box(.25,.05,15,strip,x,6.95,-1.5).castShadow=false);
 // aisle step lights
 const step=M(0x221100,{emissive:0xff9a40,emissiveIntensity:1.3});for(let r=0;r<5;r++)[-.2,.2].forEach(x=>box(.06,.04,.16,step,x,floorY(rowZ(r)-.5)+.03,rowZ(r)-.5).castShadow=false);
 // lights
 const hemi=new THREE.HemisphereLight(0xffd9b0,0x2a1030,.6);scene.add(hemi);
 const spot=new THREE.SpotLight(0xffe2bf,60,30,1.1,.6,1);spot.position.set(0,6.8,2);spot.target.position.set(0,0,0);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.0005;scene.add(spot,spot.target);
 const glow=new THREE.PointLight(0xaab8ff,0,24,1.4);glow.position.set(0,3.4,-8);scene.add(glow);
 // screen + curtains
 const cvs=document.createElement('canvas');cvs.width=1024;cvs.height=512;const cx=cvs.getContext('2d');const tex=new THREE.CanvasTexture(cvs);tex.colorSpace=THREE.SRGBColorSpace;
 const screenMat=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});
 const screen=new THREE.Group();screen.position.set(0,3.4,-10.3);scene.add(screen);
 const SIZES={std:[8,3.6,0],imax:[9.4,5,0],curved:[8.8,3.8,.7],mini:[5,2.8,0]};
 const plane=(w,h,c,m,z)=>{const g=new THREE.PlaneGeometry(w,h,40,1),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,c?Math.pow(p.getX(i)/4.4,2)*c:0);g.computeVertexNormals();const k=new THREE.Mesh(g,m);k.position.z=z;return k};
 let kind='std';const setScreen=(k,asp)=>{kind=k;let[w,h,c]=SIZES[k];if(asp){h=Math.min(4.4,9/asp);w=h*asp}screen.clear();screen.add(plane(w+.5,h+.5,c,new THREE.MeshBasicMaterial({color:0x050505}),-.06),plane(w,h,c,screenMat,0))};setScreen('std');
 const cg=new THREE.PlaneGeometry(4.9,6.6,48,1),cp=cg.attributes.position;for(let i=0;i<cp.count;i++)cp.setZ(i,Math.sin(cp.getX(i)*14)*.1);cg.computeVertexNormals();
 const cm=M(0x9a1c3c,{roughness:.9,side:THREE.DoubleSide});
 const cL=new THREE.Group(),cR=new THREE.Group();cL.position.set(-4.95,3.4,-9.4);cR.position.set(4.95,3.4,-9.4);
 const m1=new THREE.Mesh(cg,cm),m2=new THREE.Mesh(cg,cm);m1.position.x=2.45;m2.position.x=-2.45;m1.castShadow=m2.castShadow=true;cL.add(m1);cR.add(m2);scene.add(cL,cR);
 // projector
 box(.7,.4,.9,M(0x111111),0,6.4,6.9);
 // seats
 const seats=new Map(),boxes=[],taken=new Set(['A3','B6','C1','C5','D4','D7','E2','E8']);
 const red=M(0x7a1228,{roughness:.88,bumpMap:bumpS,bumpScale:.7}),dark=M(0x1a1220);
 for(let r=0;r<5;r++)for(let c=0;c<COLS;c++){const id=ROWS[r]+(c+1),x=seatX(c),z=rowZ(r),y=floorY(z),g=new THREE.Group(),cushMat=red.clone();
  const part=(geo,mat,px,py,pz,rx=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.rotation.x=rx;m.castShadow=m.receiveShadow=true;m.userData.seatId=id;g.add(m);return m};
  part(new RoundedBoxGeometry(.56,.14,.5,3,.05),cushMat,0,.45,-.02);part(new RoundedBoxGeometry(.56,.76,.12,3,.05),red,0,.9,.27,.14);
  part(new RoundedBoxGeometry(.09,.1,.5,2,.03),dark,-.33,.62,0);part(new RoundedBoxGeometry(.09,.1,.5,2,.03),dark,.33,.62,0);part(new THREE.BoxGeometry(.12,.4,.3),dark,0,.2,.1);
  g.position.set(x,y,z);scene.add(g);seats.set(id,{id,group:g,cushMat,x,z,y,row:r,col:c,pos:new THREE.Vector3(x,y,z),aisle:new THREE.Vector3(x,floorY(z-.75),z-.75)});
  boxes.push({x0:x-.32,x1:x+.32,z0:z-.2,z1:z+.35})}
 // lobby (outside the door): wall with doorway, floor, light, sign
 const y0=floorY(DOOR_Z),sh=new THREE.Shape();sh.moveTo(-9,0);sh.lineTo(9,0);sh.lineTo(9,9);sh.lineTo(-9,9);sh.closePath();
 const hole=new THREE.Path();hole.moveTo(-.65,y0);hole.lineTo(.65,y0);hole.lineTo(.65,y0+2.4);hole.lineTo(-.65,y0+2.4);hole.closePath();sh.holes.push(hole);
 const lw=new THREE.Mesh(new THREE.ShapeGeometry(sh),M(0x2a1020,{bumpMap:bumpW,bumpScale:.5}));lw.position.z=DOOR_Z+.02;scene.add(lw);
 const lf=new THREE.Mesh(new THREE.PlaneGeometry(18,10),M(0x1c1018,{roughness:.5}));lf.rotation.x=-Math.PI/2;lf.position.set(0,y0,12);lf.receiveShadow=true;scene.add(lf);
 const ll=new THREE.PointLight(0xffc890,40,16,1.6);ll.position.set(0,y0+3.2,10);scene.add(ll);
 const sc=document.createElement('canvas');sc.width=512;sc.height=96;const sx=sc.getContext('2d');sx.fillStyle='#fff';sx.shadowColor='#ff5c8a';sx.shadowBlur=18;sx.font='bold 52px system-ui';sx.textAlign='center';sx.fillText('TWIN CINEMA',256,66);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true}));sign.position.set(0,y0+3.3,DOOR_Z+.06);scene.add(sign);
 const door=box(1.3,2.4,.08,M(0x3a2414),0,y0+1.2,7.36);box(.7,.22,.06,new THREE.MeshBasicMaterial({color:0x3dff7a}),0,y0+2.95,7.45);
 const picks=[...seats.values()].flatMap(s=>s.group.children);
 return{seats,taken,door,screen,cL,cR,picks,floors:[ramp,flat],setScreen,fitScreen:a=>setScreen(kind,a),setScreenMap(t){screenMat.map=t||tex;screenMat.needsUpdate=true},sizes:Object.keys(SIZES),
  /** house=1 full lights, 0.07 movie dark */
  setLights(v){hemi.intensity=.06+.54*v;spot.intensity=60*v;lamps.forEach(l=>l.intensity=.7*v);glowMats.forEach(m=>m.emissiveIntensity=v);strip.emissiveIntensity=v;scene.environmentIntensity=.05+.3*v;glow.intensity=3*(1-v)},
  setCurtains(o){cL.scale.x=cR.scale.x=1-.93*o},
  setSeatHighlight(id,hex){const s=seats.get(id);if(s){s.cushMat.emissive.setHex(hex||0);s.cushMat.emissiveIntensity=hex?.7:1}},
  drawScreen(t,playing,prog=0){cx.fillStyle='#120a22';cx.fillRect(0,0,1024,512);const g=cx.createRadialGradient(512,256,20,512,256,520);g.addColorStop(0,playing?'#5a2a7a':'#2a1642');g.addColorStop(1,'#0b0618');cx.fillStyle=g;cx.fillRect(0,0,1024,512);
   cx.textAlign='center';cx.fillStyle='#fff';cx.shadowColor='#ff5c8a';cx.shadowBlur=30;cx.font='bold 70px system-ui';cx.fillText('TWIN CINEMA',512,240);cx.shadowBlur=0;cx.font='28px system-ui';cx.fillStyle='#cdbfe8';
   cx.fillText(playing?'▶ Demo movie · choose a video file for the real thing':'Choose your seats ♥',512,300);if(playing||prog>0){cx.fillStyle='#fff3';cx.fillRect(112,450,800,6);cx.fillStyle='#ff5c8a';cx.fillRect(112,450,800*prog,6)}cx.fillStyle='#ff5c8a';cx.fillStyle='#ff5c8a';cx.font='40px serif';cx.fillText('♥',512+Math.sin(t*2)*60,380+Math.cos(t*3)*8);tex.needsUpdate=true},
  /** keep a point (radius r) inside the hall and out of seat blocks */
  resolve(p,r=.25,zMax=7.2){p.x=cl(p.x,-4.4,4.4);p.z=cl(p.z,-9,zMax);for(const b of boxes){const cx2=cl(p.x,b.x0,b.x1),cz=cl(p.z,b.z0,b.z1),dx=p.x-cx2,dz=p.z-cz,d=Math.hypot(dx,dz);if(d<r){if(d>1e-4){p.x=cx2+dx/d*r;p.z=cz+dz/d*r}else p.z=b.z0-r}}}}}
