// Tiny synthesized sound kit (no audio files): room tone, door, chat blip, crunch, chime. Call audio.init() from a user gesture.
let ctx,master,amb,musicGain,crowdGain,songEl=null,songsOn=false,crowdOn=false,stepFlip=0,mixT={songs:0,crowd:0},mixS=2,bgmScale=1,list=[],order=[],oi=0;
const env=(g,t,a,d)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d)};
function tone(f,d,type='sine',a=.2,t0=0,to){if(!ctx)return;const t=ctx.currentTime+t0,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);env(g,t,a,d);o.connect(g).connect(master);o.start(t);o.stop(t+d+.05)}
function burst(d,a=.3,f=3000,t0=0){if(!ctx)return;const t=ctx.currentTime+t0,n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*d,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;n.buffer=b;
 const fl=ctx.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;const g=ctx.createGain();env(g,t,a,d);n.connect(fl).connect(g).connect(master);n.start(t)}

/* ---- footsteps: synthesized, two surfaces. vol 0..1 (use distance for your partner), surface 'floor' (lobby) | 'carpet' (hall) ---- */
function step(surface='carpet',vol=1){if(!ctx||vol<=.01)return;const t=ctx.currentTime,fl=surface==='floor',side=(stepFlip^=1)?1:.93,j=.9+Math.random()*.2;
 const g=ctx.createGain();g.gain.value=vol*(fl?.5:.32);g.connect(master);
 // thump: a very short low tone (the heel)
 const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.setValueAtTime((fl?150:110)*side*j,t);o.frequency.exponentialRampToValueAtTime(48,t+.09);
 og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime(.9,t+.006);og.gain.exponentialRampToValueAtTime(.0001,t+.11);o.connect(og).connect(g);o.start(t);o.stop(t+.14);
 // scuff / click: filtered noise (hard floor = brighter click, carpet = soft muffled brush)
 const n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*.12,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;n.buffer=b;
 const f=ctx.createBiquadFilter();f.type=fl?'bandpass':'lowpass';f.frequency.value=(fl?2200:700)*j;f.Q.value=fl?1.2:.5;
 const ng=ctx.createGain();ng.gain.setValueAtTime(0,t);ng.gain.linearRampToValueAtTime(fl?.55:.35,t+.004);ng.gain.exponentialRampToValueAtTime(.0001,t+(fl?.05:.1));n.connect(f).connect(ng).connect(g);n.start(t)}
/* playlist: shuffled on every page load (never starts with the song that played last time), then plays on to the next song by itself, reshuffling after the last one */
function shuffle(n){const a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function startSongs(urls){if(!ctx||songsOn||!urls?.length)return;songsOn=true;list=urls;order=shuffle(list.length);
 let last=-1;try{last=+localStorage.getItem('cin_last')}catch{}
 if(order.length>1&&order[0]===last){const k=1+(Math.random()*(order.length-1)|0);[order[0],order[k]]=[order[k],order[0]]}   // refresh / re-entry -> a different first song
 oi=0;const el=songEl=new Audio();el.preload='auto';el.crossOrigin='anonymous';
 try{ctx.createMediaElementSource(el).connect(musicGain)}catch(e){}
 const play=()=>{const i=order[oi];try{localStorage.setItem('cin_last',i)}catch{}el.src=list[i];el.play().catch(()=>{})};
 el.addEventListener('ended',()=>{oi++;if(oi>=order.length){const lastI=order[order.length-1];order=shuffle(list.length);if(order.length>1&&order[0]===lastI)order.push(order.shift());oi=0}play()});
 el.addEventListener('error',()=>{if(++errs>list.length){songsOn=false;return}oi=(oi+1)%order.length;play()});let errs=0;
 play()}
/* hall crowd: one seamless loop (decoded to memory so it repeats with no gap) */
async function startCrowd(url){if(!ctx||crowdOn||!url)return;crowdOn=true;try{const buf=await ctx.decodeAudioData(await(await fetch(url)).arrayBuffer()),n=ctx.createBufferSource();n.buffer=buf;n.loop=true;n.connect(crowdGain);n.start()}catch(e){crowdOn=false;console.warn('crowd audio',e)}}
function applyMix(){if(!ctx)return;const t=ctx.currentTime,k=Math.max(.05,mixS/3);musicGain.gain.setTargetAtTime(mixT.songs*bgmScale,t,k);crowdGain.gain.setTargetAtTime(mixT.crowd*bgmScale,t,k)}
export const audio={
 init(){if(ctx){ctx.resume();return}ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.6;master.connect(ctx.destination);musicGain=ctx.createGain();musicGain.gain.value=0;musicGain.connect(master);crowdGain=ctx.createGain();crowdGain.gain.value=0;crowdGain.connect(master);applyMix();
  const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const n=ctx.createBufferSource();n.buffer=b;n.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=180;amb=ctx.createGain();amb.gain.value=0;n.connect(f).connect(amb).connect(master);n.start()},
 step,
 /** songs: array of urls (the lobby playlist). Call after audio.init(), from a tap. Safe to call again. */
 music(urls){startSongs(urls);songEl?.paused&&songEl.src&&songEl.play().catch(()=>{})},
 /** the hall crowd loop (one url) */
 crowd(url){startCrowd(url)},
 /** loudness of each layer, 0..1: audio.mix({songs:.5,crowd:0},2) eased over 2 s */
 mix(m,secs=1.5){mixT={...mixT,...m};mixS=secs;applyMix()},
 /** music + crowd on/off (the master 🔔 button mutes everything including these) */
 musicToggle(){bgmScale=bgmScale?0:1;applyMix();return !!bgmScale},
 next(){songEl&&songEl.dispatchEvent(new Event('ended'))},
 ambient(v){amb&&amb.gain.setTargetAtTime(v,ctx.currentTime,.8)},
 mute(m){if(master)master.gain.value=m?0:.6},
 door(){tone(110,.9,'sawtooth',.08,0,55);burst(.5,.12,400,.1)},
 chat(){tone(880,.12,'sine',.12);tone(1320,.14,'sine',.08,.07)},
 crunch(){for(let i=0;i<4;i++)burst(.07,.25,2500+Math.random()*2000,i*.11)},
 chime(){tone(523,1.2,'sine',.15);tone(659,1.2,'sine',.12,.18);tone(784,1.6,'sine',.12,.36)},
 heart(){tone(660,.2,'triangle',.1,0,990)},
 add(){tone(740,.08,'sine',.1);tone(990,.1,'sine',.08,.06)},
 bell(){tone(1568,.9,'sine',.12);tone(2093,.7,'sine',.06,.01)},
 gift(){tone(523,.25,'triangle',.12);tone(784,.25,'triangle',.1,.12);tone(1046,.5,'triangle',.1,.24)},
 sip(){burst(.35,.08,900);tone(300,.25,'sine',.04,.05,180)},
 bite(){burst(.09,.2,1800);burst(.08,.16,2600,.12)}};
