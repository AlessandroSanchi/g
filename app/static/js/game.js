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
  document.getElementById('timer').textContent = '0.000';
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
window.addEventListener('keydown', (e)=>{ keys[e.key] = true; if(!started && isMovingKey(e.key)) startRun(); });
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
  let dx=0, dy=0; const s = player.speed;
  if(keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= s*dt;
  if(keys['ArrowRight'] || keys['d'] || keys['D']) dx += s*dt;
  if(keys['ArrowUp'] || keys['w'] || keys['W']) dy -= s*dt;
  if(keys['ArrowDown'] || keys['s'] || keys['S']) dy += s*dt;
  // simple bounded movement (no internal obstacles)
  player.x = Math.max(0, Math.min(W - player.w, player.x + dx));
  player.y = Math.max(0, Math.min(H - player.h, player.y + dy));
  if(!started && (dx!==0 || dy!==0)) startRun();

  updateEnemies(dt);
  updateBullets(dt);

  // collisions with enemies
  for(const e of enemies){
    if(circleRectCollision(e, player)){
      if(started){
        elapsed = (performance.now() - startTime)/1000.0;
        sendScore(elapsed);
      }
      resetPlayer(); document.getElementById('status').textContent = 'Hit! Back to center.'; return;
    }
  }
  // collision with bullets
  for(const b of bullets){ if(circleRectCollisionBullet(b, player)){ if(started){ elapsed = (performance.now() - startTime)/1000.0; sendScore(elapsed);} resetPlayer(); document.getElementById('status').textContent = 'Hit by bullet!'; return; } }

  if(started){ elapsed = (performance.now() - startTime)/1000.0; document.getElementById('timer').textContent = elapsed.toFixed(3); }
}

// Drawing
function draw(){
  // background gradient
  const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0f1720'); g.addColorStop(1,'#081018');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // arena is clear (decorations and obstacles removed)

  // finish zone
  ctx.fillStyle = '#2d7b2d'; ctx.fillRect(finishZone.x, finishZone.y, finishZone.w, finishZone.h);

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
function updateLeaderboard(){ fetch('/api/leaderboard?limit=10').then(r=>r.json()).then(data=>{ const el = document.getElementById('leaderboardList'); el.innerHTML = ''; data.forEach(row=>{ const li = document.createElement('li'); li.textContent = `${row.username} — ${row.time}s`; el.appendChild(li); }); }); }
updateLeaderboard(); setInterval(updateLeaderboard, 5000);
