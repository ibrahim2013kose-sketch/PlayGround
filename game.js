(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const intro = document.getElementById('intro');
  const result = document.getElementById('result');
  const hud = document.getElementById('hud');
  const mobileControls = document.getElementById('mobileControls');
  const wakeFill = document.getElementById('wakeFill');
  const wakeState = document.getElementById('wakeState');
  const gateCount = document.getElementById('gateCount');
  const shardCount = document.getElementById('shardCount');
  const toast = document.getElementById('toast');
  const keys = new Set();
  const touch = { left:false,right:false,up:false,down:false,boost:false };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W=innerWidth,H=innerHeight,DPR=1,last=0,mode='menu',time=0,toastTimer=0;
  let player,objects,particles,score,shards,misses,streak,bestStreak,charge,burst,runTime,shake=0;
  let soundOn=false,audio;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rand=(a,b)=>a+Math.random()*(b-a);
  function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize);resize();
  function notify(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1250)}
  function current(){return {x:Math.sin(time*.00039)*.36+Math.sin(time*.00017)*.12,y:Math.sin(time*.00027+1.6)*.24}}
  function reset(){
    time=0;runTime=0;score=0;shards=0;misses=0;streak=0;bestStreak=0;charge=0;burst=0;shake=0;
    player={x:0,y:.47,vx:0,vy:0,tilt:0};objects=[];particles=[];
    const gatePos=[[-.3,.24],[.28,-.26],[.55,.28],[-.18,-.34],[-.58,.22],[.2,.36],[.48,-.25],[-.15,.06]];
    gatePos.forEach((p,i)=>objects.push({type:'gate',x:p[0],y:p[1],z:9+i*12.7,id:i+1,done:false}));
    const shardPos=[[-.12,.06],[.44,-.06],[-.42,-.13],[.12,.28],[-.05,-.3]];
    shardPos.forEach((p,i)=>objects.push({type:'shard',x:p[0],y:p[1],z:15+i*15.1,id:i,done:false}));
    [[.52,.15,26],[-.58,-.22,47],[.04,.02,69],[-.49,.12,87],[.55,-.2,102]].forEach((p,i)=>objects.push({type:'mine',x:p[0],y:p[1],z:p[2],id:i,done:false}));
    gateCount.textContent='00';shardCount.textContent='0';wakeFill.style.width='0%';wakeState.textContent='FIND THE CURRENT';
  }
  function start(){reset();mode='playing';intro.classList.add('hidden');result.classList.add('hidden');hud.style.opacity='1';mobileControls.hidden=false;notify('FOLLOW THE CYAN WAKE')}
  function end(won){mode=won?'won':'lost';result.classList.remove('hidden');document.getElementById('resultTitle').textContent=won?'EXPANSE CONQUERED':'FLIGHT ENDED';document.getElementById('resultCopy').textContent=won?(shards>=5?'Five shards. Eight gates. The skyway is yours.':'You found the way through. Bring back all five shards next run.'):'The storm swallowed your line. The sky will be there tomorrow.';document.getElementById('resultGates').textContent=String(score).padStart(2,'0')+' / 08';document.getElementById('resultShards').textContent=shards+' / 5';document.getElementById('resultStreak').textContent=bestStreak+' gates';mobileControls.hidden=true;hud.style.opacity='.45'}
  document.getElementById('startButton').addEventListener('click',start);document.getElementById('againButton').addEventListener('click',start);
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Spacebar'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if((e.key==='Enter'||e.key===' ')&&(mode==='menu'||mode==='won'||mode==='lost')){if(mode==='menu')start();else start()}});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('[data-dir]').forEach(b=>{const dir=b.dataset.dir;const on=e=>{e.preventDefault();touch[dir]=true};const off=e=>{e.preventDefault();touch[dir]=false};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off)});
  const boostButton=document.getElementById('boostButton');boostButton.addEventListener('pointerdown',e=>{e.preventDefault();touch.boost=true});['pointerup','pointerleave','pointercancel'].forEach(ev=>boostButton.addEventListener(ev,e=>{e.preventDefault();touch.boost=false}));
  document.getElementById('soundButton').addEventListener('click',()=>{soundOn=!soundOn;document.querySelector('#soundButton span').textContent=soundOn?'ON':'SOUND';if(soundOn){audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume()}});
  function tone(freq=440,duration=.08,type='sine',volume=.035){if(!soundOn||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}
  function input(){return {x:(keys.has('arrowright')||keys.has('d')||touch.right?1:0)-(keys.has('arrowleft')||keys.has('a')||touch.left?1:0),y:(keys.has('arrowdown')||keys.has('s')||touch.down?1:0)-(keys.has('arrowup')||keys.has('w')||touch.up?1:0),boost:keys.has(' ')||keys.has('space')||touch.boost}}
  function update(dt){time+=dt*1000;if(mode!=='playing')return;runTime+=dt;
    const inp=input();const accel=3.0;player.vx+=(inp.x*accel-player.vx*3.1)*dt;player.vy+=(inp.y*accel-player.vy*3.1)*dt;player.x=clamp(player.x+player.vx*dt,-.86,.86);player.y=clamp(player.y+player.vy*dt,-.59,.66);player.tilt+=(inp.x*.45-player.tilt)*Math.min(1,dt*6);
    const wind=current(),onWake=Math.hypot(player.x-wind.x,player.y-wind.y)<.22;
    if(onWake){charge=clamp(charge+dt*34,0,100);if(charge===100&&wakeState.textContent!=='BURST READY')notify('WAKE CHARGED — RELEASE A BURST')}
    else charge=clamp(charge-dt*13,0,100);
    if(inp.boost&&charge>=100&&burst<=0){charge=0;burst=2.15;tone(190,.32,'sawtooth',.06);notify('WAKE BURST!')}
    if(burst>0)burst=Math.max(0,burst-dt);
    wakeFill.style.width=charge+'%';wakeState.textContent=burst>0?'BURST ACTIVE':charge>=100?'BURST READY':onWake?'RIDING THE CURRENT':'FIND THE CURRENT';
    const speed=(burst>0?9.8:6.5);const travel=speed*dt;
    for(const o of objects){if(o.done)continue;o.z-=travel;
      if(o.type==='gate'&&o.z<=.22){o.done=true;const d=Math.hypot((player.x-o.x)/.36,(player.y-o.y)/.58);if(d<1){score++;streak++;bestStreak=Math.max(streak,bestStreak);gateCount.textContent=String(score).padStart(2,'0');tone(490+score*38,.13,'triangle');notify(['CLEAN LINE','GATE CLEARED','NICE FLIGHT'][score%3]);if(score>=8){end(true);break}}else{misses++;streak=0;shake=12;tone(95,.25,'sawtooth',.06);notify('GATE MISSED · '+(3-misses)+' LIVES LEFT');if(misses>=3){end(false);break}}}
      if(o.type==='shard'&&o.z<=.28){o.done=true;if(Math.hypot(player.x-o.x,player.y-o.y)<.3){shards++;shardCount.textContent=shards;tone(750,.18,'sine');notify('SUN SHARD '+shards+' / 5')} }
      if(o.type==='mine'&&o.z<=.25){o.done=true;if(Math.hypot(player.x-o.x,player.y-o.y)<.25){misses++;streak=0;shake=15;tone(78,.35,'sawtooth',.07);notify('STORM MINE · '+(3-misses)+' LIVES LEFT');if(misses>=3){end(false);break}}}
    }
    if(burst>0&&Math.random()<.7)particles.push({x:player.x+rand(-.04,.04),y:player.y+rand(-.05,.05),life:.4,max:.4});
    for(const p of particles)p.life-=dt;particles=particles.filter(p=>p.life>0);objects=objects.filter(o=>!o.done&&o.z>-2);if(shake>0)shake=Math.max(0,shake-dt*26);
  }
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
  function poly(points,color){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=color;ctx.fill()}
  function background(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#142d43');sky.addColorStop(.38,'#416777');sky.addColorStop(.66,'#b1aa91');sky.addColorStop(1,'#425c5e');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const sunX=W*.73,sunY=H*.25,sunR=Math.min(W,H)*.09;let glow=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,sunR*2.7);glow.addColorStop(0,'rgba(255,230,175,.75)');glow.addColorStop(.22,'rgba(255,211,154,.28)');glow.addColorStop(1,'rgba(255,208,156,0)');ctx.fillStyle=glow;ctx.fillRect(sunX-sunR*3,sunY-sunR*3,sunR*6,sunR*6);ctx.beginPath();ctx.arc(sunX,sunY,sunR*.46,0,Math.PI*2);ctx.fillStyle='rgba(255,232,189,.75)';ctx.fill();
    // Distant layered mesas and drifting cloud banks.
    const horizon=H*.48;for(let layer=0;layer<3;layer++){const y=horizon+layer*H*.047;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,y+20);for(let x=0;x<=W+40;x+=40){const peak=Math.sin(x*.006+layer*2.4)*14+Math.sin(x*.017+layer)*7;ctx.lineTo(x,y+peak+Math.sin(x*.0014+layer)*17)}ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=['rgba(33,62,70,.36)','rgba(26,52,61,.42)','rgba(13,38,48,.5)'][layer];ctx.fill()}
    // Long cloud streaks.
    for(let i=0;i<8;i++){const yy=H*(.25+i*.045)+Math.sin(time*.00016+i)*5;const xx=((i*203-time*(.006+i*.0008))%(W+300)+W+300)%(W+300)-150;ctx.fillStyle=`rgba(234,231,207,${.055+(i%3)*.016})`;ctx.beginPath();ctx.ellipse(xx,yy,90+i%3*45,4+i%2*3,-.03,0,Math.PI*2);ctx.fill()}
    // Perspective wind-road rails.
    const vanishX=W*.5,vanishY=horizon+H*.025;for(let i=-5;i<=5;i++){const bx=W*.5+i*W*.105;line(vanishX+((bx-W*.5)*.045),vanishY,bx,H*1.03,i===0?'rgba(181,226,204,.16)':'rgba(172,216,198,.085)',i===0?1.2:1)}
    for(let i=1;i<9;i++){let p=((i*.13+time*.00015)%1);let yy=vanishY+(H-vanishY)*p*p;line(W*.12,yy,W*.88,yy,`rgba(201,235,211,${.035+p*.055})`,1)}
    // Moving current stream, curving into the horizon.
    ctx.save();ctx.globalCompositeOperation='screen';for(let side=-1;side<=1;side+=2){ctx.beginPath();for(let j=0;j<=32;j++){const z=23*(j/32),w=current(),curve=Math.sin(time*.00025+z*.18)*.06;const x=w.x+curve+side*(.08+z*.008),y=w.y+Math.cos(time*.00021+z*.2)*.025;const sc=1/(1+z*.075);const px=W*.5+x*W*.36*sc,py=vanishY+(y*H*.28)*sc+(H*.30)*sc;if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.strokeStyle=side<0?'rgba(86,246,225,.2)':'rgba(105,246,226,.33)';ctx.lineWidth=side<0?2:1.5;ctx.shadowColor='#69f6e2';ctx.shadowBlur=15;ctx.stroke()}ctx.restore();
  }
  function project(o){const scale=1/(1+o.z*.075);return {x:W*.5+o.x*W*.36*scale,y:H*.48+o.y*H*.28*scale+(H*.30)*scale,s:scale}}
  function drawGate(o){const p=project(o),rx=W*.125*p.s,ry=H*.17*p.s;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.sin(time*.0005+o.id)*.025);ctx.shadowBlur=22*p.s;ctx.shadowColor='#c5ffe7';ctx.strokeStyle=`rgba(205,250,222,${.52+.16*Math.sin(time*.006)})`;ctx.lineWidth=Math.max(1.5,5*p.s);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(93,243,222,.76)';ctx.lineWidth=Math.max(1,1.3*p.s);ctx.setLineDash([8*p.s,7*p.s]);ctx.beginPath();ctx.ellipse(0,0,rx*.83,ry*.87,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(229,246,224,.8)';ctx.font=`${Math.max(7,10*p.s)}px DM Mono,monospace`;ctx.textAlign='center';ctx.fillText(String(o.id).padStart(2,'0'),0,-ry-8*p.s);ctx.restore()}
  function drawShard(o){const p=project(o),r=Math.max(2,10*p.s),spin=time*.002+o.id;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(spin);ctx.shadowColor='#ffc77b';ctx.shadowBlur=18*p.s;ctx.fillStyle='#ffce86';ctx.beginPath();ctx.moveTo(0,-r*1.45);ctx.lineTo(r*.62,0);ctx.lineTo(0,r*1.45);ctx.lineTo(-r*.62,0);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,.82)';ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.22,0);ctx.lineTo(0,r*.72);ctx.lineTo(-r*.22,0);ctx.fill();ctx.restore()}
  function drawMine(o){const p=project(o),r=Math.max(3,12*p.s);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*.001);ctx.shadowColor='#ff806f';ctx.shadowBlur=18*p.s;ctx.strokeStyle='rgba(255,139,112,.9)';ctx.lineWidth=Math.max(1,2*p.s);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*r*.8,Math.sin(a)*r*.8,Math.cos(a)*r*1.55,Math.sin(a)*r*1.55,'rgba(255,151,121,.8)',Math.max(1,1.5*p.s))}ctx.fillStyle='#ffae85';ctx.beginPath();ctx.arc(0,0,r*.23,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawPlayer(){const px=W*.5+player.x*W*.27,py=H*.48+player.y*H*.34;ctx.save();ctx.translate(px,py);ctx.rotate(player.tilt);const glow=burst>0?'#9ffff0':'#bdf4de';ctx.shadowColor=glow;ctx.shadowBlur=burst>0?28:12;
    // Wing silhouette and kite-sail rider.
    ctx.fillStyle=burst>0?'#b8fff0':'#e9eee0';ctx.beginPath();ctx.moveTo(-2,3);ctx.lineTo(-W*.075,-3);ctx.lineTo(-W*.036,5);ctx.lineTo(-6,8);ctx.lineTo(0,5);ctx.lineTo(6,8);ctx.lineTo(W*.036,5);ctx.lineTo(W*.075,-3);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(22,52,61,.7)';ctx.lineWidth=1;line(-W*.048,1,0,5,'rgba(22,52,61,.7)',1);line(W*.048,1,0,5,'rgba(22,52,61,.7)',1);ctx.fillStyle='#f4bf83';ctx.beginPath();ctx.arc(0,-1,3.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(244,191,131,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,11);ctx.stroke();
    if(burst>0){ctx.strokeStyle='rgba(105,246,226,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(-10,22+Math.random()*8);ctx.moveTo(6,10);ctx.lineTo(10,22+Math.random()*8);ctx.stroke()}
    ctx.restore();
  }
  function drawParticles(){for(const p of particles){const x=W*.5+p.x*W*.27,y=H*.48+p.y*H*.34;ctx.globalAlpha=p.life/p.max;ctx.fillStyle='#82ffea';ctx.beginPath();ctx.arc(x,y,2.4*(p.life/p.max),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  function drawScene(){ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));background();if(mode==='playing'||mode==='won'||mode==='lost'){const visible=[...objects].sort((a,b)=>b.z-a.z);for(const o of visible){if(o.z<0)continue;if(o.type==='gate')drawGate(o);else if(o.type==='shard')drawShard(o);else drawMine(o)}drawParticles();drawPlayer()}else{player=player||{x:.12,y:.42,tilt:.04};drawPlayer()}ctx.restore()}
  function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);drawScene();requestAnimationFrame(frame)}
  reset();requestAnimationFrame(frame);
})();
