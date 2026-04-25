(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');

  const config = {
    type: Phaser.CANVAS,
    canvas: canvas,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: '#000',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload, create, update }
  };

  new Phaser.Game(config);

  let player, enemies, bullets, enemyBullets, powerUps, bosses;
  let cursors, keys, spaceKey;
  let score = 0;
  let lives = 3;
  let coins = 0;
  let gameOver = false;
  let shootCooldown = 0;
  let spawnTimer = 0;
  let difficultyTimer = 0;
  let bossTimer = 0;
  let bossShootTimer = 0;
  let bossActive = false;
  let currentBoss = null;
  let invulnerable = false;
  let invulnerableTimer = 0;
  let areaLevel = 1;
  let areaName = 'Area 1';
  let areaTheme = 'Origin';
  let enemySpeedMin = 60;
  let enemySpeedMax = 100;
  let enemyShootChance = 0.02;
  let spawnRateMin = 1200;
  let spawnRateMax = 1700;
  let bossBaseHealth = 24;
  let topAreaBottom = 0;
  
  // 📊 Nuovi contatori per le statistiche
  let gameStartTime = 0;
  let enemiesKilled = 0;
  let bulletsFired = 0;
  let elapsedTime = 0;

  function preload() {
    this.load.image('bg', 'static/assets/background.png');

    // fallback-safe single load
    this.load.image('ship', 'assets//player.png');
    this.load.image('enemy', 'assets//ufo.png');
    this.load.image('bullet', 'static/assets/bullet.png');
  }

  function create() {
    const scene = this;

    // Avvia il timer di gioco
    gameStartTime = Date.now();

    // background
    scene.add.image(canvas.width / 2, canvas.height / 2, 'bg')
      .setDisplaySize(canvas.width, canvas.height);

    // player
    player = scene.physics.add.image(canvas.width / 2, canvas.height - 70, 'ship');
    player.setDisplaySize(32, 32);
    player.setCollideWorldBounds(true);

    enemies = scene.physics.add.group();
    bullets = scene.physics.add.group();
    enemyBullets = scene.physics.add.group();
    powerUps = scene.physics.add.group();
    bosses = scene.physics.add.group();

    cursors = scene.input.keyboard.createCursorKeys();
    keys = scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    });

    spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // collisions
    scene.physics.add.overlap(bullets, enemies, hitEnemy, null, scene);
    scene.physics.add.overlap(player, enemies, hitPlayer, null, scene);
    scene.physics.add.overlap(player, enemyBullets, hitPlayer, null, scene);
    scene.physics.add.overlap(player, powerUps, collectPowerUp, null, scene);
    scene.physics.add.overlap(bullets, bosses, hitBoss, null, scene);

    // UI
    scene.scoreText = scene.add.text(12, 12, '', { fontSize: '18px', fill: '#fff' });
    scene.livesText = scene.add.text(12, 35, '', { fontSize: '18px', fill: '#fff' });
    scene.coinsText = scene.add.text(12, 58, '', { fontSize: '18px', fill: '#ffd700' });
    scene.areaText = scene.add.text(12, 82, '', { fontSize: '18px', fill: '#00b8ff' });
    scene.bossText = scene.add.text(12, 106, '', { fontSize: '18px', fill: '#ffcc00' });

    topAreaBottom = canvas.height * 0.42;
    generateArea(scene);

    scene.gameOverText = scene.add.text(canvas.width / 2, canvas.height / 2, '', {
      fontSize: '40px',
      fill: '#ff4444',
      align: 'center'
    }).setOrigin(0.5);

    scene.input.keyboard.on('keydown-R', () => restart(scene));

    updateUI(scene);
    refreshLeaderboard();
  }

  function update(time, delta) {
    if (gameOver) return;

    const scene = this;

    // ======================
    // 🎮 DIAGONAL MOVEMENT
    // ======================
    const speed = 280;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || keys.A.isDown) vx = -1;
    if (cursors.right.isDown || keys.D.isDown) vx = 1;
    if (cursors.up.isDown || keys.W.isDown) vy = -1;
    if (cursors.down.isDown || keys.S.isDown) vy = 1;

    player.setVelocity(vx * speed, vy * speed);
    player.setAngle(vx * 10);

    // ======================
    // 🔫 SHOOTING
    // ======================
    shootCooldown -= delta;
    if (spaceKey.isDown && shootCooldown <= 0) {
      shoot(scene);
      shootCooldown = 160;
    }

    // ======================
    // 👾 ENEMY SPAWN
    // ======================
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEnemy(scene);
      spawnTimer = Phaser.Math.Between(spawnRateMin, spawnRateMax);
    }

    // ======================
    // 📈 DIFFICULTY & BOSS
    // ======================
    difficultyTimer += delta;
    bossTimer += delta;

    if (!bossActive && bossTimer >= 28000) {
      spawnBoss(scene);
      bossTimer = 0;
    }

    enemies.children.iterate(enemy => {
      if (!enemy || !enemy.active) return;

      if (enemy.y > topAreaBottom) {
        enemy.setVelocityY(-Math.abs(enemy.body.velocity.y || enemySpeedMin));
      }
      if (enemy.y < 24 && enemy.body.velocity.y < 0) {
        enemy.setVelocityY(Math.abs(enemy.body.velocity.y || enemySpeedMin));
      }

      if (Math.random() < enemyShootChance) {
        enemyShoot(scene, enemy);
      }
    });

    if (bossActive && currentBoss && currentBoss.active) {
      bossShootTimer += delta;
      if (bossShootTimer >= 1200) {
        bossShoot(scene, currentBoss);
        bossShootTimer = 0;
      }
    }

    if (invulnerableTimer > 0) {
      invulnerableTimer -= delta;
      if (invulnerableTimer <= 0) {
        invulnerable = false;
        player.setAlpha(1);
      }
    }



    // cleanup
    bullets.children.each(b => { if (!b.active || b.y < -50 || b.y > canvas.height + 50 || b.x < -50 || b.x > canvas.width + 50) b.destroy(); });
    enemyBullets.children.each(b => { if (!b.active || b.y > canvas.height + 80 || b.y < -80 || b.x < -80 || b.x > canvas.width + 80) b.destroy(); });
    enemies.children.each(e => { if (e && (!e.active || e.y > canvas.height + 80 || e.y < -80)) e.destroy(); });
    bosses.children.each(b => { if (b && (!b.active || b.y > canvas.height + 200)) { b.destroy(); bossActive = false; currentBoss = null; scene.bossText.setText(''); } });

    elapsedTime += delta;
    updateUI(scene);
  }

  // ======================
  // 🔫 PLAYER SHOOT
  // ======================
function shoot(scene) {
  const spread = [-14, 0, 14];

  spread.forEach(offset => {
    const bullet = bullets.create(player.x + offset, player.y - 28, 'bullet');
    bullet.setVelocity(offset * 10, -900);
    bullet.setRotation(Math.atan2(-900, offset * 10));
    bullet.setScale(0.42);
    bullet.body.allowGravity = false;
    bullet.setCollideWorldBounds(false);
  });

  bulletsFired += spread.length;
}

  // ======================
  // 👾 ENEMY SPAWN
  // ======================
function spawnEnemy(scene) {
  if (enemies.countActive(true) >= 4 || bossActive) return;

  const x = Phaser.Math.Between(60, canvas.width - 60);
  const enemy = enemies.create(x, 30, 'enemy');

  const velocityX = Phaser.Math.Between(-90 - areaLevel * 5, 90 + areaLevel * 5);
  const velocityY = Phaser.Math.Between(enemySpeedMin, enemySpeedMax);
  enemy.setVelocity(velocityX, velocityY);
  enemy.setDisplaySize(42, 42);
  enemy.setCollideWorldBounds(true);
  enemy.setBounce(1, 0);
  enemy.body.allowGravity = false;
}

  // ======================
  // 👾 ENEMY SHOOT
  // ======================
function enemyShoot(scene, enemy) {
  const bullet = enemyBullets.create(enemy.x, enemy.y + 18, 'bullet');
  bullet.setVelocity(0, 150);
  bullet.setRotation(Math.atan2(150, 0));
  bullet.setTint(0xff4444);
  bullet.setScale(0.2);
  bullet.body.allowGravity = false;
  bullet.setCollideWorldBounds(false);
}

  // ======================
  // 💥 HIT ENEMY
  // ======================
  function hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    const scene = enemy.scene;
    const boom = scene.add.circle(enemy.x, enemy.y, 10, 0xffaa00);
    scene.tweens.add({
      targets: boom,
      scale: 3,
      alpha: 0,
      duration: 200,
      onComplete: () => boom.destroy()
    });

    bullet.destroy();
    enemy.destroy();

    score += 10;
    enemiesKilled++;
    coins += 2;

    if (Math.random() < 0.15) spawnPowerUp(scene, enemy.x, enemy.y);
  }

  function spawnBoss(scene) {
    if (bossActive) return;

    const boss = bosses.create(canvas.width / 2, 80, 'enemy');
    boss.setDisplaySize(140, 140);
    boss.setVelocity(120 + areaLevel * 6, 0);
    boss.setCollideWorldBounds(true);
    boss.setBounce(1, 0);
    boss.body.allowGravity = false;
    boss.health = bossBaseHealth;
    boss.maxHealth = bossBaseHealth;

    bossActive = true;
    currentBoss = boss;
    scene.bossText.setText(`BOSS HP: ${boss.health}`);
    scene.bossText.setVisible(true);
  }

  function bossShoot(scene, boss) {
    if (!boss || !boss.active) return;

    const bulletCount = 2;
    for (let i = 0; i < bulletCount; i++) {
      const angle = (360 / bulletCount) * i;
      const rad = Phaser.Math.DegToRad(angle);
      const velocityX = Math.cos(rad) * 200;
      const velocityY = Math.sin(rad) * 200;
      const bullet = enemyBullets.create(boss.x, boss.y, 'bullet');
      bullet.setVelocity(velocityX, velocityY);
      bullet.setRotation(Math.atan2(velocityY, velocityX));
      bullet.setTint(0xffcc00);
      bullet.setScale(0.3);
      bullet.body.allowGravity = false;
      bullet.setCollideWorldBounds(false);
    }
  }

  function hitBoss(bullet, boss) {
    if (!bullet.active || !boss.active) return;

    bullet.destroy();
    boss.health -= 1;
    boss.scene.bossText.setText(`BOSS HP: ${boss.health}`);

    const splash = boss.scene.add.circle(boss.x, boss.y, 18, 0xff6633, 0.7);
    boss.scene.tweens.add({
      targets: splash,
      alpha: 0,
      duration: 300,
      onComplete: () => splash.destroy()
    });

    if (boss.health <= 0) {
      const scene = boss.scene;
      if (Math.random() < 0.4) spawnPowerUp(scene, boss.x, boss.y);
      boss.body.enable = false;
      boss.destroy();
      bossActive = false;
      currentBoss = null;
      scene.bossText.setText('');
      score += 120;
      enemiesKilled += 3;
      coins += 10;
      invulnerable = true;
      invulnerableTimer = 600;
      setTimeout(() => advanceArea(scene), 500);
    }
  }

  // ======================
  // ❤️ PLAYER HIT
  // ======================
  function hitPlayer() {
    if (gameOver || invulnerable) return;

    lives -= 1;
    invulnerable = true;
    invulnerableTimer = 900;
    this.cameras.main.shake(150, 0.01);

    if (lives <= 0) {
      gameOver = true;
      this.gameOverText.setText(`GAME OVER\nScore: ${score}\nPress R`);
      
      const playtime = (Date.now() - gameStartTime) / 1000;
      submitScore(score, enemiesKilled, bulletsFired, playtime);
    }
  }

  // ======================
  // ✨ POWERUPS
  // ======================
  function spawnPowerUp(scene, x, y) {
    const p = scene.add.circle(x, y, 8, 0x00ff88);
    scene.physics.add.existing(p);
    p.body.setVelocityY(120);
    powerUps.add(p);
  }

  function collectPowerUp(player, powerUp) {
    powerUp.destroy();
    score += 25;
    coins += 3;
    if (lives < 5) lives++;
  }

  // ======================
  // 🔁 RESET
  // ======================
  function restart(scene) {
    enemies.clear(true, true);
    bullets.clear(true, true);
    enemyBullets.clear(true, true);
    powerUps.clear(true, true);
    bosses.clear(true, true);

    player.setPosition(canvas.width / 2, canvas.height - 70);

    score = 0;
    lives = 3;
    coins = 0;
    gameOver = false;
    shootCooldown = 0;
    spawnTimer = 0;
    bossTimer = 0;
    bossShootTimer = 0;
    bossActive = false;
    currentBoss = null;
    invulnerable = false;
    invulnerableTimer = 0;
    elapsedTime = 0;
    
    // Reset delle statistiche
    gameStartTime = Date.now();
    enemiesKilled = 0;
    bulletsFired = 0;

    scene.gameOverText.setText('');
    scene.bossText.setText('');
    scene.bossText.setVisible(false);
    updateUI(scene);
  }

  // ======================
  // 📊 UI
  // ======================
  function updateUI(scene) {
    scene.scoreText.setText(`Score: ${score}`);
    scene.livesText.setText(`Lives: ${lives}`);
    scene.coinsText.setText(`Coins: ${coins}`);

    if (bossActive && currentBoss && currentBoss.active) {
      scene.bossText.setText(`BOSS HP: ${currentBoss.health}`);
      scene.bossText.setVisible(true);
    } else {
      scene.bossText.setVisible(false);
    }

    const gameTimeEl = document.getElementById('gameTime');
    const gameScoreEl = document.getElementById('gameScore');
    const gameEnemiesEl = document.getElementById('gameEnemies');
    const gameBulletsEl = document.getElementById('gameBullets');
    const gameCoinsEl = document.getElementById('gameCoins');

    if (gameTimeEl) gameTimeEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s`;
    if (gameScoreEl) gameScoreEl.textContent = `${score}`;
    if (gameEnemiesEl) gameEnemiesEl.textContent = `${enemiesKilled}`;
    if (gameBulletsEl) gameBulletsEl.textContent = `${bulletsFired}`;
    if (gameCoinsEl) gameCoinsEl.textContent = `${coins}`;

    if (invulnerable) {
      player.setAlpha(0.55);
    } else {
      player.setAlpha(1);
    }

    if (scene.areaText) {
      scene.areaText.setText(`${areaName} — ${areaTheme}`);
    }
  }

  function generateArea(scene) {
    const themes = [
      { name: 'Nebula Rift', speed: [58, 92], shootChance: 0.018, spawn: [1300, 1750], bossHealth: 22 },
      { name: 'Echo Lands', speed: [64, 96], shootChance: 0.021, spawn: [1150, 1650], bossHealth: 24 },
      { name: 'Frostreach', speed: [60, 100], shootChance: 0.019, spawn: [1180, 1680], bossHealth: 23 },
      { name: 'Solar Vault', speed: [68, 108], shootChance: 0.022, spawn: [1120, 1620], bossHealth: 25 },
      { name: 'Pulse Garden', speed: [62, 104], shootChance: 0.02, spawn: [1200, 1700], bossHealth: 24 }
    ];

    const theme = themes[Phaser.Math.Between(0, themes.length - 1)];
    areaTheme = theme.name;
    enemySpeedMin = theme.speed[0] + areaLevel * 2;
    enemySpeedMax = theme.speed[1] + areaLevel * 3;
    enemyShootChance = Math.min(0.035, theme.shootChance + areaLevel * 0.0015);
    spawnRateMin = Math.max(900, theme.spawn[0] - areaLevel * 40);
    spawnRateMax = Math.max(1250, theme.spawn[1] - areaLevel * 40);
    bossBaseHealth = theme.bossHealth + areaLevel * 2;
    areaName = `Area ${areaLevel}`;

    if (scene.areaText) {
      scene.areaText.setText(`${areaName} — ${areaTheme}`);
    }
  }

  function advanceArea(scene) {
    try {
      areaLevel = Math.min(6, areaLevel + 1);
      // Clear remaining enemies and bullets
      enemies.clear(true, true);
      bosses.clear(true, true);
      enemyBullets.clear(true, true);
      bullets.clear(true, true);
      powerUps.clear(true, true);
      generateArea(scene);
      bossTimer = 0;
      spawnTimer = Phaser.Math.Between(spawnRateMin, spawnRateMax);
      difficultyTimer = 0;
    } catch (e) {
      console.error('Error in advanceArea:', e);
      alert('Game error during area advance: ' + e.message);
    }
  }

  // ======================
  // 🌐 BACKEND
  // ======================
  function submitScore(score, enemiesKilled, bulletsFired, playtime) {
    const payload = {
      score: score,
      enemies_killed: enemiesKilled,
      bullets_fired: bulletsFired,
      playtime: playtime,
      difficulty: 'normal',
      pattern_used: 'default'
    };
    
    return fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      console.log('Score submitted:', data);
      refreshLeaderboard();
    })
    .catch(err => console.error('Error submitting score:', err));
  }

  function refreshLeaderboard(limit = 5) {
    fetch(`/api/leaderboard?limit=${limit}`)
      .then(r => r.json())
      .then(data => {
        const list = document.getElementById('leaderboardList');
        if (!list) return;
        list.innerHTML = '';
        data.forEach((row, i) => {
          const li = document.createElement('li');
          li.textContent = `${i + 1}. ${row.username} — ${row.best_score || 0}`;
          list.appendChild(li);
        });
      });
  }

})();