// Tiny synthesized sound kit (no audio files): room tone, door, chat blip, crunch, chime. Call audio.init() from a user gesture.
let ctx,master,amb;
const env=(g,t,a,d)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d)};
function tone(f,d,type='sine',a=.2,t0=0,to){if(!ctx)return;const t=ctx.currentTime+t0,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);env(g,t,a,d);o.connect(g).connect(master);o.start(t);o.stop(t+d+.05)}
function burst(d,a=.3,f=3000,t0=0){if(!ctx)return;const t=ctx.currentTime+t0,n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*d,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;n.buffer=b;
 const fl=ctx.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;const g=ctx.createGain();env(g,t,a,d);n.connect(fl).connect(g).connect(master);n.start(t)}
export const audio={
 init(){if(ctx){ctx.resume();return}ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.6;master.connect(ctx.destination);
  const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const n=ctx.createBufferSource();n.buffer=b;n.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=180;amb=ctx.createGain();amb.gain.value=0;n.connect(f).connect(amb).connect(master);n.start()},
 ambient(v){amb&&amb.gain.setTargetAtTime(v,ctx.currentTime,.8)},
 mute(m){if(master)master.gain.value=m?0:.6},
 door(){tone(110,.9,'sawtooth',.08,0,55);burst(.5,.12,400,.1)},
 chat(){tone(880,.12,'sine',.12);tone(1320,.14,'sine',.08,.07)},
 crunch(){for(let i=0;i<4;i++)burst(.07,.25,2500+Math.random()*2000,i*.11)},
 chime(){tone(523,1.2,'sine',.15);tone(659,1.2,'sine',.12,.18);tone(784,1.6,'sine',.12,.36)},
 heart(){tone(660,.2,'triangle',.1,0,990)}};
