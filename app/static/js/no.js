// Survival-style World's Hardest Game clone
// Controls: arrows or WASD
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Player spawns in the middle of the arena
const player = { x: W/2 - 15, y: H/2 - 15, w: 30, h: 30, speed: 220 };
let keys = {};

// No explicit start zone: we start centered and timer begins on first move
const finishZone = { x: W - 80, y: H/2 - 60, w: 70, h: 120 };

// Decorations and obstacles removed for now — simpler open arena
const obstacles = []; // kept as empty array to avoid runtime errors if referenced
const decorations = [];

// Enemies
const enemies = [];
const bullets = [];

// Enemy factory: spawn outside canvas and aim inward
function spawnEnemy(type, minDist = 140){
  // types: 'green' (normal), 'blue' (small fast), 'red' (big slow), 'purple' (shooter)
  const side = Math.floor(Math.random()*4); // 0=top,1=right,2=bottom,3=left
  let x,y;
  // sometimes spawn just inside the screen edge for more on-screen action
  const insideChance = 0.35;
  if(Math.random() < insideChance){
    if(side===0){ x = Math.random()*W; y = 10 + Math.random()*60; }
    else if(side===1){ x = W - (10 + Math.random()*60); y = Math.random()*H; }
    else if(side===2){ x = Math.random()*W; y = H - (10 + Math.random()*60); }
    else { x = 10 + Math.random()*60; y = Math.random()*H; }
  } else {
    if(side===0){ x = Math.random()*W; y = -30; }
    else if(side===1){ x = W + 30; y = Math.random()*H; }
    else if(side===2){ x = Math.random()*W; y = H + 30; }
    else { x = -30; y = Math.random()*H; }
  }

  // choose properties
  let r = 18, speed = 60, color = '#4caf50', shoot=false;
  if(type==='green'){ r = 20; speed = 60; color='#4caf50'; }
  if(type==='blue'){ r = 10; speed = 160; color='#3aa0ff'; }
  if(type==='red'){ r = 28; speed = 40; color='#d32f2f'; }
  if(type==='purple'){ r = 16; speed = 50; color='#8e24aa'; shoot=true; }

  // ensure spawn is not too close to the player spawn (center)
  const cx = W/2, cy = H/2;
  let dx0 = x - cx, dy0 = y - cy;
  let dist0 = Math.sqrt(dx0*dx0 + dy0*dy0) || 0.0001;
  if(dist0 < minDist){
    // push spawn outward along the same direction (or random if exactly center)
    let angle = Math.atan2(dy0, dx0);
    if(dist0 < 0.001) angle = Math.random()*Math.PI*2;
    x = cx + Math.cos(angle)*(minDist + 30 + Math.random()*60);
    y = cy + Math.sin(angle)*(minDist + 30 + Math.random()*60);
  }

  // compute normalized velocity towards a random point near center (so they enter arena)
  const targetX = W/2 + (Math.random()*200 - 100);
  const targetY = H/2 + (Math.random()*200 - 100);
  const dx = targetX - x; const dy = targetY - y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const vx = (dx/dist) * speed;
  const vy = (dy/dist) * speed;

  const enemy = { x, y, r, vx, vy, color, type, shootCooldown: Math.random()*2+1 };
  enemies.push(enemy);
  try{ spawnMarkers.push({ x: enemy.x, y: enemy.y, created: performance.now(), duration: 1000, color: '#ffcc00', type }); } catch(e){}
  return enemy;
}

function populateEnemies(){
  enemies.length = 0;
  // spawn a mix, keeping them away from the center spawn
  for(let i=0;i<4;i++) spawnEnemy('green', 140);
  for(let i=0;i<4;i++) spawnEnemy('blue', 140);
  for(let i=0;i<3;i++) spawnEnemy('red', 140);
  spawnEnemy('purple', 140);
}
populateEnemies();

// Timer & game state
let started = false;
let startTime = 0;
let elapsed = 0;
let running = true;
let timeStopped = false; // when true, enemies/bullets/spawns freeze but loop continues
let timeStopStart = null;
let elapsedAtStop = 0;
const timeStopCooldown = 10000; // ms
let lastTimeStopUsed = (performance && performance.now) ? (performance.now() - timeStopCooldown) : -timeStopCooldown;
let godMode = false;
const spawnMarkers = []; // temporary markers to show spawn locations: {x,y,created,duration,color}

let lastTs = null;

function resetPlayer(){
  player.x = W/2 - player.w/2;
  player.y = H/2 - player.h/2;
  started = false; startTime = 0; elapsed = 0;
  // clear bullets and enemies and respawn away from center
  bullets.length = 0;
  enemies.length = 0;
  populateEnemies();
  // reset spawn timer so there's no immediate crowding
  spawnTimer = 0;
  document.getElementById('timer').textContent = '0.00';
}
resetPlayer();

// Collision helpers
function rectsOverlap(a, b){
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function circleRectCollision(circle, rect){
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX; const dy = circle.y - closestY;
  return (dx*dx + dy*dy) < (circle.r * circle.r);
}

function circleRectCollisionBullet(bullet, rect){
  const closestX = Math.max(rect.x, Math.min(bullet.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(bullet.y, rect.y + rect.h));
  const dx = bullet.x - closestX; const dy = bullet.y - closestY;
  return (dx*dx + dy*dy) < (bullet.r * bullet.r);
}

// Input
window.addEventListener('keydown', (e)=>{
  const k = e.key;
  keys[k] = true;
  if(!started && isMovingKey(k)) startRun();
  // Time-stop toggle (P): freeze enemies/bullets/spawn but keep loop running
  if(k === 'p' || k === 'P'){
    const now = performance.now();
    // if currently not stopped, only allow activation when cooldown passed
    if(!timeStopped){
      if(now - lastTimeStopUsed >= timeStopCooldown){
        timeStopped = true;
        timeStopStart = now;
        elapsedAtStop = elapsed;
        lastTimeStopUsed = now; // start cooldown from activation
      } else {
        // ability still on cooldown - ignore input
      }
    } else {
      // deactivate time-stop
      timeStopped = false;
      if(timeStopStart){ startTime += (performance.now() - timeStopStart); timeStopStart = null; }
      lastTs = null;
    }
  }
  // Reset (R)
  if(k === 'r' || k === 'R'){
    populateEnemies(); resetPlayer(); running = true; timeStopped = false; bullets.length = 0;
    const st = document.getElementById('status'); if(st) st.textContent = '';
  }
});
window.addEventListener('keyup', (e)=>{ keys[e.key] = false; });
function isMovingKey(k){ return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(k); }
function startRun(){ if(!started){ started = true; startTime = performance.now(); } }

// Reset button
document.getElementById('resetBtn').addEventListener('click', ()=>{ populateEnemies(); resetPlayer(); running = true; document.getElementById('status').textContent = ''; bullets.length = 0; });

// Enemy behaviors and bullets
function updateEnemies(dt){
  // scale speed with elapsed time (survival difficulty)
  const speedMult = 1 + Math.min(3, elapsed/20); // cap multiplier
  for(const e of enemies){
    e.x += e.vx * dt * speedMult; e.y += e.vy * dt * speedMult;
    // simple wandering for green
    if(e.type === 'green' && Math.random() < 0.005) {
      e.vx *= -1; e.vy *= -1;
    }
    // blue are fast and bounce off edges
    if(e.type === 'blue'){
      if(e.x - e.r < 0 || e.x + e.r > W) e.vx *= -1;
      if(e.y - e.r < 0 || e.y + e.r > H) e.vy *= -1;
    }
    // no internal obstacles: enemies move freely (edge behaviors handled elsewhere)
    // red slow, but push back into arena if too far
    if(e.type === 'red'){
      if(e.x < -100 || e.x > W+100 || e.y < -100 || e.y > H+100){
        // reposition to an outside edge again
        const side = Math.floor(Math.random()*4);
        if(side===0){ e.x = Math.random()*W; e.y = -80; }
        else if(side===1){ e.x = W+80; e.y = Math.random()*H; }
        else if(side===2){ e.x = Math.random()*W; e.y = H+80; }
        else { e.x = -80; e.y = Math.random()*H; }
      }
    }
    // purple shooters: periodically spawn bullets aimed at player
    if(e.type === 'purple'){
      e.shootCooldown -= dt;
      if(e.shootCooldown <= 0){
        e.shootCooldown = 1.5 + Math.random()*1.2;
        // create bullet toward player
        const dx = (player.x + player.w/2) - e.x;
        const dy = (player.y + player.h/2) - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const speed = 260;
        bullets.push({ x: e.x, y: e.y, vx: dx/dist*speed*speedMult, vy: dy/dist*speed*speedMult, r:6, color:'#b39ddb' });
      }
    }
  }
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
    // remove if out of bounds
    if(b.x < -50 || b.x > W+50 || b.y < -50 || b.y > H+50) bullets.splice(i,1);
  }
}

// Game loop update
function update(dt){
  if(!running) return;
  // spawn timer: more frequent as time passes
  if(typeof lastSpawn === 'undefined') lastSpawn = 0;
  if(typeof spawnTimer === 'undefined') spawnTimer = 0;
  // when time is stopped, avoid spawning or updating enemies/bullets
  if(!timeStopped){
    spawnTimer -= dt;
    const spawnInterval = Math.max(0.5, 3 - elapsed/25);
    if(spawnTimer <= 0){
      // spawn a random enemy; higher chance for blue/green, occasional purple
      const r = Math.random();
      if(r < 0.45) spawnEnemy('green');
      else if(r < 0.8) spawnEnemy('blue');
      else if(r < 0.95) spawnEnemy('red');
      else spawnEnemy('purple');
      spawnTimer = spawnInterval;
    }
  }
  let dx=0, dy=0; const s = player.speed;
  if(keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= s*dt;
  if(keys['ArrowRight'] || keys['d'] || keys['D']) dx += s*dt;
  if(keys['ArrowUp'] || keys['w'] || keys['W']) dy -= s*dt;
  if(keys['ArrowDown'] || keys['s'] || keys['S']) dy += s*dt;
  // simple bounded movement (no internal obstacles)
  player.x = Math.max(0, Math.min(W - player.w, player.x + dx));
  player.y = Math.max(0, Math.min(H - player.h, player.y + dy));
  if(!started && (dx!==0 || dy!==0)) startRun();

  if(!timeStopped){
    updateEnemies(dt);
    updateBullets(dt);
  }

  // collisions with enemies
  for(const e of enemies){
    if(circleRectCollision(e, player)){
      if(godMode){
        // ignore collision while in god mode
        continue;
      }
      if(started){
        const submitTime = timeStopped ? elapsedAtStop : ((performance.now() - startTime)/1000.0);
        elapsed = submitTime;
        sendScore(elapsed);
      }
      resetPlayer(); document.getElementById('status').textContent = 'Hit! Back to center.'; return;
    }
  }
  // collision with bullets
  for(const b of bullets){
    if(circleRectCollisionBullet(b, player)){
      if(godMode){
        continue;
      }
      if(started){
        const submitTime = timeStopped ? elapsedAtStop : ((performance.now() - startTime)/1000.0);
        elapsed = submitTime;
        sendScore(elapsed);
      }
      resetPlayer(); document.getElementById('status').textContent = 'Hit by bullet!'; return;
    }
  }

  if(started){
    if(!timeStopped){ elapsed = (performance.now() - startTime)/1000.0; }
    else { elapsed = elapsedAtStop; }
    const tEl = document.getElementById('timer'); if(tEl) tEl.textContent = elapsed.toFixed(2);
  }
}

// Drawing
function draw(){
  // background gradient
  const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0f1720'); g.addColorStop(1,'#081018');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  // enemies
  enemies.forEach(e=>{ ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
    // small highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.stroke();
  });

  // bullets
  bullets.forEach(b=>{ ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); });

  // player
  ctx.fillStyle = '#ff4444'; ctx.fillRect(player.x, player.y, player.w, player.h);
  // player outline
  ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.06; ctx.strokeRect(player.x, player.y, player.w, player.h); ctx.globalAlpha = 1;
  // visual effect when time is stopped: subtle purple tint + scanlines (no text)
  if(timeStopped){
    ctx.fillStyle = 'rgba(40,10,60,0.28)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for(let y=0;y<H;y+=6){ ctx.fillRect(0,y,W,1); }
  }
  // draw spawn markers (temporary !) so player sees where enemies appeared
  try{
    const now = performance.now();
    for(let i=spawnMarkers.length-1;i>=0;i--){
      const m = spawnMarkers[i];
      const age = now - m.created;
      if(age > m.duration){ spawnMarkers.splice(i,1); continue; }
      const alpha = 1 - (age / m.duration);
      ctx.globalAlpha = 0.9 * alpha;
      // small pulsing circle
      ctx.beginPath(); ctx.fillStyle = m.color || '#ffcc00'; ctx.arc(m.x, m.y, 12 + 6*(1-alpha), 0, Math.PI*2); ctx.fill();
      // exclamation mark
      ctx.fillStyle = '#000'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', m.x, m.y + 6);
      ctx.globalAlpha = 1;
    }
  } catch(e){}
  // update ability circle UI if present
  try{
    const el = document.getElementById('timeAbility');
    if(el){
      const now = performance.now();
      const pct = Math.min(1, (now - lastTimeStopUsed) / timeStopCooldown);
      const pct100 = Math.round(pct*100);
      // conic-gradient: filled portion shows cooldown progress
      el.style.background = `conic-gradient(#7b1fa2 ${pct100}%, #222 ${pct100}%)`;
      if(pct >= 1) el.classList.add('ready'); else el.classList.remove('ready');
    }
  } catch(e){ /* ignore in environments without DOM */ }
}

function loop(ts){ if(lastTs==null) lastTs = ts; const dt = Math.min(0.05, (ts - lastTs)/1000); update(dt); draw(); lastTs = ts; requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// Score submission
function sendScore(time){
  fetch('/submit_score', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time }) })
    .then(r=>{ if(r.ok) return r.json(); throw new Error('Failed to submit'); })
    .then(j=>{ document.getElementById('status').textContent = 'Score saved!'; updateLeaderboard(); })
    .catch(err=>{ document.getElementById('status').textContent = 'Could not submit score'; });
}

// Leaderboard
function updateLeaderboard(){ fetch('/api/leaderboard?limit=10').then(r=>r.json()).then(data=>{ const el = document.getElementById('leaderboardList'); el.innerHTML = ''; data.forEach(row=>{ const li = document.createElement('li'); const time = (typeof row.time === 'number') ? row.time : parseFloat(row.time); li.textContent = `${row.username} — ${isNaN(time) ? row.time : time.toFixed(2)}s`; el.appendChild(li); }); }); }
function updateLeaderboard(){
  fetch('/api/leaderboard?limit=10').then(r=>r.json()).then(data=>{
  const el = document.getElementById('leaderboardList');
  if(el){ el.innerHTML = ''; data.forEach(row=>{ const li = document.createElement('li'); const time = (typeof row.time === 'number') ? row.time : parseFloat(row.time); li.textContent = `${row.username} — ${isNaN(time) ? row.time : time.toFixed(2)}s`; el.appendChild(li); }); }
  const el2 = document.getElementById('survivalList');
  if(el2){ el2.innerHTML = ''; data.forEach(row=>{ const li = document.createElement('li'); const time = (typeof row.time === 'number') ? row.time : parseFloat(row.time); li.textContent = `${row.username} — ${isNaN(time) ? row.time : time.toFixed(2)}s`; el2.appendChild(li); }); }
  });
}
updateLeaderboard(); setInterval(updateLeaderboard, 5000);

// initialize UI bindings that require DOM to be ready
window.addEventListener('load', ()=>{
  const cb = document.getElementById('godCheckbox');
  if(cb){ cb.checked = godMode; cb.addEventListener('change', (e)=>{ godMode = !!e.target.checked; const st = document.getElementById('status'); if(st) st.textContent = godMode ? 'GOD MODE' : ''; }); }
  const timeEl = document.getElementById('timeAbility');
  if(timeEl){ timeEl.addEventListener('click', ()=>{
    const now = performance.now();
    if(!timeStopped){
      if(now - lastTimeStopUsed >= timeStopCooldown){ timeStopped = true; timeStopStart = now; elapsedAtStop = elapsed; lastTimeStopUsed = now; }
    } else {
      timeStopped = false; if(timeStopStart){ startTime += (performance.now() - timeStopStart); timeStopStart = null; } lastTs = null;
    }
  }); }
});
