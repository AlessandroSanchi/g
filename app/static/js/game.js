// Simple World's Hardest Game clone (minimal)
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
  document.getElementById('timer').textContent = '0.000';
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
window.addEventListener('keydown', (e)=>{ keys[e.key] = true; if(!started && isMovingKey(e.key)) startRun(); });
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

  // collisions
  for(let e of enemies){
    if(circleRectCollision(e, player)){
      // teleport to start
      resetPlayer();
      document.getElementById('status').textContent = 'Hit! Back to start.';
      return;
    }
  }

  // reached finish
  if(rectsOverlap(player, finishZone)){
    if(started){
      running = false;
      elapsed = (performance.now() - startTime)/1000.0;
      document.getElementById('timer').textContent = elapsed.toFixed(3);
      document.getElementById('status').textContent = 'Finished! Sending score...';
      sendScore(elapsed);
    }
  }

  if(started){
    elapsed = (performance.now() - startTime)/1000.0;
    document.getElementById('timer').textContent = elapsed.toFixed(3);
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  // start and finish
  ctx.fillStyle = '#2d7b2d'; ctx.fillRect(finishZone.x, finishZone.y, finishZone.w, finishZone.h);
  ctx.fillStyle = '#444'; ctx.fillRect(startZone.x, startZone.y, startZone.w, startZone.h);
  // enemies
  enemies.forEach(e=>{ ctx.fillStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); });
  // player
  ctx.fillStyle = '#ff4444'; ctx.fillRect(player.x, player.y, player.w, player.h);
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
    data.forEach(row=>{
      const li = document.createElement('li');
      li.textContent = `${row.username} — ${row.time}s`;
      el.appendChild(li);
    });
  });
}
updateLeaderboard();
setInterval(updateLeaderboard, 5000);
