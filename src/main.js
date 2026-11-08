import * as THREE from 'three';
import {buildHall,floorY,DOOR_Z} from './hall.js';
import {CameraRig,VIEWS} from './camera.js';
import {Player} from './player.js';
import {createVolume} from './volume.js';
import {loadAvatars,makeAvatar,seatAudience,seatedChatter} from './avatar.js';
import {createMachine,S} from './state.js';
import {createSync,ONLINE} from './net.js';
import {Movie,fmt} from './video.js';
import {audio} from './audio.js';
import {createCanteen} from './canteen.js';
import {COUNTER_Z,LW,LD} from './lobby.js';
import {createLobbyCrowd} from './crowd.js';
import {createStudio} from './studio.js';
import {createPlayer} from './controls.js';
import {APP,mountInvite,markEnded,fetchMovieInfo,leaveApp,handshake,fetchLibrary} from './invite.js';
import {mountOrient} from './orient.js';
import {createMemes} from './memes.js';
const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const tween=(ms,f)=>new Promise(r=>{const s=performance.now();(function k(){const u=Math.min(1,(performance.now()-s)/ms);f(u*u*(3-2*u));u<1?requestAnimationFrame(k):r()})()});
/* renderer / scene */
const PR_MAX=Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.5:2),PR_MIN=Math.min(1,PR_MAX);let pr=PR_MAX;     // render scale: adapts to keep the frame rate smooth (see perf())
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;   // shadows are refreshed on a timer, not every frame
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0605);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,80);
const fit=()=>{camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<1?78:55;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};fit();addEventListener('resize',fit);
const hall=buildHall(scene,renderer),rig=new CameraRig(camera,renderer.domElement,{onManual:()=>setView('orbit')});
const movie=new Movie();const vol=createVolume({audio,movie});
let gl;try{gl=await loadAvatars(p=>$('loading').textContent='LOADING THEATRE… '+Math.round(p*100)+'%')}catch(e){$('loading').textContent='Could not load avatars: '+e.message;throw e}
const aud=seatAudience(scene,hall,gl),chatter=seatedChatter(aud),studio=createStudio(renderer,gl);studio.on=true;try{await renderer.compileAsync(scene,camera);hall.setRoom(true);await renderer.compileAsync(scene,camera);hall.setRoom(false)}catch(e){hall.setRoom(false)}
/* the lobby crowd: canteen sellers, queues, friends chatting. Only exists (and only costs anything) while the couple is in the lobby. The counter itself is left out of the obstacles so the sellers can stand behind it. */
const crowd=createLobbyCrowd(scene,gl,{y0:floorY(DOOR_Z),DOOR_Z,boxes:hall.lobby.boxes.filter(b=>b.x1-b.x0<9),LW,LD,audio,hall});crowd.setActive(true);
const SONGS=[1,2,3,4].map(i=>`/audio/lobby-${i}.mp3`),CROWD='/audio/hall-crowd.mp3';
// loudness of the two layers in each place. outside = lobby / canteen, in = inside the hall, watch = while the movie plays
const MIX={out:{songs:.25,crowd:0},in:{songs:.25,crowd:.5},watch:{songs:0,crowd:0}};
const stepSfx=who=>{const d=who===me?0:Math.hypot(who.pos.x-me.pos.x,who.pos.z-me.pos.z);audio.step(who.pos.z>DOOR_Z+.05?'floor':'carpet',who===me?.9:Math.max(0,.75-d*.09))};   // partner steps get quieter with distance
const spawn=(kind,h,color,x)=>{const p=new Player(makeAvatar(gl[kind],{height:h,walker:true,relaxed:true,style:kind==='cf'?'f':'m'}),color);scene.add(p.group);p.pos.set(x,floorY(DOOR_Z+1.9),DOOR_Z+1.9);p.group.rotation.y=Math.PI;return p};
let me=null,partner=null,role=0,sync=null,partnerSeat=null,doorOpen=false;hall.lobbyMode=true;                                   // the hall starts with the couple outside, in the lobby
let bagPrev={popcorn:false,drink:false};
const canteen=createCanteen({canGift:()=>!!sync?.present,sfx:n=>audio[n]?.(),
 onBag(st){if(!me)return;if(st.popcorn!==bagPrev.popcorn){me.setPop(st.popcorn);sync?.send({t:'pop',on:st.popcorn})}if(st.drink!==bagPrev.drink)me.setDrink(st.drink);bagPrev={...st};buttons()},
 onGift:items=>sync?.send({t:'order',items}),
 onOrder:()=>crowd.orderPlaced(me?.pos.x??0),
 onReady:(order,kinds,mine)=>{if(mine)hall.lobby.showTray(kinds);crowd.orderReady(me?.pos.x??0)},
 onClose:()=>{if(m.state===S.DOOR)hint(LOBBY_TIP)}});
const LOBBY_TIP='Walk anywhere (WASD / tap the floor) · stand at the counter to order · walk through the door to go in';
const COL={1:0xff5c8a,2:0x4db2ff},KIND={1:['cf',1.68],2:['cm',1.8]},LX={1:-.5,2:.5};
let doorIdle=0;
const openDoor=()=>{if(doorOpen)return Promise.resolve();doorOpen=true;doorIdle=0;hall.doorTo(true,1);audio.doorPush();return new Promise(r=>setTimeout(r,650))};   // pushed open; resolves once it is nearly wide
const closeDoor=()=>{if(!doorOpen)return;doorOpen=false;hall.doorTo(false)};hall.onDoorShut=()=>audio.doorShut();
const doorLogic=dt=>{if(!doorOpen)return;const near=p=>p&&(p===me||p.group.visible)&&Math.abs(p.pos.z-DOOR_Z)<1.3&&Math.abs(p.pos.x)<1.7;doorIdle=near(me)||near(partner)||m.state===S.ENTER?0:doorIdle+dt;if(doorIdle>1.5)closeDoor()};   // the closer shuts it once nobody is in the doorway
const pushHands=p=>{if(!p)return;const dz=p.pos.z-DOOR_Z,want=p.av.walk&&dz>-.3&&dz<.8&&Math.abs(p.pos.x)<1.2&&hall.doorAngle()<hall.doorOpenAngle*.8;if(want)p.av.act='push';else if(p.av.act==='push')p.av.act=''};   // arms forward while pushing the door
const fsOn=()=>document.documentElement.requestFullscreen?.().catch(()=>{}),fsOff=()=>document.fullscreenElement&&document.exitFullscreen();
/* state machine drives everything */
let lit=1;const fade=(to,ms)=>{const a=lit;return tween(ms,u=>{lit=a+(to-a)*u;hall.setLights(lit)})};
const m=createMachine(S.DOOR);let mySeat=null,pending=null,view='follow';
let watchView='screen';                                           // the view you picked for watching; comes back after pause / break
const setView=(v,o)=>{view=v;rig.setMode(v,o);if(me)me.group.visible=!(v==='pov:me'&&mySeat);buttons()};   // first-person seat view hides your own avatar
/* camera angles you can cycle through with the camera button: the seat views + a diagonal + free 360° */
const CYCLE=[...VIEWS.map(v=>v.id).filter(id=>id!=='flat'),'side','orbit'],LBL={side:'Diagonal',orbit:'360°',screen:'Screen',full:'Full screen',...Object.fromEntries(VIEWS.map(v=>[v.id,v.label]))},viewLabel=()=>LBL[view]||'View';
const nextAngle=()=>{const v=CYCLE[(CYCLE.indexOf(view)+1)%CYCLE.length];watchView=v;setView(v,v==='orbit'?{yaw:Math.PI,pitch:.35,dist:4.5,auto:true}:undefined)};
const bar=$('bar'),tip=t=>$('tip').textContent=t||'';
const HINTS=false,hint=t=>tip(HINTS?t:'');          // set HINTS=true to bring back the how-to-play lines at the top
/* every control is an icon-only button (the name is only a tooltip / screen-reader label) */
const tipify=el=>{if(el&&el.title){el.dataset.tip=el.ariaLabel=el.title;el.removeAttribute('title')}};
const RAIL=[$('cb'),$('snd'),$('leave')];RAIL.forEach(tipify);   // grabbed once: bar.innerHTML='' detaches them, and $() can no longer find detached nodes
const B=(icon,title,fn,cls)=>{const b=document.createElement('button');b.textContent=icon;b.dataset.tip=b.ariaLabel=title;b.onclick=fn;if(cls)b.className=cls;bar.appendChild(b);return b};
function buttons(){bar.innerHTML='';const s=m.state;
 if(s===S.EXPLORE&&pending)B('🪑','Sit here',sitDown,'main');
 if(s===S.SEATED){const wait2=sync?.present&&!partnerSeat;B(wait2?'⏳':'🎬',wait2?'Waiting for partner to sit':'Start movie',()=>m.go(S.WATCH),'main').disabled=wait2;B('🧍','Stand up',standUp)}
 if([S.WATCH,S.PAUSED,S.BREAK].includes(s)){B(s===S.WATCH?'⏸':'▶',s===S.WATCH?'Pause':'Play',()=>m.go(s===S.WATCH?S.PAUSED:S.WATCH),'main');B('🎥','Next camera angle · '+viewLabel(),nextAngle);B('⛶','Full screen · choose a view',openViews);B(movie.muted?'🔇':'🔊',movie.muted?'Sound off':'Sound on',()=>{movie.muted=!movie.muted;buttons()});B('☕','Break',()=>m.go(S.BREAK))}
 if(me&&m.is(S.SEATED,S.WATCH,S.PAUSED,S.BREAK))B('🍿',me.popcorn?'Put popcorn away':'Popcorn',togglePop,me.popcorn?'on':'');
 if(me&&!m.is(S.DOOR,S.ENTER,S.END)){B('❤️','Send love',()=>emote('heart'));B('👋','Wave',()=>emote('wave'));B('👏','Clap',()=>emote('clap'))}
 if([S.EXPLORE,S.SEATED].includes(s))bar.appendChild(fileLabel);      // while watching, the player's More menu holds the file picker
 if(me&&!m.is(S.DOOR,S.ENTER)){bar.append(...RAIL)}          // chat / alerts / leave live in the same right-hand rail
 if(view==='full'){bar.innerHTML='';B('✕','Exit full screen',exitFull)}}
m.on(async(s,p)=>{const ui=$('door-ui'),ov=$('ov');ui.style.display=s===S.DOOR?'flex':'none';ov.style.display='none';hall.lobbyMode=s===S.DOOR;crowd.setActive(s===S.DOOR||s===S.ENTER);if(s!==S.DOOR&&canteen.isOpen)canteen.close();
 if(s===S.DOOR){setView('door');tip();closeDoor()}
 if(s===S.ENTER){tip('');setView('follow',{yaw:0,pitch:.55,dist:4});hall.lobby.hideTray();await me.walk([[LX[role],DOOR_Z+.6]]);openDoor();await me.walk([[LX[role],DOOR_Z-1.1]],.85);m.go(S.EXPLORE)}   // walk up, hands reach the door and push it, walk through
 if(s===S.EXPLORE){hall.setRoom(true);hint('WASD / arrows or tap the floor to walk · drag to look · tap a seat');if(p===S.SEATED)setView('follow',{pitch:.55,dist:4})}
 if(s===S.SEATED){setView('seat',{yaw:Math.PI*.15,pitch:.4,dist:3.2});hint(sync?.present?'You are seated. Start when you are both seated.':'You are seated. Start the movie when ready.')}
 if(s===S.WATCH){const first=p===S.SEATED;tip('');if(first){fade(.07,1800);await wait(500);tween(2600,u=>hall.setCurtains(u))}else fade(.07,900);if(!['orbit','full'].includes(view)||p!==S.WATCH)setView(watchView)}
 if(s===S.PAUSED){fade(.4,900);setView('couple')}
 if(s===S.BREAK){fade(1,1200);setView('couple');ov.innerHTML='☕ Break time<br><small style="font-size:14px;color:#a79ebf">Resume when you are back</small>';ov.style.display='flex'}
 if(s===S.END){fade(1,2500);setView('couple');ov.innerHTML='The End ♥';const a=document.createElement('button');a.textContent='↻ Watch again';a.className='main';a.onclick=()=>{hall.setCurtains(1);m.go(S.WATCH)};const l=document.createElement('button');l.textContent='✕ Leave theatre';l.onclick=()=>{markEnded();sync?.close();if(!leaveApp())location.reload()};ov.append(a,l);ov.style.display='flex'}
 buttons()});
/* ---- studio (outside the theatre, before joining) ---- */
const stEl=$('st'),fadeEl=$('fade');stEl.style.display='block';
function leaveStudio(){fadeEl.classList.add('on');setTimeout(()=>{studio.on=false;stEl.style.display='none';fadeEl.classList.remove('on')},560)}
$('st-anim').onclick=()=>studio.wave();
$('st-spin').onclick=e=>e.currentTarget.classList.toggle('on',studio.toggleSpin());
document.querySelectorAll('#st-rail [data-v]').forEach(b=>b.onclick=()=>{studio.view(b.dataset.v);document.querySelectorAll('#st-rail [data-v]').forEach(x=>x.classList.toggle('on',x===b))});
$('st-png').onclick=async()=>{const bl=await studio.png();if(!bl)return;const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='our-twin-cinemas.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
/* ---- lobby movie frames: the couple's Twin Hearts library; details card when you stand in front of a frame ---- */
// Twin Hearts hands over THIS phone's Movie -> Library in the link (&lib=). Without it (older app / Android) fall back to the server list.
const libLoad=async()=>{if(APP&&APP.lib){hall.lobby.frames.set(APP.lib);return}const l=await fetchLibrary();hall.lobby.frames.set(l,APP?'err':'app')};libLoad();setInterval(()=>{if(!(APP&&APP.lib))libLoad()},90000);
const mvc=document.createElement('div');mvc.id='mv-card';document.body.appendChild(mvc);let mvId=null;
const STAT={watchlist:'Watchlist',watching:'Watching',watched:'Watched'},OWN={my:'❤️ Mine',partner:"💜 Partner's",both:'💕 Together'};
function mvCard(mv){const id=mv?mv.id:null;if(id===mvId)return;mvId=id;mvc.classList.toggle('on',!!mv);if(!mv){return}
 mvc.textContent='';const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
 if(/^https?:\/\//i.test(mv.posterUrl||'')){const i=el('img');i.src=mv.posterUrl;i.alt='';i.referrerPolicy='no-referrer';mvc.appendChild(i)}
 const b=el('div','mv-b');b.appendChild(el('h3',0,mv.title));
 const meta=[mv.year,mv.genre].filter(Boolean).join(' · ');if(meta)b.appendChild(el('div','mv-m',meta));
 const r=el('div','mv-r');if(mv.rating!=null&&mv.rating!=='')r.appendChild(el('span','mv-s','★ '+(+Number(mv.rating).toFixed(1))+(mv.max?'/'+mv.max:'')));if(mv.fav)r.appendChild(el('span','mv-s','⭐ Favourite'));if(STAT[mv.status])r.appendChild(el('span','mv-t',STAT[mv.status]));if(OWN[mv.owner])r.appendChild(el('span','mv-o',OWN[mv.owner]));if(r.children.length)b.appendChild(r);
 b.appendChild(el('p',0,mv.overview||'No review or description yet.'));mvc.appendChild(b)}
/* actions */
let blocked=false,atCounter=false;
const startEnter=()=>{if(blocked||m.state!==S.DOOR)return;audio.ambient(.05);m.go(S.ENTER)};
const walkToCounter=()=>{target={x:role===1?-.9:.9,z:DOOR_Z+COUNTER_Z}};
const stat=t=>$('dstat').textContent=t||'';
let lost=null;
async function partnerSit(id){const seat=hall.seats.get(id);if(!seat||!partner||partnerSeat?.id===id)return;if(mySeat?.id===id){if(role>3-role)lost=id;return}partnerSeat=seat;hall.taken.add(id);hall.setSeatHighlight(id,COL[3-role]);partner.busy=true;buttons();
 if(m.is(S.DOOR,S.ENTER)||partner.pos.z>DOOR_Z+.1)partner.snapSit(seat);else{await partner.walk(hall.route(partner.pos,seat));await partner.sit(seat)}buttons()}
async function partnerStand(){const s=partnerSeat;if(!s)return;partnerSeat=null;hall.taken.delete(s.id);hall.setSeatHighlight(s.id,0);await partner.stand(s);partner.busy=false;buttons()}
const snap=()=>({x:me.pos.x,z:me.pos.z,r:me.group.rotation.y,w:me.av.walk?1:0,s:mySeat?.id||null,pc:me.popcorn?1:0,dr:me.drink?1:0});
async function join(r){if(role)return;role=r;leaveStudio();audio.init();vol.show();audio.music(SONGS);audio.crowd(CROWD);audio.mix(MIX.out,2);crowd.active&&audio.murmur(.08);$('door-ui').classList.add('joined');const code=$('room').value.trim()||location.hash.slice(1)||'lobby';history.replaceState(0,'','#'+code);
 document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('on',+b.dataset.r===r));$('room').disabled=true;stat('Connecting…');
 const mk=q=>{const[k,h]=KIND[q],p=spawn(k,h,COL[q],LX[q]);p.onStep=stepSfx;return p};me=mk(r);partner=mk(3-r);partner.group.visible=false;
 setView('follow',{yaw:0,pitch:.5,dist:4.5});canteen.showBag(true);hint(LOBBY_TIP);
 sync=await createSync(code,r,{
  onJoin(){partner.group.visible=true;stat('Your partner is in the lobby ♥');hint(m.state===S.DOOR?LOBBY_TIP:'');buttons()},
  onHello(){sync?.send({t:'pos',...snap()});if(APP&&inv?.isStarted())sync?.send({t:'go'});if(movie.meta)sync?.send({t:'meta',meta:movie.meta})},onMsg,
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
const same=(a,b)=>a&&b&&(APP||a.size===b.size)&&Math.abs(a.dur-b.dur)<(APP?4:2);      // from Twin Hearts the match is by length (same as the Watch Together page)
const checkMeta=()=>{if(movie.meta&&partnerMeta)tip(same(movie.meta,partnerMeta)?'Both of you have the same movie ♥':'Heads up: your partner picked a different file, so you will not see the same movie');else if(movie.meta&&sync?.present)tip('Waiting for your partner to choose the same movie file')};
function onMsg(q){if(q.t==='ctl'){if(Math.abs(movie.time-q.vt)>.5)movie.seek(q.vt);applying=true;m.go(q.s);applying=false}
 else if(q.t==='seek')movie.seek(q.vt);else if(q.t==='sync'){if(role===2&&m.state===S.WATCH&&q.pl)movie.correct(q.vt)}
 else if(q.t==='meta'){partnerMeta=q.meta;if(partnerMeta)checkMeta()}
 else if(q.t==='chat'){show(partner,q.x);audio.chat()}else if(q.t==='pop')partner.setPop(q.on),buttons();else if(q.t==='emo')doEmote(partner,q.e);else if(q.t==='order')canteen.receive(q.items||[]);else if(q.t==='go'&&APP)inv?.onGo();else if(q.t==='meme')memes?.remote(q.id,q.p)}
const fileLabel=document.createElement('label');fileLabel.className='btn';fileLabel.innerHTML='🎞<input type="file" accept="video/*">';fileLabel.dataset.tip=fileLabel.ariaLabel='Choose movie file';
let minfo=null,badFile='';        // minfo = the movie you picked in Twin Hearts (null when the cinema is opened on its own)
async function loadFile(f){if(!f)return;try{const meta=await movie.load(f);badFile='';if(minfo&&minfo.dur&&Math.abs(meta.dur-minfo.dur)>3){badFile='That file is a different length than the movie you picked in Twin Hearts. Choose the same version.';movie.src=false}sync?.send({t:'meta',meta:movie.src?meta:null});tip(badFile||'Loaded '+meta.name);if(movie.src)checkMeta()}catch(err){tip(err.message)}}
fileLabel.querySelector('input').onchange=e=>loadFile(e.target.files[0]);
async function loadCloud(){try{const meta=await movie.loadUrl(minfo.url,minfo.title||'Movie');sync?.send({t:'meta',meta});checkMeta();tip('Movie ready ♥')}catch(err){minfo={...minfo,mode:'device'};tip(err.message+' — choose your own copy of the file instead')}}
const movieReady=()=>!minfo||minfo.mode==='none'||(movie.src&&(minfo.mode==='cloud'||(partnerMeta&&same(movie.meta,partnerMeta))));
m.on((s,p)=>{if(s===S.WATCH){if(movie.src){hall.setScreenMap(movie.tex);hall.fitScreen(movie.aspect)}if(p===S.END||p===S.SEATED)movie.seek(0);if(p===S.SEATED)setTimeout(()=>m.state===S.WATCH&&movie.play(),3200);else movie.play()}else if(s===S.PAUSED||s===S.BREAK)movie.pause();
 if(s!==S.WATCH&&fullOn)exitFull();if(s===S.DOOR||s===S.ENTER||s===S.EXPLORE||s===S.SEATED)movie.pause();
 if(!applying&&sync&&[S.WATCH,S.PAUSED,S.BREAK,S.END].includes(s))sync.send({t:'ctl',s,vt:movie.time});
 $('seek').style.display=[S.WATCH,S.PAUSED,S.BREAK].includes(s)?'flex':'none'});
movie.onend=()=>{if(m.state===S.WATCH)m.go(S.END)};
movie.onblocked=()=>{const ov=$('ov');ov.innerHTML='';const b=document.createElement('button');b.className='main';b.textContent='▶ Tap to join the movie';b.onclick=()=>{ov.style.display='none';movie.play()};ov.appendChild(b);ov.style.display='flex'};
function enterFull(){if(movie.src){fullOn=true;placeChat();movie.v.className='fullvid';fv.querySelector('.slot').appendChild(movie.v);fv.style.display='flex';showCtl()}else setView('full');fsOn()}
function exitFull(){if(fullOn){fullOn=false;placeChat();fv.style.display='none';movie.v.className='hv';document.body.appendChild(movie.v);fsOff()}else if(view==='full'){fsOff();setView(watchView)}else fsOff()}
addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&(fullOn||view==='full')){if(fullOn){fullOn=false;fv.style.display='none';movie.v.className='hv';document.body.appendChild(movie.v)}else setView(watchView)}});
let hideT;const showCtl=()=>{fc.classList.add('show');clearTimeout(hideT);hideT=setTimeout(()=>fc.classList.remove('show'),3000)};
fv.addEventListener('pointerdown',showCtl);$('fp').onclick=()=>m.go(S.PAUSED);$('fx').onclick=()=>{exitFull();if(view==='full')setView(watchView)};$('fm').onclick=()=>{movie.muted=!movie.muted;$('fm').textContent=movie.muted?'🔇':'🔊'};
const doSeek=v=>{movie.seek(v/1000*movie.dur);sync?.send({t:'seek',vt:movie.time})};$('sk').oninput=e=>doSeek(+e.target.value);$('fsk').oninput=e=>doSeek(+e.target.value);
/* ---- full screen button -> popup with 10 ways to watch from a seat (live thumbnails of the real theatre) ---- */
const vw=$('vw'),vg=$('vw-g'),cards=new Map(),thumbCam=new THREE.PerspectiveCamera(55,16/9,.1,80),TW=384,TH=216;
for(const v of VIEWS){const b=document.createElement('button'),c=document.createElement('canvas');c.width=TW;c.height=TH;b.className='vw-c';b.title=b.ariaLabel=v.label;
 b.append(c);b.insertAdjacentHTML('beforeend',`<i>${v.icon}</i><span>${v.label}</span>`);b.onclick=()=>pickView(v.id);vg.appendChild(b);cards.set(v.id,{b,c})}
const curId=()=>fullOn||view==='full'?'flat':view;
function renderThumbs(){if(vw.style.display==='none'||!me)return;const pr=renderer.getPixelRatio(),vis=me.group.visible;
 try{renderer.setPixelRatio(1);renderer.setSize(TW,TH,false);        // tiny offscreen-sized renders, copied straight into each card, then the real view is restored in the same tick
  for(const v of VIEWS){rig.poseFor(v.id==='flat'?'full':v.id,thumbCam);me.group.visible=v.id!=='pov:me';renderer.render(scene,thumbCam);cards.get(v.id).c.getContext('2d').drawImage(renderer.domElement,0,0,TW,TH)}}
 catch(e){console.warn('thumbs',e)}finally{me.group.visible=vis;renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera)}}
function openViews(){if(!me)return;vw.style.display='flex';for(const[id,{b}]of cards)b.classList.toggle('on',id===curId());setTimeout(renderThumbs,60)}
function closeViews(){vw.style.display='none'}
function pickView(id){closeViews();
 if(id==='flat'){if(!fullOn)enterFull();return}                      // the classic flat full-screen video
 if(fullOn){fullOn=false;placeChat();fv.style.display='none';movie.v.className='hv';document.body.appendChild(movie.v)}
 watchView=id;setView(id);if(!document.fullscreenElement)fsOn()}
$('vw-x').onclick=closeViews;$('vw-fs').onclick=()=>document.fullscreenElement?fsOff():fsOn();vw.onclick=e=>{if(e.target===vw)closeViews()};$('fview').onclick=openViews;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key;
 if(vw.style.display==='flex'){if(k==='Escape')closeViews();else if(/^[0-9]$/.test(k)){const v=VIEWS[(+k+9)%10];if(v)pickView(v.id)}}
 else if(k==='v'&&me&&m.is(S.WATCH,S.PAUSED,S.BREAK))openViews()});
/* ---- cinema media player (src/controls.js): the bottom controls while the movie plays, is paused or on a break ---- */
const chatLog=[];                                   // activity (play / pause / break…) and chat, shown by the Log button
function logAdd(k,x,mine){chatLog.push({k,x,mine,vt:movie.time});if(chatLog.length>200)chatLog.shift();pl.logUpdated(!mine)}
const seekTo=t=>{movie.seek(t);sync?.send({t:'seek',vt:movie.time})};
const pl=createPlayer({movie,fmt,
 present:()=>!!sync?.present,busy:()=>chatOpen,
 playPause:()=>m.go(m.state===S.WATCH?S.PAUSED:S.WATCH),
 skip:d=>seekTo(movie.time+d),
 seekFrac:f=>seekTo(f*(movie.dur||0)),
 syncNow:()=>sync?.send({t:'ctl',s:m.state,vt:movie.time}),      // your partner jumps to your time and state
 end:()=>m.go(S.END),
 seatView:()=>{const v=view==='screen'?'pov:me':'screen';watchView=v;setView(v)},   // "<": screen <-> your own seat
 full:{is:()=>!!document.fullscreenElement||fullOn||view==='full',toggle:()=>document.fullscreenElement||fullOn||view==='full'?exitFull():fsOn()},
 mute:{get:()=>movie.muted,set:v=>{movie.muted=v}},
 more:()=>[['🎥 Next camera · '+viewLabel(),nextAngle],['🪟 Choose a view',openViews],
  [m.state===S.BREAK?'▶ End the break':'☕ Take a break',()=>m.go(m.state===S.BREAK?S.WATCH:S.BREAK)],
  ['🍿 '+(me?.popcorn?'Put popcorn away':'Popcorn'),togglePop],[muted?'🔔 Alerts on':'🔕 Alerts off',toggleAlerts],['🎚 Sound mixer',()=>vol.toggle()],['🎵 Music on/off',()=>audio.musicToggle()],['⏭ Next song',()=>audio.next()],['🚪 Leave theatre',leaveTheatre]],
 reactions:()=>[['❤️','Send love',()=>emote('heart')],['👋','Wave',()=>emote('wave')],['👏','Clap',()=>emote('clap')],['🍿',me?.popcorn?'Put popcorn away':'Popcorn',togglePop]],
 log:()=>chatLog,extra:fileLabel,
 hooks:{message:()=>toggleChat()}});                                // voice / video: not built yet, the player shows "coming soon"
m.on((s,p)=>{const who=applying?'Your partner':'You',vt=movie.time;
 pl.setState(s,p,applying?'partner':'you');
 if(s===S.WATCH)logAdd('sys',p===S.SEATED?'The movie started':p===S.PAUSED?`${who} resumed`:p===S.BREAK?`${who} ended the break`:p===S.END?'Watching again':'Playing',!applying);
 else if(s===S.PAUSED)logAdd('sys',`${who} paused`,!applying);
 else if(s===S.BREAK)logAdd('sys',`${who} started a break`,!applying);
 else if(s===S.END)logAdd('sys',p===S.WATCH&&vt>=(movie.dur||0)-1.5?'The movie ended':`${who} ended the movie`,!applying)});
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
function show(p,x){logAdd('chat',x,p===me);if(m.state===S.WATCH)feed(p===me,x);else say(p,x);if(p!==me&&!chatOpen&&m.state!==S.WATCH)cb.classList.add('new');if(p!==me&&!chatOpen)pl.setBadge('message',true)}
function placeChat(){const tops=[$('seek')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().top).concat(pl.bottomTop()??[]),top=fullOn?innerHeight-70:Math.min(innerHeight-14,...tops);
 chatEl.style.bottom=(innerHeight-top+8)+'px';msgs.style.bottom=(innerHeight-top+8+(chatOpen?48:0))+'px'}
function chatShot(){if(!chatOpen||m.is(S.WATCH,S.DOOR,S.ENTER))return;if(chatCam===null)chatCam=view;m.state===S.EXPLORE?setView('follow',{pitch:.3,dist:2.7}):setView('chat')}
function openChat(){if(chatOpen||!me||m.is(S.DOOR,S.ENTER))return;chatOpen=true;cb.classList.remove('new');pl.setBadge('message',false);chatEl.style.display='flex';chatShot();placeChat();setTimeout(()=>$('ci').focus(),60)}
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
function leaveTheatre(){if(confirm('Leave the theatre?')){markEnded();sync?.close();if(!leaveApp())location.reload()}}$('leave').onclick=leaveTheatre;let muted=false;function toggleAlerts(){muted=!muted;audio.mute(muted);$('snd').textContent=muted?'🔕':'🔔'}$('snd').onclick=toggleAlerts;
m.on((s,p)=>{$('top-r').style.display=s===S.DOOR?'none':(s===S.ENTER?'none':'flex');$('joy').style.display=s===S.EXPLORE&&matchMedia('(pointer:coarse)').matches?'block':'none';
 audio.ambient(s===S.WATCH?.015:.05);audio.mix(s===S.WATCH?MIX.watch:m.is(S.DOOR,S.ENTER)?MIX.out:MIX.in,s===S.WATCH?3:2);if(s===S.END)audio.chime()});
{const joy=$('joy'),kn=joy.firstElementChild,mv=e=>{const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+55),dy=e.clientY-(r.top+55),d=Math.hypot(dx,dy),k=d>45?45/d:1;kn.style.transform=`translate(${dx*k}px,${dy*k}px)`;jx=dx*k/45;jz=dy*k/45};
 joy.addEventListener('pointerdown',e=>{joy.setPointerCapture(e.pointerId);mv(e)});joy.addEventListener('pointermove',e=>{if(e.buttons||e.pressure)mv(e)});const up=()=>{jx=jz=0;kn.style.transform=''};joy.addEventListener('pointerup',up);joy.addEventListener('pointercancel',up)}
/* ---- smoothness: adaptive render scale. Watches the real frame time; if the device can't hold ~60 fps it quietly lowers the resolution a notch
   (and raises it again when there's headroom), so walking and camera moves stay fluid on any screen. ---- */
let fAcc=0,fN=0,calm=0,slow=0,cap=PR_MAX;const applyPR=()=>{renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight)};
function perf(raw,t){if(raw>.3||t<3){fAcc=fN=0;return}fAcc+=raw;fN++;if(fAcc<1.2)return;const fps=fN/fAcc;fAcc=fN=0;
 if(fps<42&&pr>PR_MIN+.01){slow++;if(slow>=2){slow=0;cap=pr*.97;pr=Math.max(PR_MIN,pr*(fps<30?.85:.92));calm=0;applyPR()}}
 else if(fps>57){slow=0;calm++;if(calm>=3&&pr<cap-.01){pr=Math.min(cap,pr*1.08);calm=0;applyPR()}else if(calm>=10&&pr>=cap-.01&&cap<PR_MAX){cap=Math.min(PR_MAX,cap*1.06);calm=0}}else calm=0}
const UI={sk:$('sk'),fsk:$('fsk'),tc:$('tc'),ftc:$('ftc'),td:$('td'),tcT:'',tdT:''};let lastUI=0,lastScr=0,shAcc=1;const moving=p=>p.av.walk||p.script||p.av.wave>0||(p.av.sit>0&&p.av.sit<1);
const clock=new THREE.Clock(),V3=new THREE.Vector3();
renderer.setAnimationLoop(()=>{const raw=clock.getDelta(),dt=Math.min(raw,.05),t=clock.elapsedTime;if(document.hidden)return;perf(raw,t);
 if(me&&(m.state===S.EXPLORE||(m.state===S.DOOR&&!canteen.isOpen))&&!me.script&&!me.seated){const ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+jx,iz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+jz;let dx=0,dz=0;
  let k=1;
  if(ix||iz){target=null;const fx=-Math.sin(rig.vy),fz=-Math.cos(rig.vy);dx=fx*-iz-fz*ix;dz=fz*-iz+fx*ix;k=Math.min(1,Math.hypot(ix,iz))}
  else if(target){dx=target.x-me.pos.x;dz=target.z-me.pos.z;const d=Math.hypot(dx,dz);if(d<.12){target=null;dx=dz=0}else k=Math.max(.3,Math.min(1,d/1.1))}
  me.move(dx,dz,dt,hall,k)}
 if(me&&m.state===S.DOOR&&!me.script&&!canteen.isOpen&&!me.seated){const lx=me.pos.x,lz=me.pos.z-DOOR_Z,nearC=lz>COUNTER_Z-.7&&Math.abs(lx)<3.5;
  if(nearC&&!atCounter){atCounter=true;target=null;me.face(0,1);canteen.open();crowd.greet(me.pos.x)}else if(!nearC&&lz<COUNTER_Z-1.4)atCounter=false;
  if(lz<1.25&&Math.abs(lx)<1&&role&&!APP)startEnter()}
 movie.tick(dt);const now=performance.now();if(role===1&&sync?.present&&m.state===S.WATCH&&now-lastSync>3000){lastSync=now;sync.send({t:'sync',vt:movie.time,pl:movie.playing})}
 if(movie.dur&&now-lastUI>200){lastUI=now;const v=movie.time/movie.dur*1000,tc=fmt(movie.time),td=fmt(movie.dur);if(!UI.sk.matches(':active'))UI.sk.value=v;if(!UI.fsk.matches(':active'))UI.fsk.value=v;
  if(UI.tcT!==tc){UI.tcT=tc;UI.tc.textContent=UI.ftc.textContent=tc}if(UI.tdT!==td){UI.tdT=td;UI.td.textContent=td}pl.tick()}
 hall.doorTick(dt);doorLogic(dt);pushHands(me);pushHands(partner);chatter.update(dt,t,m.is(S.WATCH));aud.forEach(a=>a.update(dt,t));if(me){me.update(dt,t);partner.update(dt,t);rig.ctx.me.copy(me.pos);rig.ctx.couple.copy(me.pos);if(partner.group.visible)rig.ctx.couple.add(partner.pos).multiplyScalar(.5);sync?.tick(performance.now(),me.av.walk,snap)}{const cx=rig.ctx,[sw,sh]=hall.dims();cx.sw=sw;cx.sh=sh;cx.sy=hall.screen.position.y;if(me){cx.chatT.copy(me.pos);if(partner.group.visible&&me.pos.distanceTo(partner.pos)<2.6)cx.chatT.add(partner.pos).multiplyScalar(.5);if(now-lastPlace>1000){lastPlace=now;placeChat()}}}
 rig.ctx.seated=!!(me&&me.seated);rig.ctx.taken=hall.taken;rig.ctx.mine=mySeat?.id||null;rig.ctx.lobbyY=floorY(DOOR_Z);rig.ctx.lobby=m.state===S.DOOR;if(m.is(S.DOOR,S.ENTER)){hall.lobby.update(t);crowd.update(dt,t,camera,[me,partner&&partner.group.visible?partner:null])}
 {const fr=hall.lobby.frames,k=m.state===S.DOOR&&me&&!me.seated?fr.near(me.pos):-1;fr.hold=k>=0;mvCard(k>=0?fr.movie(k):null)}
 bubbleTick(now);if(!(movie.src&&m.is(S.WATCH,S.PAUSED,S.BREAK,S.END))&&now-lastScr>66){lastScr=now;hall.drawScreen(t,m.is(S.WATCH,S.PAUSED,S.BREAK),movie.dur?movie.time/movie.dur:0)}
 rig.update(dt,t);
 if(studio.on){renderer.shadowMap.autoUpdate=true;shAcc=1;studio.render(dt,t)}
 else{renderer.shadowMap.autoUpdate=false;shAcc+=dt;const dyn=!!me&&(moving(me)||(partner.group.visible&&moving(partner)));
  if(m.state!==S.DOOR&&(dyn||shAcc>=(m.is(S.WATCH)?.5:.25))){shAcc=0;renderer.shadowMap.needsUpdate=true}renderer.render(scene,camera)}
 });
addEventListener('pointerdown',()=>{audio.init();audio.music(SONGS);audio.crowd(CROWD);crowd.active&&audio.murmur(.08)},{once:true,capture:true});
let inv=null,memes=null;
memes=createMemes({audio,send:m=>sync?.send(m),present:()=>!!sync?.present});     // the 😂 meme-sound button (studio, lobby, hall)
await wait(300);$('loading').classList.add('off');m.go(S.DOOR);setView('door');$('door-ui').style.display='flex';
addEventListener('beforeunload',()=>sync?.close());
if(APP){mountOrient();await join(APP.slot);inv=mountInvite({sync:()=>sync,enter:startEnter,stat,movie:()=>({info:minfo,loaded:movie.src,ready:movieReady(),bad:badFile,pick:loadFile})});
 minfo=await fetchMovieInfo();if(minfo?.mode==='cloud')loadCloud();      // opened from Twin Hearts: avatar + room are already decided
 handshake(f=>{if(f&&!movie.src)loadFile(f)})}                            // inside the app's frame: reuse the file picked on Watch Together (no second choose-movie)
