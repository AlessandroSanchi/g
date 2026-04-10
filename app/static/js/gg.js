// Controls: arrows or WASD
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Player
const player = { x: 40, y: H/2 - 15, w: 30, h: 30, speed: 200 };
let keys = {};

// Start & Finish zones
const startZone = { x: 10, y: H/2 - 60, w: 60, h: 120 };
const finishZone = { x: W - 80, y: H/2 - 60, w: 70, h: 120 };

// Enemies: moving circles
const enemies = [];
// boss and lasers
let boss = null; // {x,y,r,hp,vx,vy,shootCooldown}
const lasers = [];
function createEnemies(){
  enemies.length = 0;
  // a few circles moving vertically/horizontally
  enemies.push({x: 200, y: 60, r: 18, vx: 0, vy: 120});
  enemies.push({x: 340, y: 540, r: 24, vx: 0, vy: -140});
  enemies.push({x: 480, y: 150, r: 20, vx: 140, vy: 0});
  enemies.push({x: 620, y: 420, r: 22, vx: -100, vy: 0});
}
createEnemies();

// Timer
let started = false;
let startTime = 0;
let elapsed = 0;
let running = true;

// Frame timing
let lastTs = null;

function resetPlayer(){
  player.x = startZone.x + 10;
  player.y = startZone.y + (startZone.h - player.h)/2;
  started = false;
  startTime = 0;
  elapsed = 0;
  document.getElementById('timer').textContent = '0.00';
}
resetPlayer();

// Collision helpers
function rectsOverlap(a, b){
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function circleRectCollision(circle, rect){
  // find closest point
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return (dx*dx + dy*dy) < (circle.r * circle.r);
}

// Input
window.addEventListener('keydown', (e)=>{ 
  const k = e.key;
  keys[k] = true; 
  if(!started && isMovingKey(k)) startRun();
  // spawn boss manually for testing
  if(k === 'b' || k === 'B'){
    if(!boss) spawnBoss();
  }
});
window.addEventListener('keyup', (e)=>{ keys[e.key] = false; });
function isMovingKey(k){ return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(k); }

function startRun(){ if(!started){ started = true; startTime = performance.now(); } }

// Reset button
document.getElementById('resetBtn').addEventListener('click', ()=>{ createEnemies(); resetPlayer(); running = true; document.getElementById('status').textContent = ''; });

// Game loop
function update(dt){
  if(!running) return;
  // movement
  let dx=0, dy=0; const s = player.speed;
  if(keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= s*dt;
  if(keys['ArrowRight'] || keys['d'] || keys['D']) dx += s*dt;
  if(keys['ArrowUp'] || keys['w'] || keys['W']) dy -= s*dt;
  if(keys['ArrowDown'] || keys['s'] || keys['S']) dy += s*dt;
  player.x = Math.max(0, Math.min(W - player.w, player.x + dx));
  player.y = Math.max(0, Math.min(H - player.h, player.y + dy));

  // start timer when leaving start zone
  if(!started && !rectsOverlap(player, startZone) && (dx!==0 || dy!==0)) startRun();

  // update enemies
  enemies.forEach(e=>{
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // bounce inside canvas
    if(e.x - e.r < 0){ e.x = e.r; e.vx *= -1; }
    if(e.x + e.r > W){ e.x = W - e.r; e.vx *= -1; }
    if(e.y - e.r < 0){ e.y = e.r; e.vy *= -1; }
    if(e.y + e.r > H){ e.y = H - e.r; e.vy *= -1; }
  });

  // update boss and lasers
  if(!timeStopped){
    updateBoss(dt);
    updateLasers(dt);
  }

  // collisions
  for(let e of enemies){
    if(circleRectCollision(e, player)){
      // teleport to start
      resetPlayer();
      document.getElementById('status').textContent = 'Hit! Back to start.';
      return;
    }
  }

  // collision with boss
  if(boss){
    if(circleRectCollision(boss, player)){
      resetPlayer(); document.getElementById('status').textContent = 'Smashed by boss!'; return;
    }
  }

  // collision with lasers
  for(const l of lasers){
    if(circleRectCollision(l, player)){
      resetPlayer(); document.getElementById('status').textContent = 'Hit by laser!'; return;
    }
  }

  // reached finish
    if(rectsOverlap(player, finishZone)){
    if(started){
      running = false;
      elapsed = (performance.now() - startTime)/1000.0;
      document.getElementById('timer').textContent = elapsed.toFixed(2);
      document.getElementById('status').textContent = 'Finished! Sending score...';
      sendScore(elapsed);
    }
  }

  if(started){
    elapsed = (performance.now() - startTime)/1000.0;
    document.getElementById('timer').textContent = elapsed.toFixed(2);
  }
  // auto spawn boss after 30s if none
  if(started && elapsed > 30 && !boss){ spawnBoss(); }
}

// click to damage boss (testing hook) — you can replace with player attack later
try{
  canvas.addEventListener('click', (ev)=>{
    if(!boss) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left; const cy = ev.clientY - rect.top;
    const dx = cx - boss.x, dy = cy - boss.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist <= boss.r + 6){ boss.hp -= 5; if(boss.hp <= 0){
      // boss defeated
      boss = null; lasers.length = 0;
      try{ const wrap = document.querySelector('.canvas-wrap'); if(wrap) wrap.classList.remove('boss-active'); } catch(e){}
      // animate leaderboard to celebrate
      const liWrap = document.getElementById('leaderboardList'); if(liWrap){ liWrap.classList.add('records-celebrate'); setTimeout(()=>{ liWrap.classList.remove('records-celebrate'); }, 1200); }
    }}
  });
} catch(e){}

// Boss functions
function spawnBoss(){
  boss = { x: W/2, y: H/4, r: 56, hp: 20, vx: 30 * (Math.random() < 0.5 ? 1 : -1), vy: 0, shootCooldown: 1.2 };
  // add visual class
  try{ document.querySelector('.canvas-wrap').classList.add('boss-active'); } catch(e){}
}

function updateBoss(dt){
  if(!boss) return;
  // slow horizontal patrol
  boss.x += boss.vx * dt;
  if(boss.x - boss.r < 0 || boss.x + boss.r > W){ boss.vx *= -1; }
  // shooting
  boss.shootCooldown -= dt;
  if(boss.shootCooldown <= 0){
    boss.shootCooldown = 0.9 + Math.random()*1.1;
    // fire a few lasers toward the player
    const px = player.x + player.w/2, py = player.y + player.h/2;
    const dx = px - boss.x, dy = py - boss.y; const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const speed = 480;
    const vx = dx/dist * speed; const vy = dy/dist * speed;
    // laser is fast and lethal
    lasers.push({ x: boss.x, y: boss.y, vx, vy, r:6, color:'#ff1744' });
    // occasional spread
    if(Math.random() < 0.5){
      const ang = Math.atan2(dy,dx);
      const s = 0.18; // spread angle
      const vx2 = Math.cos(ang + s)*speed; const vy2 = Math.sin(ang + s)*speed;
      lasers.push({ x: boss.x, y: boss.y, vx: vx2, vy: vy2, r:6, color:'#ff1744' });
    }
  }
}

function updateLasers(dt){
  for(let i = lasers.length-1;i>=0;i--){
    const l = lasers[i]; l.x += l.vx*dt; l.y += l.vy*dt;
    // remove if out of bounds
    if(l.x < -100 || l.x > W+100 || l.y < -100 || l.y > H+100) lasers.splice(i,1);
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  // enemies
  enemies.forEach(e=>{ ctx.fillStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); });
  // player
  ctx.fillStyle = '#ff4444'; ctx.fillRect(player.x, player.y, player.w, player.h);
  // boss
  if(boss){
    // pulsing boss outline
    ctx.beginPath(); ctx.fillStyle = '#7c4dff'; ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,80,80,0.35)'; ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r+6, 0, Math.PI*2); ctx.stroke();
    // HP bar
    const hpPct = Math.max(0, boss.hp) / 20;
    ctx.fillStyle = '#222'; ctx.fillRect(boss.x - boss.r, boss.y - boss.r - 12, boss.r*2, 8);
    ctx.fillStyle = '#ff5252'; ctx.fillRect(boss.x - boss.r, boss.y - boss.r - 12, boss.r*2*hpPct, 8);
  }
  // lasers
  lasers.forEach(l=>{
    ctx.save(); ctx.translate(l.x, l.y);
    ctx.fillStyle = l.color || '#ff1744'; ctx.beginPath(); ctx.arc(0,0,l.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    // glow
    ctx.strokeStyle = 'rgba(255,20,20,0.18)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(l.x,l.y,l.r+6,0,Math.PI*2); ctx.stroke();
  });
}

function loop(ts){
  if(lastTs==null) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs)/1000);
  update(dt);
  draw();
  lastTs = ts;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Score submission
function sendScore(time){
  fetch('/submit_score', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time })
  }).then(r=>{
    if(r.ok) return r.json();
    throw new Error('Failed to submit');
  }).then(j=>{
    document.getElementById('status').textContent = 'Score saved!';
    updateLeaderboard();
  }).catch(err=>{
    document.getElementById('status').textContent = 'Could not submit score';
  });
}

// Leaderboard
function updateLeaderboard(){
  fetch('/api/leaderboard?limit=10').then(r=>r.json()).then(data=>{
    const el = document.getElementById('leaderboardList');
    el.innerHTML = '';
    data.forEach((row, idx)=>{
      const li = document.createElement('li');
      const time = (typeof row.time === 'number') ? row.time : parseFloat(row.time);
      li.textContent = `${row.username} — ${isNaN(time) ? row.time : time.toFixed(2)}s`;
      // animate entries in with a small stagger
      li.classList.add('record-pop');
      li.style.animationDelay = (idx * 80) + 'ms';
      el.appendChild(li);
      // cleanup class after animation completes
      setTimeout(()=>{ li.classList.remove('record-pop'); li.style.animationDelay = ''; }, 900 + idx*80);
    });
  });
}
updateLeaderboard();
setInterval(updateLeaderboard, 5000);
