// Tiny synthesized sound kit (no audio files): room tone, door, chat blip, crunch, chime. Call audio.init() from a user gesture.
let ctx,master,amb,musicGain,bgmEl,bgmOn=false,bgmVol=0,padNodes=null,bgmTarget=0,stepFlip=0;
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
/* ---- background music: a looping file (public/audio/theatre-bgm.mp3). If the file is missing, a soft synthesized pad plays instead. ---- */
function pad(){if(padNodes)return;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;const out=ctx.createGain();out.gain.value=.5;lp.connect(out).connect(musicGain);
 const chords=[[130.8,164.8,196,246.9],[110,138.6,164.8,207.7],[87.3,130.8,174.6,220],[98,123.5,146.8,196]],oscs=[];
 chords[0].forEach((fq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=i%2?'triangle':'sine';o.frequency.value=fq;g.gain.value=.18;o.connect(g).connect(lp);o.start();oscs.push(o);
  const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=.07+i*.03;lg.gain.value=.08;l.connect(lg).connect(g.gain);l.start()});
 let c=0;const iv=setInterval(()=>{if(!ctx)return;c=(c+1)%chords.length;oscs.forEach((o,i)=>o.frequency.setTargetAtTime(chords[c][i],ctx.currentTime,2.5))},9000);padNodes={oscs,iv}}
function startMusic(url){if(!ctx||bgmOn)return;bgmOn=true;
 if(!url){pad();return}
 bgmEl=new Audio(url);bgmEl.loop=true;bgmEl.preload='auto';bgmEl.crossOrigin='anonymous';
 try{ctx.createMediaElementSource(bgmEl).connect(musicGain)}catch(e){bgmEl.volume=.5}
 bgmEl.addEventListener('error',()=>{bgmEl=null;pad()},{once:true});
 bgmEl.play().catch(()=>{})}
export const audio={
 init(){if(ctx){ctx.resume();return}ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.6;master.connect(ctx.destination);musicGain=ctx.createGain();musicGain.gain.value=0;musicGain.connect(master);
  const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const n=ctx.createBufferSource();n.buffer=b;n.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=180;amb=ctx.createGain();amb.gain.value=0;n.connect(f).connect(amb).connect(master);n.start()},
 step,
 /** start the music (call after audio.init, from a user gesture). url = optional file; omit for the built-in pad */
 music(url){startMusic(url);bgmEl?.play().catch(()=>{})},
 /** music loudness 0..1 (keep it low, ~0.1), eased over `s` seconds */
 musicVol(v,s=1.5){bgmTarget=v;musicGain&&musicGain.gain.setTargetAtTime(v,ctx.currentTime,s/3)},
 musicToggle(){const on=musicGain&&musicGain.gain.value>.001;this.musicVol(on?0:(this._mv||.1),.6);return !on},
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
