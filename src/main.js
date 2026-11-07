import * as THREE from 'three';
import {buildHall,floorY,DOOR_Z} from './hall.js';
import {CameraRig} from './camera.js';
import {Player} from './player.js';
import {loadAvatars,makeAvatar,seatAudience} from './avatar.js';
import {createMachine,S} from './state.js';
import {createSync,ONLINE} from './net.js';
import {Movie,fmt} from './video.js';
import {audio} from './audio.js';
import {createCanteen} from './canteen.js';
import {COUNTER_Z} from './lobby.js';
import {createStudio} from './studio.js';
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const tween=(ms,f)=>new Promise(r=>{const s=performance.now();(function k(){const u=Math.min(1,(performance.now()-s)/ms);f(u*u*(3-2*u));u<1?requestAnimationFrame(k):r()})()});
/* renderer / scene */
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.5:2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0605);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,80);
const fit=()=>{camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<1?78:55;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};fit();addEventListener('resize',fit);
const hall=buildHall(scene,renderer),rig=new CameraRig(camera,renderer.domElement,{onManual:()=>setView('orbit')});
const movie=new Movie();
let gl;try{gl=await loadAvatars(p=>$('loading').textContent='LOADING THEATRE… '+Math.round(p*100)+'%')}catch(e){$('loading').textContent='Could not load avatars: '+e.message;throw e}
const aud=seatAudience(scene,hall,gl),studio=createStudio(renderer,gl);studio.on=true;
const spawn=(kind,h,color,x)=>{const p=new Player(makeAvatar(gl[kind],{height:h,walker:true,relaxed:true,style:kind==='cf'?'f':'m'}),color);scene.add(p.group);p.pos.set(x,floorY(DOOR_Z+1.9),DOOR_Z+1.9);p.group.rotation.y=Math.PI;return p};
let me=null,partner=null,role=0,sync=null,partnerSeat=null,doorOpen=false;hall.lobbyMode=true;                                   // the hall starts with the couple outside, in the lobby
let bagPrev={popcorn:false,drink:false};
const canteen=createCanteen({canGift:()=>!!sync?.present,sfx:n=>audio[n]?.(),
 onBag(st){if(!me)return;if(st.popcorn!==bagPrev.popcorn){me.setPop(st.popcorn);sync?.send({t:'pop',on:st.popcorn})}if(st.drink!==bagPrev.drink)me.setDrink(st.drink);bagPrev={...st};buttons()},
 onGift:items=>sync?.send({t:'order',items}),
 onReady:(order,kinds,mine)=>{if(mine)hall.lobby.showTray(kinds)},
 onClose:()=>{if(m.state===S.DOOR)hint(LOBBY_TIP)}});
const LOBBY_TIP='Walk anywhere (WASD / tap the floor) · stand at the counter to order · walk through the door to go in';
const COL={1:0xff5c8a,2:0x4db2ff},KIND={1:['cf',1.68],2:['cm',1.8]},LX={1:-.5,2:.5};
const openDoor=()=>doorOpen?Promise.resolve():(doorOpen=true,tween(800,u=>hall.setDoor(u)));
const fsOn=()=>document.documentElement.requestFullscreen?.().catch(()=>{}),fsOff=()=>document.fullscreenElement&&document.exitFullscreen();
/* state machine drives everything */
let lit=1;const fade=(to,ms)=>{const a=lit;return tween(ms,u=>{lit=a+(to-a)*u;hall.setLights(lit)})};
const m=createMachine(S.DOOR);let mySeat=null,pending=null,view='follow';
const setView=(v,o)=>{view=v;rig.setMode(v,o);buttons()};
/* camera angles you can cycle through with one button */
const ANG=[['screen','📷 Screen'],['shoulder','📷 Shoulder'],['side','📷 Side'],['couple','📷 Couple'],['orbit','📷 360°']],angIdx=()=>Math.max(0,ANG.findIndex(a=>a[0]===view));
const nextAngle=()=>{const k=view==='full'||!ANG.some(a=>a[0]===view)?0:(angIdx()+1)%ANG.length,v=ANG[k][0];setView(v,v==='orbit'?{yaw:Math.PI,pitch:.35,dist:4.5,auto:true}:undefined)};
const bar=$('bar'),tip=t=>$('tip').textContent=t||'';
const HINTS=false,hint=t=>tip(HINTS?t:'');          // set HINTS=true to bring back the how-to-play lines at the top
const B=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;if(cls)b.className=cls;bar.appendChild(b)};
function buttons(){bar.innerHTML='';const s=m.state;
 if(s===S.EXPLORE&&pending)B('🪑 Sit here',sitDown,'main');
 if(s===S.SEATED){const wait2=sync?.present&&!partnerSeat;B(wait2?'⏳ Waiting for partner to sit':'▶ Start movie',()=>m.go(S.WATCH),'main').disabled=wait2;B('🧍 Stand up',standUp);}
 if([S.WATCH,S.PAUSED,S.BREAK].includes(s)){B(s===S.WATCH?'⏸ Pause':'▶ Play',()=>m.go(s===S.WATCH?S.PAUSED:S.WATCH),'main');B(ANG[angIdx()][1],nextAngle);B('⛶ Full screen',enterFull);B(movie.muted?'🔇 Sound off':'🔊 Sound',()=>{movie.muted=!movie.muted;buttons()});B('☕ Break',()=>m.go(S.BREAK));}
 if(me&&m.is(S.SEATED,S.WATCH,S.PAUSED,S.BREAK))B(me.popcorn?'🍿 Put away':'🍿 Popcorn',togglePop);
 if(me&&!m.is(S.DOOR,S.ENTER,S.END)){B('❤️',()=>emote('heart'));B('👋',()=>emote('wave'));B('👏',()=>emote('clap'))}
 if([S.EXPLORE,S.SEATED,S.PAUSED,S.BREAK].includes(s))bar.appendChild(fileLabel);
 if(view==='full'){bar.innerHTML='';B('✕ Exit full screen',exitFull)}}
m.on(async(s,p)=>{const ui=$('door-ui'),ov=$('ov');ui.style.display=s===S.DOOR?'flex':'none';ov.style.display='none';hall.lobbyMode=s===S.DOOR;if(s!==S.DOOR&&canteen.isOpen)canteen.close();
 if(s===S.DOOR){setView('door');tip()}
 if(s===S.ENTER){tip('');await openDoor();setView('follow',{yaw:0,pitch:.55,dist:4});hall.lobby.hideTray();await me.walk([[LX[role],DOOR_Z+1.2],[LX[role],DOOR_Z-1]]);m.go(S.EXPLORE)}
 if(s===S.EXPLORE){hint('WASD / arrows or tap the floor to walk · drag to look · tap a seat');if(p===S.SEATED)setView('follow',{pitch:.55,dist:4})}
 if(s===S.SEATED){setView('seat',{yaw:Math.PI*.15,pitch:.4,dist:3.2});hint(sync?.present?'You are seated. Start when you are both seated.':'You are seated. Start the movie when ready.')}
 if(s===S.WATCH){const first=p===S.SEATED;tip('');if(first){fade(.07,1800);await wait(500);tween(2600,u=>hall.setCurtains(u))}else fade(.07,900);if(!['orbit','full'].includes(view)||p!==S.WATCH)setView('screen')}
 if(s===S.PAUSED){fade(.4,900);setView('couple')}
 if(s===S.BREAK){fade(1,1200);setView('couple');ov.innerHTML='☕ Break time<br><small style="font-size:14px;color:#a79ebf">Resume when you are back</small>';ov.style.display='flex'}
 if(s===S.END){fade(1,2500);setView('couple');ov.innerHTML='The End ♥';const a=document.createElement('button');a.textContent='↻ Watch again';a.className='main';a.onclick=()=>{hall.setCurtains(1);m.go(S.WATCH)};const l=document.createElement('button');l.textContent='✕ Leave theatre';l.onclick=()=>location.reload();ov.append(a,l);ov.style.display='flex'}
 buttons()});
/* ---- studio (outside the theatre, before joining) ---- */
const stEl=$('st'),fadeEl=$('fade');stEl.style.display='block';
function leaveStudio(){fadeEl.classList.add('on');setTimeout(()=>{studio.on=false;stEl.style.display='none';fadeEl.classList.remove('on')},560)}
$('st-anim').onclick=()=>studio.wave();
$('st-spin').onclick=e=>e.currentTarget.classList.toggle('on',studio.toggleSpin());
document.querySelectorAll('#st-rail [data-v]').forEach(b=>b.onclick=()=>{studio.view(b.dataset.v);document.querySelectorAll('#st-rail [data-v]').forEach(x=>x.classList.toggle('on',x===b))});
$('st-png').onclick=async()=>{const bl=await studio.png();if(!bl)return;const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='our-twin-cinema.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
/* actions */
let blocked=false,atCounter=false;
const startEnter=()=>{if(blocked||m.state!==S.DOOR)return;audio.door();audio.ambient(.05);m.go(S.ENTER)};
const walkToCounter=()=>{target={x:role===1?-.9:.9,z:DOOR_Z+COUNTER_Z}};
const stat=t=>$('dstat').textContent=t||'';
let lost=null;
async function partnerSit(id){const seat=hall.seats.get(id);if(!seat||!partner||partnerSeat?.id===id)return;if(mySeat?.id===id){if(role>3-role)lost=id;return}partnerSeat=seat;hall.taken.add(id);hall.setSeatHighlight(id,COL[3-role]);partner.busy=true;buttons();
 if(m.is(S.DOOR,S.ENTER)||partner.pos.z>DOOR_Z+.1)partner.snapSit(seat);else{await partner.walk(hall.route(partner.pos,seat));await partner.sit(seat)}buttons()}
async function partnerStand(){const s=partnerSeat;if(!s)return;partnerSeat=null;hall.taken.delete(s.id);hall.setSeatHighlight(s.id,0);await partner.stand(s);partner.busy=false;buttons()}
const snap=()=>({x:me.pos.x,z:me.pos.z,r:me.group.rotation.y,w:me.av.walk?1:0,s:mySeat?.id||null,pc:me.popcorn?1:0,dr:me.drink?1:0});
async function join(r){if(role)return;role=r;leaveStudio();audio.init();$('door-ui').classList.add('joined');const code=$('room').value.trim()||location.hash.slice(1)||'lobby';history.replaceState(0,'','#'+code);
 document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('on',+b.dataset.r===r));$('room').disabled=true;stat('Connecting…');
 const mk=q=>{const[k,h]=KIND[q],p=spawn(k,h,COL[q],LX[q]);return p};me=mk(r);partner=mk(3-r);partner.group.visible=false;
 setView('follow',{yaw:0,pitch:.5,dist:4.5});canteen.showBag(true);hint(LOBBY_TIP);
 sync=await createSync(code,r,{
  onJoin(){partner.group.visible=true;stat('Your partner is in the lobby ♥');hint(m.state===S.DOOR?LOBBY_TIP:'');buttons()},
  onHello(){sync?.send({t:'pos',...snap()});if(movie.meta)sync?.send({t:'meta',meta:movie.meta})},onMsg,
  onPos(q){if(!partner.tgt)partner.net(q,true);else partner.net(q);partner.group.visible=true;if(q.z<DOOR_Z+.7)openDoor();
   if(q.s&&!partnerSeat)partnerSit(q.s);else if(!q.s&&partnerSeat&&!partner.script)partnerStand();if(!!q.pc!==!!partner.popcorn)partner.setPop(!!q.pc);if(!!q.dr!==!!partner.drink)partner.setDrink(!!q.dr)},
  onSit:q=>partnerSit(q.id),onStand:()=>partnerStand(),
  onLeave(){stat('Your partner left');tip('Your partner left the theatre');partner.group.visible=false;if(partnerSeat){hall.taken.delete(partnerSeat.id);hall.setSeatHighlight(partnerSeat.id,0);partnerSeat=null}partner.busy=false;buttons()},
  onConflict(){stat('That seat in the room is already taken — reload and pick the other person');blocked=true;sync?.close()}});
 stat('Waiting for your partner at the door…')}
document.querySelectorAll('#roles button').forEach(b=>b.onclick=()=>join(+b.dataset.r));$('room').value=decodeURIComponent(location.hash.slice(1));
async function sitDown(){const seat=hall.seats.get(pending);if(!seat)return;const id=pending;pending=null;mySeat=seat;sync?.send({t:'sit',id});buttons();
 await wait(sync?.present?250:0);if(lost===id){mySeat=null;lost=null;hall.setSeatHighlight(id,0);tip('Your partner got that seat first — pick another');buttons();partnerSit(id);return}

 await me.walk(hall.route(me.pos,seat));await me.sit(seat);hall.setSeatHighlight(id,COL[role]);m.go(S.SEATED)}
async function standUp(){sync?.send({t:'stand'});hall.setSeatHighlight(mySeat.id,0);await me.stand(mySeat);mySeat=null;m.go(S.EXPLORE)}
/* ---- movie: sync, full screen, seek ---- */
let applying=false,partnerMeta=null,lastSync=0,fullOn=false;const fv=$('fv'),fc=$('fc');
const same=(a,b)=>a&&b&&a.size===b.size&&Math.abs(a.dur-b.dur)<2;
const checkMeta=()=>{if(movie.meta&&partnerMeta)tip(same(movie.meta,partnerMeta)?'Both of you have the same movie ♥':'Heads up: your partner picked a different file, so you will not see the same movie');else if(movie.meta&&sync?.present)tip('Waiting for your partner to choose the same movie file')};
function onMsg(q){if(q.t==='ctl'){if(Math.abs(movie.time-q.vt)>.5)movie.seek(q.vt);applying=true;m.go(q.s);applying=false}
 else if(q.t==='seek')movie.seek(q.vt);else if(q.t==='sync'){if(role===2&&m.state===S.WATCH&&q.pl)movie.correct(q.vt)}
 else if(q.t==='meta'){partnerMeta=q.meta;checkMeta()}
 else if(q.t==='chat'){show(partner,q.x);audio.chat()}else if(q.t==='pop')partner.setPop(q.on),buttons();else if(q.t==='emo')doEmote(partner,q.e);else if(q.t==='order')canteen.receive(q.items||[])}
const fileLabel=document.createElement('label');fileLabel.className='btn';fileLabel.innerHTML='🎞 Choose movie<input type="file" accept="video/*">';
fileLabel.querySelector('input').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const meta=await movie.load(f);sync?.send({t:'meta',meta});tip('Loaded '+meta.name);checkMeta()}catch(err){tip(err.message)}};
m.on((s,p)=>{if(s===S.WATCH){if(movie.src){hall.setScreenMap(movie.tex);hall.fitScreen(movie.aspect)}if(p===S.END||p===S.SEATED)movie.seek(0);if(p===S.SEATED)setTimeout(()=>m.state===S.WATCH&&movie.play(),3200);else movie.play()}else if(s===S.PAUSED||s===S.BREAK)movie.pause();
 if(s!==S.WATCH&&fullOn)exitFull();if(s===S.DOOR||s===S.ENTER||s===S.EXPLORE||s===S.SEATED)movie.pause();
 if(!applying&&sync&&[S.WATCH,S.PAUSED,S.BREAK,S.END].includes(s))sync.send({t:'ctl',s,vt:movie.time});
 $('seek').style.display=[S.WATCH,S.PAUSED,S.BREAK].includes(s)?'flex':'none'});
movie.onend=()=>{if(m.state===S.WATCH)m.go(S.END)};
movie.onblocked=()=>{const ov=$('ov');ov.innerHTML='';const b=document.createElement('button');b.className='main';b.textContent='▶ Tap to join the movie';b.onclick=()=>{ov.style.display='none';movie.play()};ov.appendChild(b);ov.style.display='flex'};
function enterFull(){if(movie.src){fullOn=true;placeChat();movie.v.className='fullvid';fv.querySelector('.slot').appendChild(movie.v);fv.style.display='flex';showCtl()}else setView('full');fsOn()}
function exitFull(){if(fullOn){fullOn=false;placeChat();fv.style.display='none';movie.v.className='hv';document.body.appendChild(movie.v);fsOff()}else if(view==='full'){fsOff();setView('screen')}else fsOff()}
addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&(fullOn||view==='full')){if(fullOn){fullOn=false;fv.style.display='none';movie.v.className='hv';document.body.appendChild(movie.v)}else setView('screen')}});
let hideT;const showCtl=()=>{fc.classList.add('show');clearTimeout(hideT);hideT=setTimeout(()=>fc.classList.remove('show'),3000)};
fv.addEventListener('pointerdown',showCtl);$('fp').onclick=()=>m.go(S.PAUSED);$('fx').onclick=()=>{exitFull();setView('screen')};$('fm').onclick=()=>{movie.muted=!movie.muted;$('fm').textContent=movie.muted?'🔇':'🔊'};
const doSeek=v=>{movie.seek(v/1000*movie.dur);sync?.send({t:'seek',vt:movie.time})};$('sk').oninput=e=>doSeek(+e.target.value);$('fsk').oninput=e=>doSeek(+e.target.value);
/* input */
const keys={};addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT')keys[e.key.toLowerCase()]=1});addEventListener('keyup',e=>delete keys[e.key.toLowerCase()]);
const rc=new THREE.Raycaster(),nd=new THREE.Vector2();let target=null;
renderer.domElement.addEventListener('pointerup',e=>{if(!me||me.script||!rig.wasTap||canteen.isOpen)return;const lob=m.state===S.DOOR;if(!lob&&m.state!==S.EXPLORE)return;nd.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);rc.setFromCamera(nd,camera);
 if(lob){const r=rc.intersectObjects([...hall.lobby.hits,...hall.lobby.floors])[0];if(r){if(hall.lobby.hits.includes(r.object))walkToCounter();else target=r.point}return}
 if(!me)return;const s=rc.intersectObjects(hall.picks)[0];if(s){const id=s.object.userData.seatId;if(!hall.taken.has(id)){if(pending)hall.setSeatHighlight(pending,0);pending=id;hall.setSeatHighlight(id,0xffb0c8);target=null;tip('');buttons()}else tip(`Seat ${id} is taken`);return}
 const f=rc.intersectObjects(hall.floors)[0];if(f){if(pending){hall.setSeatHighlight(pending,0);pending=null;buttons()}target=f.point}});
/* loop */
/* ---- social: chat bubbles, popcorn, emotes, joystick, leave, sound ---- */
let jx=0,jz=0,lastPlace=0;const bub=new Map(),head=new THREE.Vector3();
function say(p,x){let b=bub.get(p);if(!b){b={el:document.createElement('div'),t:0};b.el.className='bubble';document.body.appendChild(b.el);bub.set(p,b)}b.el.textContent=x;b.el.style.background=p===me?'#c2305ae6':'#2a7fc4e6';b.t=performance.now()}
function bubbleTick(now){for(const[p,b]of bub){if(now-b.t>8000||!p.group.visible){b.el.style.opacity=0;continue}head.copy(p.pos);head.y+=p.av.sit>.5?1.75:2.15;head.project(camera);b.el.style.left=(head.x*.5+.5)*innerWidth+'px';b.el.style.top=(-head.y*.5+.5)*innerHeight+'px';b.el.style.opacity=head.z<1?1:0}}
/* chat: hidden until the 💬 button is tapped. Before / between the movie the messages float above the couple's heads
   (camera comes a little closer); while the movie plays they appear subtitle-style low on the screen instead. */
const chatEl=$('chat'),msgs=$('msgs'),cb=$('cb');let chatOpen=false,chatCam=null;const DEF={follow:{pitch:.55,dist:4},seat:{yaw:Math.PI*.15,pitch:.4,dist:3.2}};
function feed(mine,x){const d=document.createElement('div');d.className='msg'+(mine?' me':'');d.textContent=x;msgs.appendChild(d);while(msgs.children.length>4)msgs.firstChild.remove();setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),700)},8000)}
function show(p,x){if(m.state===S.WATCH)feed(p===me,x);else say(p,x);if(p!==me&&!chatOpen&&m.state!==S.WATCH)cb.classList.add('new')}
function placeChat(){const tops=[bar,$('seek')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().top),top=fullOn?innerHeight-70:Math.min(innerHeight-14,...tops);
 chatEl.style.bottom=(innerHeight-top+8)+'px';msgs.style.bottom=(innerHeight-top+8+(chatOpen?48:0))+'px'}
function chatShot(){if(!chatOpen||m.is(S.WATCH,S.DOOR,S.ENTER))return;if(chatCam===null)chatCam=view;m.state===S.EXPLORE?setView('follow',{pitch:.3,dist:2.7}):setView('chat')}
function openChat(){if(chatOpen||!me||m.is(S.DOOR,S.ENTER))return;chatOpen=true;cb.classList.remove('new');chatEl.style.display='flex';chatShot();placeChat();setTimeout(()=>$('ci').focus(),60)}
function closeChat(){if(!chatOpen)return;chatOpen=false;chatEl.style.display='none';$('ci').blur();
 if(chatCam!==null){const v=chatCam;chatCam=null;if(view==='chat'||(v==='follow'&&view==='follow'))setView(v,DEF[v])}placeChat()}
const toggleChat=()=>chatOpen?closeChat():openChat();
cb.onclick=toggleChat;$('fchat').onclick=toggleChat;
m.on(()=>{chatCam=null;if(m.is(S.DOOR,S.ENTER))closeChat();else chatShot();placeChat()});     // keep the chat camera right when the story moves on (pause, break, end…)
function sendChat(){const i=$('ci'),v=i.value.trim();if(!v||!me)return;show(me,v);sync?.send({t:'chat',x:v});audio.chat();i.value=''}
$('ci').onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')sendChat();else if(e.key==='Escape')closeChat()};$('cs').onclick=sendChat;addEventListener('resize',placeChat);
function togglePop(){const on=!me.popcorn;me.setPop(on);sync?.send({t:'pop',on});if(on)audio.crunch();buttons()}
function doEmote(p,e){if(e==='wave')p.av.emote('wave');else{const ch=e==='heart'?'❤️':'👏';head.copy(p.pos);head.y+=2.2;head.project(camera);const f=document.createElement('div');f.className='fl';f.textContent=ch;f.style.left=(head.x*.5+.5)*innerWidth+'px';f.style.top=(-head.y*.5+.5)*innerHeight+'px';document.body.appendChild(f);setTimeout(()=>f.remove(),2000)}
 if(e==='heart')audio.heart()}
function emote(e){doEmote(me,e);sync?.send({t:'emo',e})}
$('leave').onclick=()=>{if(confirm('Leave the theatre?')){sync?.close();location.reload()}};let muted=false;$('snd').onclick=()=>{muted=!muted;audio.mute(muted);$('snd').textContent=muted?'🔕':'🔔'};
m.on((s,p)=>{$('top-r').style.display=s===S.DOOR?'none':(s===S.ENTER?'none':'flex');$('joy').style.display=s===S.EXPLORE&&matchMedia('(pointer:coarse)').matches?'block':'none';
 audio.ambient(s===S.WATCH?.015:.05);if(s===S.END)audio.chime()});
{const joy=$('joy'),kn=joy.firstElementChild,mv=e=>{const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+55),dy=e.clientY-(r.top+55),d=Math.hypot(dx,dy),k=d>45?45/d:1;kn.style.transform=`translate(${dx*k}px,${dy*k}px)`;jx=dx*k/45;jz=dy*k/45};
 joy.addEventListener('pointerdown',e=>{joy.setPointerCapture(e.pointerId);mv(e)});joy.addEventListener('pointermove',e=>{if(e.buttons||e.pressure)mv(e)});const up=()=>{jx=jz=0;kn.style.transform=''};joy.addEventListener('pointerup',up);joy.addEventListener('pointercancel',up)}
const clock=new THREE.Clock(),V3=new THREE.Vector3();
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;if(document.hidden)return;
 if(me&&(m.state===S.EXPLORE||(m.state===S.DOOR&&!canteen.isOpen))&&!me.script&&!me.seated){const ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+jx,iz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+jz;let dx=0,dz=0;
  let k=1;
  if(ix||iz){target=null;const fx=-Math.sin(rig.vy),fz=-Math.cos(rig.vy);dx=fx*-iz-fz*ix;dz=fz*-iz+fx*ix;k=Math.min(1,Math.hypot(ix,iz))}
  else if(target){dx=target.x-me.pos.x;dz=target.z-me.pos.z;const d=Math.hypot(dx,dz);if(d<.12){target=null;dx=dz=0}else k=Math.max(.3,Math.min(1,d/1.1))}
  me.move(dx,dz,dt,hall,k)}
 if(me&&m.state===S.DOOR&&!me.script&&!canteen.isOpen&&!me.seated){const lx=me.pos.x,lz=me.pos.z-DOOR_Z,nearC=lz>COUNTER_Z-.7&&Math.abs(lx)<3.5;
  if(nearC&&!atCounter){atCounter=true;target=null;me.face(0,1);canteen.open()}else if(!nearC&&lz<COUNTER_Z-1.4)atCounter=false;
  if(lz<1.25&&Math.abs(lx)<1&&role)startEnter()}
 movie.tick(dt);const now=performance.now();if(role===1&&sync?.present&&m.state===S.WATCH&&now-lastSync>3000){lastSync=now;sync.send({t:'sync',vt:movie.time,pl:movie.playing})}
 if(movie.dur){const v=movie.time/movie.dur*1000;$('sk').value=v;$('fsk').value=v;$('tc').textContent=$('ftc').textContent=fmt(movie.time);$('td').textContent=fmt(movie.dur)}
 aud.forEach(a=>a.update(dt,t));if(me){me.update(dt,t);partner.update(dt,t);rig.ctx.me.copy(me.pos);rig.ctx.couple.copy(me.pos);if(partner.group.visible)rig.ctx.couple.add(partner.pos).multiplyScalar(.5);sync?.tick(performance.now(),me.av.walk,snap)}{const cx=rig.ctx,[sw,sh]=hall.dims();cx.sw=sw;cx.sh=sh;cx.sy=hall.screen.position.y;if(me){cx.chatT.copy(me.pos);if(partner.group.visible&&me.pos.distanceTo(partner.pos)<2.6)cx.chatT.add(partner.pos).multiplyScalar(.5);if(now-lastPlace>500){lastPlace=now;placeChat()}}}
 rig.ctx.lobbyY=floorY(DOOR_Z);rig.ctx.lobby=m.state===S.DOOR;if(m.is(S.DOOR,S.ENTER))hall.lobby.update(t);
 bubbleTick(now);hall.drawScreen(t,m.is(S.WATCH,S.PAUSED,S.BREAK),movie.dur?movie.time/movie.dur:0);rig.update(dt,t);if(studio.on)studio.render(dt,t);else renderer.render(scene,camera);
 });
await wait(300);$('loading').classList.add('off');m.go(S.DOOR);setView('door');$('door-ui').style.display='flex';addEventListener('beforeunload',()=>sync?.close());
