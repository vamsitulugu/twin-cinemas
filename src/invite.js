// Twin Hearts hand-off ("app mode"). The Twin Hearts app opens the cinema with
//   #s=<session id>&r=<1|2 avatar>&n=<my name>&c=<couple id>&u=<user1|user2>&h=<1 host|0 guest>&b=<back url>
// The session id becomes the private room code, the avatar is chosen for you (no Person 1/2 screen),
// and the lobby shows Invite / Start for the host and a waiting message for the guest.
// Without those params the cinema behaves exactly as before (manual room + Person 1/2).
import {ONLINE} from './net.js';
const API=(import.meta.env&&import.meta.env.VITE_API_BASE)||'https://us-app-av6d.onrender.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function read(){
 try{const q=new URLSearchParams(location.hash.slice(1)),s=q.get('s'),r=+q.get('r');
  if(!UUID.test(s||'')||(r!==1&&r!==2))return null;
  let back=null;try{const u=new URL(q.get('b')||'');if(/^https?:$/.test(u.protocol))back=u.href}catch(e){}
  const a={invited:q.get('i')==='1',session:s,slot:r,name:(q.get('n')||'').slice(0,30),couple:q.get('c')||'',user:q.get('u')||'',host:q.get('h')==='1',back};
  if(!a.couple||!/^user[12]$/.test(a.user))return null;
  history.replaceState(0,'',location.pathname+'#'+s);   // couple id never stays in the address bar / history; the room code stays
  return a}catch(e){return null}}
export const APP=read();                                 // null = normal (manual) mode
const post=(path,body)=>fetch(API+'/api/cinema/'+APP.session+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({coupleId:APP.couple,role:APP.user,...body}),keepalive:true}).then(r=>r.json().then(j=>({ok:r.ok,j})));
/** What movie did the two of you pick in Twin Hearts Watch Together? -> {mode:'cloud',title,dur,url} | {mode:'device',title,dur} | {mode:'none'} | null */
export async function fetchMovieInfo(){if(!APP)return null;
 try{const r=await fetch(API+'/api/cinema/'+APP.session+'/movie?coupleId='+encodeURIComponent(APP.couple)+'&role='+APP.user,{cache:'no-store'});return r.ok?await r.json():null}catch(e){return null}}
export const markEnded=()=>{if(APP&&APP.host)post('/status',{status:'ended'}).catch(()=>{})};
/** ctx: {sync:()=>sync|null, enter:()=>void, stat:(text)=>void, movie:()=>({info,loaded,ready,pick(file)})} */
export function mountInvite(ctx){
 if(!APP)return;
 const el=document.createElement('div');el.id='inv';document.body.appendChild(el);
 const btn=(t,fn,main)=>{const b=document.createElement('button');b.textContent=t;b.onclick=fn;if(main)b.className='main';return b};
 document.body.classList.add('app');                      // hides the old one-line status; this panel replaces it
 let phase=APP.invited?'invited':'lobby',msg='',inviting=false,started=false,poll=null;       // phase: lobby | invited | declined | expired
 const here=()=>!!ctx.sync()?.present;
 const mv=()=>ctx.movie?.()||{};
 const needsPick=()=>{const m=mv();return m.info&&m.info.mode==='device'&&!m.loaded};
 function status(){
  const m=mv();if(ONLINE&&m.info&&m.info.mode!=='none'){
   if(needsPick())return m.bad||'Choose your copy of “'+(m.info.title||'the movie')+'” (the same one you picked in Twin Hearts)';
   if(m.loaded&&!m.ready&&here())return m.bad||'Waiting for your partner to choose the movie…'}
  if(!ONLINE)return'⚠ Live sync is not set up yet (missing Supabase keys) — your partner cannot join';
  if(msg)return msg;
  if(here())return APP.host?'Your partner is here ♥ Press Start when you are both ready':'You are in! Waiting for the host to start the movie…';
  if(APP.host)return phase==='invited'?'Invite sent — waiting for your partner to accept…':phase==='declined'?'Your partner is not available right now':phase==='expired'?'The invite expired — send it again':'You are in the lobby. Invite your partner to join you';
  return'Waiting for the host…'}
 function render(){
  if(started){el.style.display='none';return}
  el.style.display='flex';el.textContent='';
  const t=document.createElement('div');t.className='inv-t';t.textContent=status();el.appendChild(t);
  const row=document.createElement('div');row.className='inv-r';el.appendChild(row);
  if(needsPick()){const l=document.createElement('label');l.className='pick';l.textContent='🎞 Choose movie file';const i=document.createElement('input');i.type='file';i.accept='video/*';i.onchange=()=>{const f=i.files[0];if(f)ctx.movie().pick(f)};l.appendChild(i);row.appendChild(l)}
  if(APP.host){
   if(!here())row.appendChild(btn(inviting?'Sending…':phase==='lobby'?'💌 Invite partner':phase==='invited'?'💌 Invite again':'💌 Send invite again',invite,true)).disabled=inviting||!ONLINE;
   else{const b=row.appendChild(btn('▶ Start movie night',start,true));const m=mv();b.disabled=!!(m.info&&m.info.mode!=='none'&&!m.ready)}
  }
  if(APP.back){const a=document.createElement('a');a.href=APP.back;a.textContent='← Twin Hearts';a.className='inv-b';row.appendChild(a)}}
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
