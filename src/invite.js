// Twin Hearts hand-off ("app mode"). The Twin Hearts app opens the cinema with
//   #s=<session id>&r=<1|2 avatar>&n=<my name>&c=<couple id>&u=<user1|user2>&h=<1 host|0 guest>&b=<back url>
// The session id becomes the private room code, the avatar is chosen for you (no Person 1/2 screen),
// and the lobby shows Invite / Start for the host and a waiting message for the guest.
// Without those params the cinema behaves exactly as before (manual room + Person 1/2).
// mv=<url>&mn=<name> (Android app): the movie the person already picked on their phone, streamed from the app itself (virtual host below) — no second "choose movie".
// e=1 means the app opened the cinema in a full-screen frame inside its own page. Then (a) the movie file you already
// picked in Twin Hearts is handed over with postMessage (no second "choose movie"), and (b) Leave asks the app to close the frame.
import {ONLINE} from './net.js';
import {iconize} from './icons.js';
import {decodeLib} from './lib-codec.js';
export const API=(import.meta.env&&import.meta.env.VITE_API_BASE)||'https://us-app-av6d.onrender.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The Android app serves the movie file the person picked from this ONE virtual address (its WebView answers it). Nothing else is accepted.
const DEVICE_HOST='appassets.androidplatform.net';
function deviceUrl(v){try{const u=new URL(v||'');return u.protocol==='https:'&&u.hostname===DEVICE_HOST&&u.pathname.startsWith('/twin-movie')?u.href:''}catch(e){return ''}}
function read(){
 try{const q=new URLSearchParams(location.hash.slice(1)),s=q.get('s'),r=+q.get('r');
  if(!UUID.test(s||'')||(r!==1&&r!==2))return null;
  let back=null;try{const u=new URL(q.get('b')||'');if(/^https?:$/.test(u.protocol))back=u.href}catch(e){}
  let backOrigin='';try{backOrigin=new URL(back).origin}catch(e){}
  const a={invited:q.get('i')==='1',session:s,slot:r,name:(q.get('n')||'').slice(0,30),couple:q.get('c')||'',user:q.get('u')||'',host:q.get('h')==='1',back,backOrigin,embed:q.get('e')==='1'&&window.parent!==window&&!!backOrigin,lib:decodeLib(q.get('lib')),movieUrl:deviceUrl(q.get('mv')),movieName:(q.get('mn')||'').slice(0,120),};   // lib = this phone's Twin Hearts movie library (null = not sent)
  if(!a.couple||!/^user[12]$/.test(a.user))return null;
  history.replaceState(0,'',location.pathname+'#'+s);   // couple id never stays in the address bar / history; the room code stays
  return a}catch(e){return null}}
export const APP=read();                                 // null = normal (manual) mode
const post=(path,body)=>fetch(API+'/api/cinema/'+APP.session+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({coupleId:APP.couple,role:APP.user,...body}),keepalive:true}).then(r=>r.json().then(j=>({ok:r.ok,j})));
/** What movie did the two of you pick in Twin Hearts Watch Together? -> {mode:'cloud',title,dur,url} | {mode:'device',title,dur} | {mode:'none'} | null */
export async function fetchMovieInfo(){if(!APP)return null;
 try{const r=await fetch(API+'/api/cinema/'+APP.session+'/movie?coupleId='+encodeURIComponent(APP.couple)+'&role='+APP.user,{cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(20000):undefined});return r.ok?await r.json():null}catch(e){return null}}
/** The couple's Twin Hearts movie library (Movie -> Library) -> [{id,title,year,genre,posterUrl,backdropUrl,overview,rating,status}] | null if it could not be loaded */
export async function fetchLibrary(){if(!APP)return null;
 try{const r=await fetch(API+'/api/cinema/'+APP.session+'/library?coupleId='+encodeURIComponent(APP.couple),{cache:'no-store'});if(!r.ok)return null;const j=await r.json();return Array.isArray(j.movies)?j.movies:null}catch(e){return null}}
/** Gold Coins = the couple's Twin Hearts wallet. Only available when the cinema was opened from the app (APP set). The server prices and charges every order itself. */
export async function fetchBalance(){if(!APP)return null;
 try{const r=await fetch(API+'/api/cinema/'+APP.session+'/wallet?coupleId='+encodeURIComponent(APP.couple)+'&role='+APP.user,{cache:'no-store'});if(!r.ok)return null;const j=await r.json();return typeof j.balance==='number'?j.balance:null}catch(e){return null}}
/** order = {id (one per attempt, so a double tap never pays twice), for, lines:[{id,qty,sel}]} -> {ok:true,balance} | {ok:false,error,code,balance,need} */
export async function payOrder(o){const {ok,j}=await post('/canteen/order',{clientId:o.id,for:o.for,lines:o.lines});
 return ok?{ok:true,balance:j.balance}:{ok:false,error:j.error,code:j.code,balance:j.balance,need:j.need}}
export const markEnded=()=>{if(APP&&APP.host)post('/status',{status:'ended'}).catch(()=>{})};
/* ---- embedded in the Twin Hearts app (e=1): talk to the page that holds us, only ever to/from the app's own origin ---- */
const toApp=m=>{try{window.parent.postMessage({src:'twin-cinema',...m},APP.backOrigin)}catch(e){}};
/** Leave to the app: closes the frame when embedded, otherwise goes to the back link. false = nothing to go back to. */
export const leaveApp=()=>{if(!APP)return false;if(APP.embed){toApp({type:'leave'});return true}if(APP.back){location.href=APP.back;return true}return false};
let waitFile=!!(APP&&(APP.embed||APP.movieUrl));                     // true until the app has answered (file or "no file") — the lobby then says "Loading your movie…" instead of asking to choose one
/** Ask the app for the movie file it already has (the one picked on Watch Together). cb(file|null) is called once. Gives up after 8 s → the normal "choose your copy" button appears. */
/** the app's own movie has finished loading (or failed): stop saying "Loading your movie…" */
export const fileSettled=()=>{waitFile=false};
export function handshake(cb){
 if(!APP||!APP.embed)return;
 let done=false,tries=0;
 const finish=f=>{if(done)return;done=true;waitFile=false;clearInterval(t);cb(f)};
 addEventListener('message',e=>{if(e.source!==window.parent||e.origin!==APP.backOrigin)return;const d=e.data;
  if(!d||d.src!=='twin-hearts')return;
  if(d.type==='file'&&d.file instanceof Blob)finish(d.file);else if(d.type==='file-url'&&deviceUrl(d.url))finish({url:deviceUrl(d.url),name:String(d.name||'').slice(0,120)});else if(d.type==='nofile')finish(null)});
 const t=setInterval(()=>{if(done)return;if(++tries>40)return finish(null);toApp({type:'ready'})},500);   // the app might not be listening yet, so ask again
 toApp({type:'ready'})}
/** ctx: {sync:()=>sync|null, enter:()=>void, stat:(text)=>void, movie:()=>({info,loaded,ready,pick(file)})} */
export function mountInvite(ctx){
 if(!APP)return;
 const el=document.createElement('div');el.id='inv';document.body.appendChild(el);
 const btn=(t,fn,main)=>{const b=document.createElement('button');iconize(b,t);b.onclick=fn;if(main)b.className='main';return b};
 document.body.classList.add('app');                      // hides the old one-line status; this panel replaces it
 let phase=APP.invited?'invited':'lobby',msg='',inviting=false,started=false,poll=null;       // phase: lobby | invited | declined | expired
 const here=()=>!!ctx.sync()?.present;
 const mv=()=>ctx.movie?.()||{};
 const needsPick=()=>{const m=mv();return m.info&&m.info.mode==='device'&&!m.loaded&&!waitFile};
 function status(){
  const m=mv();if(ONLINE&&m.info&&m.info.mode!=='none'){
   if(m.info.mode==='device'&&!m.loaded&&waitFile)return'Loading your movie…';
   if(needsPick())return m.bad||'Choose your copy of “'+(m.info.title||'the movie')+'” (the same one you picked in Twin Hearts)';
   if(m.bad)return m.bad}
  if(!ONLINE)return'⚠ Live sync is not set up yet (missing Supabase keys) — your partner cannot join';
  if(msg)return msg;
  if(here())return APP.host?'Your partner is here ♥ Press Start when you are both ready':'You are in! Waiting for the host to start the movie…';
  if(APP.host)return phase==='invited'?'Invite sent — waiting for your partner to accept…':phase==='declined'?'Your partner is not available right now':phase==='expired'?'The invite expired — send it again':'You are in the lobby. Invite your partner to join you';
  return'Waiting for the host…'}
 function render(){
  if(started||(ctx.hidden&&ctx.hidden())){el.style.display='none';return}
  el.style.display='flex';el.textContent='';
  const t=document.createElement('div');t.className='inv-t';t.textContent=status();el.appendChild(t);
  const row=document.createElement('div');row.className='inv-r';el.appendChild(row);
  if(needsPick()){const l=document.createElement('label');l.className='pick';iconize(l,'🎞 Choose movie file');const i=document.createElement('input');i.type='file';i.accept='video/*';i.onchange=()=>{const f=i.files[0];if(f)ctx.movie().pick(f)};l.appendChild(i);row.appendChild(l)}
  if(APP.host){
   if(!here())row.appendChild(btn(inviting?'Sending…':phase==='lobby'?'💌 Invite partner':phase==='invited'?'💌 Invite again':'💌 Send invite again',invite,true)).disabled=inviting||!ONLINE;
   else{const b=row.appendChild(btn('▶ Start movie night',start,true));const m=mv();b.disabled=!!(m.info&&m.info.mode!=='none'&&!m.ready)}
  }
  if(APP.back){const a=document.createElement('a');a.href=APP.back;iconize(a,'← Twin Hearts');a.className='inv-b';if(APP.embed)a.onclick=e=>{e.preventDefault();markEnded();leaveApp()};row.appendChild(a)}}
 async function invite(){
  inviting=true;msg='';render();
  try{const r=await post('/invite',{});if(!r.ok)throw new Error(r.j&&r.j.error||'failed');phase='invited';watch()}
  catch(e){msg='Could not send the invite: '+(e.message||'check your connection')}
  inviting=false;render()}
 function watch(){clearInterval(poll);let n=0;                                  // the host sees accepted / declined without reloading
  poll=setInterval(async()=>{if(here()||started||++n>160){clearInterval(poll);return}
   try{const r=await fetch(API+'/api/cinema/'+APP.session+'?coupleId='+encodeURIComponent(APP.couple),{cache:'no-store'}),j=await r.json();
    if(j.status==='declined'||j.status==='expired'){phase=j.status;msg='';clearInterval(poll);render()}
    else if(j.status==='accepted'){msg='Your partner accepted — they are joining…';render()}}catch(e){}},3500)}
 function start(){const m=mv();if(!here()||started||(m.info&&m.info.mode!=='none'&&!m.ready))return;started=true;ctx.sync().send({t:'go'});post('/status',{status:'started'}).catch(()=>{});el.style.display='none';ctx.enter()}
 setInterval(()=>{if(!started)render()},700);render();if(APP.invited&&APP.host)watch();
 return{onGo:()=>{if(started)return;started=true;el.style.display='none';ctx.enter()},isStarted:()=>started}}
