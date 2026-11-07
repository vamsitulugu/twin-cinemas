/* ------------------------------------------------------------------
   Cinema media player UI. Shown while the movie is playing, paused or on a break.
   Working now: play/pause, -10/+10, seek, sound, full screen, camera view, Sync, End, More.
   UI only (waiting for Twin Hearts): Message, Log, Voice, Video, 😊 reactions. They call c.hooks.<name>().
   Use the returned setActive(name,bool) / setBadge(name,bool) to light a button or show its red dot.
------------------------------------------------------------------- */
const ic=(p,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON={
 back:'<polyline points="15 18 9 12 15 6"/>',
 full:'<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
 small:'<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
 vol:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
 mute:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
 play:'<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"/>',
 pause:'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
 ccw:'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
 cw:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
 sync:'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
 msg:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
 log:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
 video:'<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
 end:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
 more:'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/** c = { movie, fmt, present(), toast(text), playPause(), skip(sec), seekFrac(0..1), syncNow(), end(), seatView(),
           full:{is(),toggle()}, mute:{get(),set(bool)}, more():[[label,fn]...], extra: HTMLElement|null, hooks:{message,log,voice,video,emoji} } */
export function createPlayer(c){
 const {movie,fmt}=c,hk=c.hooks||{};let st='door',by='you',panel=null,hideT=0,seeking=false,lastTitle='',lastIcons='';
 const el=document.createElement('div');el.id='player';
 el.innerHTML=`
  <div class="pl-top"><button class="ib" data-a="back" title="Switch camera: seat / screen">${ic(ICON.back,26)}</button>
   <div class="pl-title"><b></b><span class="pill"></span></div>
   <div class="pl-tr"><button class="ib" data-a="mute" title="Sound (M)"></button><button class="ib" data-a="full" title="Full screen (F)"></button></div></div>
  <div class="pl-mid"><button class="skip" data-a="b10" title="Back 10 s (←)">${ic(ICON.ccw,44)}<i>10</i></button><button class="big" data-a="play" title="Play / pause (space)"></button><button class="skip" data-a="f10" title="Forward 10 s (→)">${ic(ICON.cw,44)}<i>10</i></button></div>
  <button class="pl-emoji" data-a="emoji" title="Reactions">😊</button>
  <div class="pl-bot"><div class="pl-seek"><span class="tc">0:00</span><input class="sk" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="td">0:00</span></div>
   <div class="pl-row">
    <button class="tb" data-a="sync" title="Sync the movie with your partner">${ic(ICON.sync)}<span>Sync</span></button>
    <button class="tb" data-a="message">${ic(ICON.msg)}<span>Message</span><i class="dot"></i></button>
    <button class="tb" data-a="log">${ic(ICON.log)}<span>Log</span><i class="dot"></i></button>
    <button class="tb" data-a="voice">${ic(ICON.phone)}<span>Voice</span></button>
    <button class="tb" data-a="video">${ic(ICON.video)}<span>Video</span></button>
    <button class="tb" data-a="end" title="End the movie">${ic(ICON.end)}<span>End</span></button>
    <button class="tb" data-a="more">${ic(ICON.more)}<span>More</span></button></div></div>
  <div class="pnl" data-p="more"></div>`;
 document.body.appendChild(el);
 const q=s=>el.querySelector(s),sk=q('.sk');

 /* visibility: fades out while playing, any tap / move / key brings it back */
 const on=()=>['watch','paused','break'].includes(st);
 function show(){if(!on())return;el.classList.remove('hide');document.body.classList.remove('pl-hide');clearTimeout(hideT);
  if(st==='watch'&&!panel&&!seeking)hideT=setTimeout(()=>{el.classList.add('hide');document.body.classList.add('pl-hide')},3500)}
 for(const e of['pointerdown','pointermove','keydown','wheel'])addEventListener(e,()=>show(),{passive:true,capture:true});

 /* labels */
 const who=b=>b==='partner'?'Partner':'You';
 const pill=()=>st==='watch'?'Playing'+(c.present()?'':' · watching alone'):st==='paused'?`Paused by ${who(by)}`:st==='break'?`Break · ${who(by)}`:'';
 function refresh(){q('.pill').textContent=pill();q('.pill').dataset.s=st;
  const name=movie.meta?.name?movie.meta.name.replace(/\.[^.]+$/,''):'Demo movie',full=c.full.is(),muted=c.mute.get(),playing=st==='watch';
  if(name!==lastTitle){lastTitle=name;q('.pl-title b').textContent=name}
  const k=[playing,full,muted].join();if(k!==lastIcons){lastIcons=k;
   q('.big').innerHTML=ic(playing?ICON.pause:ICON.play,40);q('[data-a=full]').innerHTML=ic(full?ICON.small:ICON.full,22);q('[data-a=mute]').innerHTML=ic(muted?ICON.mute:ICON.vol,22)}}
 function setState(s,prev,b){st=s;if(b)by=b;document.body.classList.toggle('pl',on());el.style.display=on()?'block':'none';
  if(!on()){panel=null;renderPanel()}refresh();show()}

 /* seek + clock (call every frame) */
 function tick(){if(!on())return;const d=movie.dur||0;if(!seeking&&d){sk.value=movie.time/d*1000;q('.tc').textContent=fmt(movie.time)}
  q('.td').textContent=fmt(d);sk.style.setProperty('--p',(sk.value/10)+'%');refresh()}
 sk.addEventListener('input',()=>{seeking=true;const f=sk.value/1000;q('.tc').textContent=fmt(f*(movie.dur||0));sk.style.setProperty('--p',(sk.value/10)+'%');c.seekFrac(f);show()});
 sk.addEventListener('change',()=>{seeking=false;show()});

 /* "More" panel */
 function renderPanel(){const box=q('.pnl[data-p=more]');box.classList.toggle('open',panel==='more');q('[data-a=more]').classList.toggle('sel',panel==='more');
  if(panel==='more'){const items=c.more();box.innerHTML=items.map((m,i)=>`<button data-m="${i}">${esc(m[0])}</button>`).join('');box._items=items;if(c.extra&&st!=='watch')box.appendChild(c.extra)}}
 const toggleMore=()=>{panel=panel==='more'?null:'more';renderPanel();show()};

 /* actions */
 function act(a){switch(a){
  case'back':c.seatView();break;
  case'mute':c.mute.set(!c.mute.get());break;
  case'full':c.full.toggle();setTimeout(()=>{lastIcons='';refresh()},120);break;
  case'play':c.playPause();break;
  case'b10':c.skip(-10);break;case'f10':c.skip(10);break;
  case'sync':c.syncNow();c.toast('Synced with your partner ♥');break;
  case'end':if(confirm('End the movie for both of you?'))c.end();break;
  case'more':toggleMore();break;
  // UI only: wire these to Twin Hearts through c.hooks
  case'message':case'log':case'voice':case'video':case'emoji':hk[a]?.();break}}
 el.addEventListener('click',e=>{const mi=e.target.closest('[data-m]');if(mi){mi.closest('.pnl')._items[+mi.dataset.m][1]();panel=null;renderPanel();return}
  const b=e.target.closest('[data-a]');if(b)act(b.dataset.a)});
 addEventListener('keydown',e=>{if(!on()||e.target.tagName==='INPUT'||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
  if(k===' '||k==='k'){e.preventDefault();c.playPause()}else if(k==='arrowleft'||k==='j')act('b10');else if(k==='arrowright'||k==='l')act('f10');
  else if(k==='m')act('mute');else if(k==='f')act('full');else if(k==='escape'&&panel){panel=null;renderPanel()}});
 el.style.display='none';refresh();
 return{setState,tick,refresh:()=>{lastIcons='';refresh()},
  /** light a bottom button: setActive('voice',true) */setActive:(name,on2)=>q(`[data-a=${name}]`)?.classList.toggle('on',!!on2),
  /** red dot on Message / Log: setBadge('message',true) */setBadge:(name,on2)=>{const d=q(`[data-a=${name}] .dot`);if(d)d.style.display=on2?'block':'none'}}}
