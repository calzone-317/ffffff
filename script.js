(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const TILE = 50, COLS = 16, ROWS = 10;
  const pathTiles = [
    [0,4],[1,4],[2,4],[3,4],[3,3],[3,2],[4,2],[5,2],[6,2],[6,3],[6,4],[6,5],
    [7,5],[8,5],[9,5],[9,4],[9,3],[10,3],[11,3],[12,3],[12,4],[12,5],[12,6],
    [13,6],[14,6],[15,6]
  ];
  const pathSet = new Set(pathTiles.map(([x,y]) => `${x},${y}`));
  const waypoints = pathTiles.map(([x,y]) => ({x: x*TILE + TILE/2, y: y*TILE + TILE/2}));
  const towerTypes = {
    archer: { name: '궁수 타워', cost: 60, range: 145, damage: 18, cooldown: 0.55, color: '#5478f6', projectile: '#b9c8ff' },
    cannon: { name: '대포 타워', cost: 90, range: 115, damage: 48, cooldown: 1.35, color: '#e99a3e', projectile: '#ffce7d' }
  };
  let gold, lives, wave, towers, enemies, shots, selectedType, selectedTower, waveActive, paused, gameOver, spawnLeft, spawnTimer, lastTime, toastTimer;
  const $ = id => document.getElementById(id);

  function resetGame() {
    gold = 180; lives = 20; wave = 0; towers = []; enemies = []; shots = [];
    selectedType = 'archer'; selectedTower = null; waveActive = false; paused = false; gameOver = false;
    spawnLeft = 0; spawnTimer = 0; lastTime = 0;
    document.querySelectorAll('.tower-option').forEach(b => b.classList.toggle('selected', b.dataset.tower === selectedType));
    $('startWave').disabled = false; $('startWave').textContent = '▶ 웨이브 시작';
    $('pauseBtn').textContent = 'Ⅱ 일시정지';
    $('status').textContent = '준비 완료'; $('status').style.background = '#e9f9f0'; $('status').style.color = '#317b59';
    selectedTower = null; updateUI(); draw();
  }

  function updateUI() {
    $('gold').textContent = gold; $('lives').textContent = lives; $('wave').textContent = wave;
    const btn = $('upgradeBtn');
    btn.disabled = !selectedTower || selectedTower.level >= 3 || gold < 50 || gameOver;
    $('upgradeText').textContent = !selectedTower ? '전장에 설치한 타워를 클릭하면 업그레이드할 수 있어요.' :
      selectedTower.level >= 3 ? '이 타워는 최대 레벨입니다.' : `선택됨: ${towerTypes[selectedTower.type].name} Lv.${selectedTower.level} · 공격력 ${Math.round(towerTypes[selectedTower.type].damage * (1 + (selectedTower.level-1)*0.65))}`;
  }

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2100);
  }

  function startWave() {
    if (gameOver || waveActive) return;
    wave++; spawnLeft = 6 + wave * 2; spawnTimer = 0; waveActive = true;
    $('status').textContent = `웨이브 ${wave} 진행 중`; $('status').style.background = '#fff1d8'; $('status').style.color = '#9b6415';
    $('startWave').disabled = true;
    toast(`웨이브 ${wave} 시작! 적 ${spawnLeft}마리가 몰려옵니다.`);
    updateUI();
  }

  function spawnEnemy() {
    const hp = 42 + wave * 16;
    enemies.push({ x: waypoints[0].x, y: waypoints[0].y, waypoint: 1, hp, maxHp: hp, speed: 38 + Math.min(wave*2, 24), reward: 12 + Math.floor(wave/2), radius: 13 });
    spawnLeft--;
  }

  function placeTower(x, y) {
    const type = towerTypes[selectedType];
    if (pathSet.has(`${x},${y}`)) { toast('적이 지나가는 길에는 설치할 수 없어요!'); return; }
    if (towers.some(t => t.x === x && t.y === y)) { toast('이 타일에는 이미 타워가 있어요.'); return; }
    if (gold < type.cost) { toast('골드가 부족합니다!'); return; }
    gold -= type.cost;
    selectedTower = { x, y, type: selectedType, level: 1, cooldown: 0 };
    towers.push(selectedTower); updateUI(); draw();
  }

  function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * canvas.width / TILE);
    const y = Math.floor((event.clientY - rect.top) / rect.height * canvas.height / TILE);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || gameOver) return;
    const tower = towers.find(t => t.x === x && t.y === y);
    if (tower) { selectedTower = tower; updateUI(); draw(); return; }
    selectedTower = null; placeTower(x, y);
  }

  function upgradeTower() {
    if (!selectedTower || selectedTower.level >= 3 || gold < 50 || gameOver) return;
    gold -= 50; selectedTower.level++; toast(`타워가 레벨 ${selectedTower.level}(으)로 강화됐어요!`);
    updateUI(); draw();
  }

  function update(dt) {
    if (paused || gameOver) return;
    if (waveActive) {
      spawnTimer -= dt;
      if (spawnLeft > 0 && spawnTimer <= 0) { spawnEnemy(); spawnTimer = Math.max(0.42, 1.05 - wave*0.035); }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], target = waypoints[e.waypoint];
      if (!target) { enemies.splice(i,1); lives--; continue; }
      const dx = target.x-e.x, dy = target.y-e.y, dist = Math.hypot(dx,dy), step = e.speed*dt;
      if (dist <= step) { e.x=target.x; e.y=target.y; e.waypoint++; }
      else { e.x += dx/dist*step; e.y += dy/dist*step; }
      if (e.waypoint >= waypoints.length) { enemies.splice(i,1); lives--; }
    }
    for (const t of towers) {
      t.cooldown -= dt;
      const def = towerTypes[t.type], range = def.range + (t.level-1)*10;
      const tx = t.x*TILE+TILE/2, ty = t.y*TILE+TILE/2;
      if (t.cooldown <= 0) {
        let target = null, best = -1;
        for (const e of enemies) {
          const d = Math.hypot(e.x-tx,e.y-ty);
          if (d <= range && e.waypoint > best) { best = e.waypoint; target = e; }
        }
        if (target) {
          const damage = def.damage * (1 + (t.level-1)*0.65);
          shots.push({x:tx,y:ty,target,damage,speed:t.type==='cannon'?300:420,color:def.projectile,type:t.type});
          t.cooldown = def.cooldown * (t.type==='archer' ? 1 : 1);
        }
      }
    }
    for (let i=shots.length-1; i>=0; i--) {
      const s=shots[i];
      if (!enemies.includes(s.target)) { shots.splice(i,1); continue; }
      const dx=s.target.x-s.x, dy=s.target.y-s.y, d=Math.hypot(dx,dy), step=s.speed*dt;
      if (d <= step+5) {
        s.target.hp -= s.damage;
        if (s.target.hp <= 0) {
          const idx=enemies.indexOf(s.target);
          if (idx>=0) { gold += s.target.reward; enemies.splice(idx,1); }
        }
        shots.splice(i,1);
      } else { s.x += dx/d*step; s.y += dy/d*step; }
    }
    if (lives <= 0) {
      lives = 0; gameOver = true; waveActive = false;
      $('status').textContent = '게임 오버'; $('status').style.background = '#ffe7e9'; $('status').style.color = '#bb3348';
      $('startWave').disabled = true; toast('성의 체력이 0이 되었습니다. 새 게임으로 다시 도전하세요!');
    } else if (waveActive && spawnLeft === 0 && enemies.length === 0) {
      waveActive = false; $('startWave').disabled = false;
      $('status').textContent = '웨이브 클리어!'; $('status').style.background = '#e9f9f0'; $('status').style.color = '#317b59';
      gold += 25 + wave*5; toast(`웨이브 ${wave} 클리어! 보너스 골드를 획득했습니다.`);
    }
    updateUI();
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // grassy board with subtle checker tiles
    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
      ctx.fillStyle = (x+y)%2===0 ? '#dcebd4' : '#d5e5ce';
      ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      ctx.strokeStyle = '#c7ddc0'; ctx.lineWidth=1; ctx.strokeRect(x*TILE,y*TILE,TILE,TILE);
    }
    // path tiles
    for (const [x,y] of pathTiles) {
      ctx.fillStyle = '#d7b77c'; ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      ctx.fillStyle = '#c8a76b'; ctx.fillRect(x*TILE+4,y*TILE+4,TILE-8,TILE-8);
      ctx.strokeStyle = '#e6c991'; ctx.lineWidth=2; ctx.strokeRect(x*TILE+7,y*TILE+7,TILE-14,TILE-14);
    }
    // entrance and castle
    ctx.font = '25px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🚪', 24, 225); ctx.fillText('🏰', 775, 325);
    // tower range and body
    for (const t of towers) {
      const x=t.x*TILE+TILE/2, y=t.y*TILE+TILE/2, def=towerTypes[t.type];
      if (t===selectedTower) {
        ctx.beginPath(); ctx.arc(x,y,def.range+(t.level-1)*10,0,Math.PI*2);
        ctx.fillStyle='#6484ff18'; ctx.fill(); ctx.strokeStyle='#6484ff99'; ctx.lineWidth=2; ctx.stroke();
      }
      ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=def.color; ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2); ctx.fill();
      ctx.font='19px sans-serif'; ctx.fillText(t.type==='archer'?'🏹':'💣',x,y+1);
      if (t.level>1) {
        ctx.fillStyle='#17233c'; ctx.beginPath(); ctx.arc(x+13,y-14,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.fillText(t.level,x+13,y-14);
      }
      if (t===selectedTower) { ctx.strokeStyle='#344fd0'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,21,0,Math.PI*2); ctx.stroke(); }
    }
    // enemies and health bars
    for (const e of enemies) {
      ctx.fillStyle='#00000020'; ctx.beginPath(); ctx.ellipse(e.x,e.y+10,13,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e95d72'; ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(e.x-4,e.y-3,2.5,0,Math.PI*2); ctx.arc(e.x+4,e.y-3,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#26344c'; ctx.fillRect(e.x-15,e.y-22,30,5);
      ctx.fillStyle='#58c982'; ctx.fillRect(e.x-15,e.y-22,30*Math.max(0,e.hp/e.maxHp),5);
    }
    // projectiles
    for (const s of shots) {
      ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(s.x,s.y,s.type==='cannon'?6:4,0,Math.PI*2); ctx.fill();
      if(s.type==='cannon'){ctx.strokeStyle='#fff2';ctx.lineWidth=2;ctx.stroke();}
    }
    if (paused && !gameOver) {
      ctx.fillStyle='#17233c99'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff'; ctx.font='bold 34px sans-serif'; ctx.fillText('일시정지',canvas.width/2,canvas.height/2);
    }
    if (gameOver) {
      ctx.fillStyle='#17233caa'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff'; ctx.font='bold 34px sans-serif'; ctx.fillText('GAME OVER',canvas.width/2,canvas.height/2-10);
      ctx.font='16px sans-serif'; ctx.fillText('새 게임 버튼을 눌러 다시 도전하세요',canvas.width/2,canvas.height/2+25);
    }
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp-(lastTime||timestamp))/1000, 0.04); lastTime=timestamp;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', handleCanvasClick);
  document.querySelectorAll('.tower-option').forEach(btn => btn.addEventListener('click', () => {
    selectedType=btn.dataset.tower;
    document.querySelectorAll('.tower-option').forEach(b => b.classList.toggle('selected',b===btn));
    selectedTower=null; updateUI(); draw();
  }));
  $('startWave').addEventListener('click', startWave);
  $('pauseBtn').addEventListener('click', () => {
    if (gameOver) return;
    paused=!paused; $('pauseBtn').textContent=paused?'▶ 계속하기':'Ⅱ 일시정지';
    $('status').textContent=paused?'일시정지':(waveActive?`웨이브 ${wave} 진행 중`:'준비 완료');
    draw();
  });
  $('restartBtn').addEventListener('click', () => { resetGame(); toast('새 게임을 시작합니다!'); });
  $('upgradeBtn').addEventListener('click', upgradeTower);
  resetGame(); requestAnimationFrame(loop);
})();
