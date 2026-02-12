(() => {
  "use strict";

  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const now = () => performance.now();
  const fmt1 = (x) => (Math.round(x*10)/10).toFixed(1);
  const randRange = (a,b) => a + Math.random()*(b-a);
  const lerp = (a,b,t) => a + (b-a)*t;
  const rand = (a,b) => a + Math.random()*(b-a);
  const dist = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);

  const CFG = {
    BUILD: "v0.47g",
    LOGICAL_W: 1920,
    LOGICAL_H: 1080,
    // Shield regen waits for a short period after breaking (SH reaches 0)
    core: { hpMax: 420, shMax: 300, shRegenPerSec: 10, shRegenDelayOnBreak: 3.0, hitMinDamage: 0, hitRadius: 70, coreRadius: 50, armorHP: 2, armorSH: 2 },
    
coreUpg: { armorSteps:[2,5,8,12], armorCosts:[280,520,900] },
coreMaxUpg: {
  // Adds to the base max HP/SH. Levels: 0~3
  hpAdd:[0, 60, 120, 180], hpCosts:[220, 420, 760],
  shAdd:[0, 50, 100, 150], shCosts:[220, 420, 760]
},

// Shield regen upgrade (flat +/sec). Levels: 0~3
coreShRegenUpg: {
  addPerSec:[0, 2, 4, 6],
  costs:[200, 380, 700]
},

// Repair / Emergency upgrades (levels 0~3; purchased during setup/shop)
coreRepairUpg: {
  heal:[75, 90, 105, 120],
  cd:[5.0, 4.5, 4.0, 3.5],
  costs:[140, 280, 520]
},
coreEmergencyUpg: {
  restorePct:[0.38, 0.42, 0.46, 0.50],
  cd:[15.0, 14.0, 13.0, 12.0],
  costs:[160, 320, 580]
},
skillUpg: {
  // Levels: 0~3
  // Energy Cannon damage is shown as explicit values for clarity.
  // Lv0~Lv3 = 800 / 900 / 1000 / 1100 (+final effect)
  energy: { damage:[800,900,1000,1100], cd:[40,38,36,34], charge:[3.0,2.9,2.8,2.7], costs:[260,520,900], finalShRestore:25 },
  // Lv3 special: 가시갑옷 — while invulnerable, reflect blocked damage back to the attacker.
  wall:   { inv:[1.00,1.15,1.30,1.45], cd:[20,19,18,17], costs:[220,440,760],
            // Lv3 special (가시갑옷): while invulnerable, reflect blocked damage back to the attacker.
            finalThornsPct:0.65, finalThornsBossEff:0.55,
            finalThornsMinBase:30, finalThornsMinPerWave:2,
            finalThornsHitCap:700, finalThornsHitCapBoss:550,
            finalThornsSecCap:1700, finalThornsSecCapBoss:1200,
            finalThornsSplashPct:0.30, finalThornsSplashR:160 },

  // Lv3 special: while active, skills recharge their cooldowns 15% faster.
  warp:   { dur:[3.5,3.9,4.3,4.7], cd:[26,25,24,23], radius:[600,640,680,720],
            move:[0.45,0.48,0.51,0.54], atk:[0.25,0.27,0.29,0.31], costs:[240,480,820], bossEff:0.60,
            finalCdBoost:0.15 }
},
    // Overdrive felt too weak. Buff the core auto-attack and make both damage/attack speed scale up to 2x as HP drops.
    // (Scaling uses act100to10: reaches max at 10% HP)
    overdrive: { maxDmgBonus: 1.00, maxAspdBonus: 1.00, splashPct: 0.30, splashRadius: 90, baseDmg: 30, baseShotsPerSec: 1.80, range: 520 },
    energyCannon: { damage: 800, chargeSec: 3.0, cooldownSec: 40.0, splashPct: 0.30, splashRadius: 140 },

    // NEW skills
    wall: { cost: 50, invulnSec: 1.0, cooldownSec: 20.0 },
    timeWarp: { cost: 40, durationSec: 3.5, cooldownSec: 26.0, radius: 600, moveSlowPct: 0.45, atkSlowPct: 0.25, bossEff: 0.60 },
    meteor: { delaySec: 8.0, warnSec: 0.85, damage: 280, spawnFromWave: 16, impactRadius: 320, turretDmgPct: 0.35 },
    repair: { cost: 20, cooldownSec: 5.0, healHpFlat: 75 },
    emergencyShield: { restorePct: 0.38, cooldownSec: 15.0 },
    // Critical hits (turrets only).
    crit: { baseChance: 0.06, perLevelChance: 0.02, maxChance: 0.25, mult: 1.75 },

    turrets: {
      // NOTE: basic turret felt too slow early game. Increase base RoF.
      // User request: increase basic turret base damage by ~50%
      basic:  { name:"기본",   cost:90, range:380, shotsPerSec:2.00, dmg:36, projSpeed:820, splashPct:0.0,  splashR:0,  slowPct:0.0,  slowSec:0.0,  slowBossEff:1.0 },
      slow:   { name:"슬로우", cost:120, range:340, shotsPerSec:0.85, dmg:10, projSpeed:780, splashPct:0.0,  splashR:0,  slowPct:0.35, slowSec:1.2,  slowBossEff:0.6 },
      splash: { name:"스플",   cost:150, range:350, shotsPerSec:0.60, dmg:22, projSpeed:760, splashPct:0.75, splashR:70, slowPct:0.0,  slowSec:0.0,  slowBossEff:1.0 }
    },
    // Turrets can now be damaged by certain enemies (e.g., suicide bomber).
    turretHP: { basic: 140, slow: 160, splash: 180 },
    economy: { crystalMul: 0.65 },
    // Minimum distance from the core where players are allowed to place turrets.
    // User request: reduce the no-build radius by half.
    turret: { minDistFromCore: 90, minDistBetweenTurrets: 72 },
    // Turret full-repair utility (1 click = heal to full; cost scales with missing HP)
    turretRepair: { cmin:6, cmax:28, pow:1.4, globalCd:0.4, perTurretCd:6.0, pickR:28, multiRadius:220, multiMax:12 },
rebuild: { maxArmorHP: 15.0, maxArmorSH: 7.5, maxAtHpPct: 0.10, oocDelay: 4.0, oocRegenPerSec: 20.0 },
    resonance: { gainPerDamage: 0.65, max: 100, dmgBonusMax: 0.35, aspdBonusMax: 0.25, pulseRadius: 650, pulseDamage: 0, rangedMul: 1.35, pulseIcd: 0.35 },
    overload: {
      activeOnEnterHpPct: 0.30, burstSec: 6.0, cooldownSec: 18.0, slowSec: 0.6,
      markMax: 5, markRefresh: 4.0, piercePlus: 1,
      nosplashExplosionRadius: 90, nosplashExplosionPct: 0.35,
      baseTurretDmgBonusMax: 0.35, baseTurretAspdBonusMax: 0.25
    },
    enemy: { baseSpeed: 86, baseHp: 140, dmgOnHit: 14, hitInterval: 1.05, radius: 14 },
    // Special enemies
    enemySpecial: {
      ranged:    { keepDist: 320, range: 520, shotsPerSec: 0.85, projSpeed: 640, projDmg: 10 },
      // Suicide bomber explosion: slightly larger AoE per latest balance request.
      bomber:    { explodeRadius: 140, triggerDist: 40, turretDmg: 110, coreDmg: 110 },
      disruptor: { keepDist: 340, range: 560, shotsPerSec: 0.75, projSpeed: 620, projDmg: 8, shLockSec: 1.0, repairLockSec: 1.0 },
      sniper:   { keepDist: 560, range: 980, shotsPerSec: 0.455, projSpeed: 980, projDmg: 24 },
      // Bosses: ranged attackers with much higher HP.
      // Slight buff: regular bosses felt a bit weak; increase projectile damage a little.
      // Regular boss tuning: slightly higher pressure (ranged-only in practice)
      boss:      { keepDist: 300, range: 720, shotsPerSec: 1.00, projSpeed: 720, projDmg: 20 },
      finalBoss: { keepDist: 340, range: 820, shotsPerSec: 1.15, projSpeed: 780, projDmg: 22 }
    },
    difficulty: {
      normal: { enemyHpMul: 1.0, enemySpeedMul: 1.0, eliteChanceAdd: 0.0, bossHpMul: 1.0 },
      hard:   { enemyHpMul: 1.20, enemySpeedMul: 1.06, eliteChanceAdd: 0.02, bossHpMul: 2.30 }
    }
  };



  // ===== Event Stage Modifiers (Random, every 3 waves; not on boss/final) =====
  const EVENT_POOL = [
    { key:"goldRush",    name:"황금 채굴",     desc:"자원획득 +40% (이 웨이브)",
      mods:{ crystalMul:1.40, clearBonusFlat:0,  clearBonusPerWave:0 } },

    { key:"shieldPierce", name:"불안정한 코어", desc:"적 피해의 50%가 보호막을 무시하고 HP로 직격",
      mods:{ shieldPiercePct:0.50, crystalMul:1.25, clearBonusFlat:40, clearBonusPerWave:2 } },

    { key:"longRange",   name:"장거리 포격전", desc:"원거리 적 등장↑ + 포탑 사거리 +12%",
      mods:{ turretRangeMul:1.12, spawnRangedAdd:0.08, crystalMul:1.10, clearBonusFlat:20, clearBonusPerWave:1 } },

    { key:"swarm",       name:"속도전",       desc:"빠른 적 등장↑ + 포탑 공속 +12%",
      mods:{ turretAspdMul:1.12, spawnFastAdd:0.12, crystalMul:1.05, clearBonusFlat:20, clearBonusPerWave:1 } },

    { key:"heavyArmor",  name:"중장갑 돌파",  desc:"탱크/엘리트↑ + 포탑 피해 +12%",
      mods:{ turretDmgMul:1.12, spawnTankAdd:0.08, spawnEliteAdd:0.03, crystalMul:1.08, clearBonusFlat:25, clearBonusPerWave:1 } },

    { key:"shDamp",      name:"보호막 교란장", desc:"보호막 재생 -50% + 공명 획득 +30%",
      mods:{ shRegenMul:0.50, resonanceGainMul:1.30, crystalMul:1.15, clearBonusFlat:30, clearBonusPerWave:1 } },

    { key:"bomberMania", name:"잔해 폭풍",     desc:"자폭맨 등장↑ + 자폭맨 보상 +50%",
      mods:{ spawnBomberAdd:0.10, bomberRewardMul:1.50, crystalMul:1.00, clearBonusFlat:30, clearBonusPerWave:2 } },

    { key:"disruptField", name:"교란 공습",    desc:"디스럽터 등장↑ (수리/재생 차단) + 크리스탈 +15%",
      mods:{ spawnDisruptAdd:0.08, crystalMul:1.15, clearBonusFlat:20, clearBonusPerWave:2 } },
  ];
  // roundRect fallback
  function rrPath(ctx, x,y,w,h,r){
    r = Math.max(0, Math.min(r, Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }



  // ===== Audio (BGM + SFX) =====
  const AudioSys = {
    ctx:null, master:null, musicGain:null, sfxGain:null,
    musicOn:true, sfxOn:true, masterVol:0.85,
    // internal loudness boost (slider 0~1 maps to 0~masterBoost)
    masterBoost: 2.0,
    comp:null,
    unlocked:false,
    // BGM modes: idle(대기), battle(웨이브), boss(보스), final(최종), defeat(붕괴패배), endingNormal(노말엔딩), endingGood(트루엔딩), endingBad(배드엔딩)
    bgmMode:"idle", _bgmTimer:null, _nextNoteT:0, _step:0, _lastSfx:{},
    _bpm:78,
    _energyCharge:null,

    unlock(){
      if (AudioSys.unlocked) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC){ AudioSys.unlocked=true; return; }
      try{
        AudioSys.ctx = new AC();
        if (AudioSys.ctx.state==="suspended"){ AudioSys.ctx.resume(); }
        AudioSys.master = AudioSys.ctx.createGain();
        AudioSys.musicGain = AudioSys.ctx.createGain();
        AudioSys.sfxGain = AudioSys.ctx.createGain();

        // gentle compressor so we can push volume up on mobile without harsh clipping
        AudioSys.comp = AudioSys.ctx.createDynamicsCompressor();
        AudioSys.comp.threshold.value = -20;
        AudioSys.comp.knee.value = 18;
        AudioSys.comp.ratio.value = 3;
        AudioSys.comp.attack.value = 0.003;
        AudioSys.comp.release.value = 0.25;

        AudioSys.musicGain.gain.value = 0.70;
        AudioSys.sfxGain.gain.value = 1.15;
        AudioSys.master.gain.value = AudioSys.masterVol * AudioSys.masterBoost;

        AudioSys.musicGain.connect(AudioSys.master);
        AudioSys.sfxGain.connect(AudioSys.master);
        AudioSys.master.connect(AudioSys.comp);
        AudioSys.comp.connect(AudioSys.ctx.destination);

        // tiny unlock ping
        AudioSys._ping(220, 0.01, 0.001);

        AudioSys.unlocked=true;
        AudioSys._startBgm();
        AudioSys.uiSync();
      }catch(_e){
        AudioSys.unlocked=true;
      }
    },

    setMasterVol(v){
      AudioSys.masterVol = clamp(v,0,1);
      if (AudioSys.master) AudioSys.master.gain.value = AudioSys.masterVol * AudioSys.masterBoost;
    },
    setMusicOn(on){
      AudioSys.musicOn = !!on;
      if (!AudioSys.musicOn) AudioSys._stopBgm();
      else AudioSys._startBgm();
      AudioSys.uiSync();
    },
    setSfxOn(on){
      AudioSys.sfxOn = !!on;
      AudioSys.uiSync();
    },

    uiSync(){
      const b1 = document.getElementById("btn-music");
      const b2 = document.getElementById("btn-sfx");
      if (b1) b1.classList.toggle("off", !AudioSys.musicOn);
      if (b2) b2.classList.toggle("off", !AudioSys.sfxOn);
    },

    setBgmMode(mode){
      mode = (mode==="idle"||mode==="battle"||mode==="boss"||mode==="final"||mode==="defeat"||mode==="endingNormal"||mode==="endingGood"||mode==="endingBad") ? mode : "idle";
      if (AudioSys.bgmMode===mode) return;
      AudioSys.bgmMode = mode;
      if (!AudioSys.ctx || !AudioSys.musicGain || !AudioSys.musicOn) return;

      const ctx = AudioSys.ctx;
      const t = ctx.currentTime;
      const target = (mode==="final") ? 0.98 : (mode==="boss") ? 0.92 : (mode==="battle") ? 0.85 : (mode==="endingGood") ? 0.80 : (mode==="endingNormal") ? 0.78 : (mode==="endingBad") ? 0.74 : (mode==="defeat") ? 0.72 : 0.70;
      const bpm = (mode==="final") ? 128 : (mode==="boss") ? 118 : (mode==="battle") ? 110 : (mode==="endingGood") ? 96 : (mode==="endingNormal") ? 88 : (mode==="endingBad") ? 64 : (mode==="defeat") ? 60 : 78;

      // fade out -> reset sequencer -> fade in (prevents BPM drift)
      const g = AudioSys.musicGain.gain;
      g.cancelScheduledValues(t);
      const cur = g.value;
      g.setValueAtTime(cur, t);
      g.linearRampToValueAtTime(0.0001, t+0.10);

      setTimeout(()=>{
        if (!AudioSys.ctx || !AudioSys.musicGain || !AudioSys.musicOn) return;
        const t2 = AudioSys.ctx.currentTime;
        AudioSys._bpm = bpm;
        AudioSys._nextNoteT = t2 + 0.06;
        AudioSys._step = 0;
        const g2 = AudioSys.musicGain.gain;
        g2.cancelScheduledValues(t2);
        g2.setValueAtTime(0.0001, t2);
        g2.linearRampToValueAtTime(target, t2+0.18);
      }, 110);
    },

    startEnergyCharge(durSec){
      if (!AudioSys.sfxOn) return;
      AudioSys.unlock();
      if (!AudioSys.ctx) return;
      AudioSys.stopEnergyCharge();

      const ctx = AudioSys.ctx;
      const t0 = ctx.currentTime;
      const dur = Math.max(0.05, durSec||0.05);

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      // subtle vibrato LFO
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.type="sine"; lfo.frequency.setValueAtTime(6, t0);
      lfoG.gain.setValueAtTime(10, t0);
      lfo.connect(lfoG); lfoG.connect(o.frequency);

      o.type="sine";
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(520, t0+dur);

      g.gain.setValueAtTime(0.0001, t0);
      // ramp up steadily during charge
      g.gain.linearRampToValueAtTime(0.140, t0+dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur+0.08);

      o.connect(g); g.connect(AudioSys.sfxGain);
      o.start(t0); lfo.start(t0);
      o.stop(t0+dur+0.12); lfo.stop(t0+dur+0.12);

      AudioSys._energyCharge = {o,g,lfo,lfoG, until:t0+dur+0.12};
    },

    stopEnergyCharge(){
      const c = AudioSys._energyCharge;
      if (!c || !AudioSys.ctx){ AudioSys._energyCharge=null; return; }
      try{
        const t = AudioSys.ctx.currentTime;
        c.g.gain.cancelScheduledValues(t);
        c.g.gain.setValueAtTime(Math.max(0.0001, c.g.gain.value), t);
        c.g.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
        c.o.stop(t+0.07);
        if (c.lfo) c.lfo.stop(t+0.07);
      }catch(_){}
      AudioSys._energyCharge = null;
    },

    _now(){ return AudioSys.ctx ? AudioSys.ctx.currentTime : 0; },

    _ping(freq, dur, vol){
      if (!AudioSys.ctx) return;
      const t0 = AudioSys._now();
      const o = AudioSys.ctx.createOscillator();
      const g = AudioSys.ctx.createGain();
      o.type="sine"; o.frequency.value=freq;
      g.gain.value=0;
      o.connect(g); g.connect(AudioSys.sfxGain);
      o.start(t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0+0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.stop(t0+dur+0.02);
    },

    sfx(name, intensity=1){
      if (!AudioSys.sfxOn) return;
      AudioSys.unlock();
      if (!AudioSys.ctx) return;

      const t = AudioSys._now();
      const last = AudioSys._lastSfx[name] || -999;

      const minGap = ({
        click:0.05, place:0.08, buy:0.10, error:0.12,
        shot_basic:0.035, shot_slow:0.04, shot_splash:0.05, crit:0.08,
        hit:0.08, shieldHit:0.06, shieldBreak:0.25, expl:0.07,
        crystal:0.07, waveStart:0.12, waveClear:0.18,
        energyCharge:0.25, energyFire:0.25,
        resonance:0.20, gameOver:0.50,
        overdriveShot:0.04,
        enemyShot:0.06, enemyDisrupt:0.08,
        bomberExplode:0.22,
        turretHit:0.06, turretBreak:0.25,
        repair:0.18, emergencyShield:0.22,
        wall:0.20, wallBlock:0.06, timeWarp:0.22, meteor:0.35, meteorImpact:0.25
      }[name] ?? 0.03);

      if (t - last < minGap) return;
      AudioSys._lastSfx[name]=t;

      const make=(type,f0,f1,dur,vol)=>{
        const SFX_MUL = 2.2;
        vol *= SFX_MUL;
        const o = AudioSys.ctx.createOscillator();
        const g = AudioSys.ctx.createGain();
        o.type=type;
        o.frequency.setValueAtTime(f0, t);
        if (f1!=null) o.frequency.exponentialRampToValueAtTime(Math.max(30,f1), t+dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
        o.connect(g); g.connect(AudioSys.sfxGain);
        o.start(t); o.stop(t+dur+0.02);
      };

      const vol = 0.03 + 0.02*clamp(intensity, 0, 2);

      switch(name){
        case "click": make("sine", 640, 820, 0.05, 0.035); break;
        case "place": make("triangle", 220, 440, 0.10, 0.045); break;
        case "buy": make("sine", 520, 1320, 0.12, 0.050); break;
        case "repair": make("sine", 520, 1040, 0.12, 0.045); break;
        case "emergencyShield": make("sine", 260, 1320, 0.18, 0.050); break;
        case "wall":
          make("sine", 220, 620, 0.16, 0.050);
          AudioSys._ping(980, 0.06, 0.020);
          break;
        case "wallBlock":
          make("square", 420, 160, 0.10, 0.048);
          AudioSys._ping(760, 0.05, 0.018);
          break;
        case "timeWarp":
          make("sine", 520, 220, 0.22, 0.050);
          setTimeout(()=>AudioSys._ping(880, 0.06, 0.018), 60);
          setTimeout(()=>AudioSys._ping(740, 0.05, 0.016), 120);
          break;

        case "meteor":
          // incoming warning
          make("sine", 190, 90, 0.28, 0.055);
          setTimeout(()=>AudioSys._ping(420, 0.08, 0.018), 80);
          break;
        case "meteorImpact":
          // heavy impact
          make("square", 120, 55, 0.26, 0.075);
          setTimeout(()=>AudioSys._ping(260, 0.10, 0.020), 30);
          break;

        case "error": make("square", 140, 90, 0.12, 0.05); break;

        case "shot_basic": make("triangle", 520, 420, 0.06, 0.030); break;
        case "shot_slow":  make("sine", 360, 280, 0.07, 0.028); break;
        case "shot_splash":make("triangle", 260, 140, 0.09, 0.032); break;
        case "crit":
          make("sine", 1240, 520, 0.10, 0.050);
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(1760, 0.05, 0.016); }, 0);
          break;

        case "hit": make("square", 160, 90, 0.10, 0.042); break;
        case "shieldHit": make("sine", 420, 240, 0.08, 0.034); break;
        case "shieldBreak": make("square", 110, 70, 0.16, 0.052); break;
        case "expl": make("triangle", 200, 80, 0.12, 0.050); break;

        case "crystal":
          make("sine", 880, 1320, 0.10, 0.030);
          // sparkle tail
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(1760, 0.05, 0.015); }, 0);
          break;

        case "waveStart": make("sine", 240, 520, 0.18, 0.045); break;
        case "waveClear":
          make("triangle", 440, 660, 0.22, 0.050);
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(880, 0.12, 0.020); }, 0);
          break;

        case "energyCharge": make("sine", 220, 440, 0.20, 0.040); break;
        case "energyFire":
          make("square", 180, 70, 0.22, 0.060);
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(900, 0.08, 0.020); }, 0);
          break;

        case "overdriveShot":
          // distinct from turret shots: sharper, slightly metallic
          make("sawtooth", 860, 360, 0.09, 0.050);
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(1240, 0.06, 0.018); }, 0);
          break;

        case "enemyShot":
          // enemy ranged shot: slightly duller than turret fire
          make("square", 360, 220, 0.11, 0.042);
          break;
        case "enemyDisrupt":
          // debuff shot: higher + shimmering tail
          make("sine", 520, 300, 0.14, 0.045);
          setTimeout(()=>{ if(AudioSys.ctx) AudioSys._ping(980, 0.08, 0.015); }, 0);
          break;
        case "bomberExplode":
          make("triangle", 190, 60, 0.18, 0.065);
          break;
        case "turretHit":
          make("triangle", 420, 260, 0.07, 0.038);
          break;
        case "turretBreak":
          make("square", 120, 70, 0.16, 0.060);
          break;

        case "resonance": make("sine", 520, 260, 0.18, 0.050); break;
        case "gameOver": make("square", 120, 45, 0.45, 0.070); break;
        default: make("sine", 500, 400, 0.06, vol); break;
      }
    },

    _startBgm(){
      if (!AudioSys.musicOn) return;
      if (!AudioSys.ctx) return;
      if (AudioSys._bgmTimer) return;

      const ctx = AudioSys.ctx;
      const mode = AudioSys.bgmMode || "idle";
      AudioSys._bpm = (mode==="final") ? 128 : (mode==="boss") ? 118 : (mode==="battle") ? 110 : (mode==="endingGood") ? 96 : (mode==="endingNormal") ? 88 : (mode==="endingBad") ? 64 : (mode==="defeat") ? 60 : 78;
      if (AudioSys.musicGain){
        AudioSys.musicGain.gain.value = (mode==="final") ? 0.98 : (mode==="boss") ? 0.92 : (mode==="battle") ? 0.85 : (mode==="endingGood") ? 0.80 : (mode==="endingNormal") ? 0.78 : (mode==="endingBad") ? 0.74 : (mode==="defeat") ? 0.72 : 0.70;
      }
      AudioSys._nextNoteT = ctx.currentTime + 0.06;
      AudioSys._step = 0;

      const tick=()=>{
        if (!AudioSys.musicOn || !AudioSys.ctx) return;
        const t = ctx.currentTime;
        const ahead = 0.25;
        const spb = 60/AudioSys._bpm;
        const stepDur = spb/2; // 8th notes
        while (AudioSys._nextNoteT < t + ahead){
          AudioSys._playBgmStep(AudioSys._nextNoteT, AudioSys._step, stepDur);
          AudioSys._nextNoteT += stepDur;
          AudioSys._step = (AudioSys._step+1) % (8*4); // 4 bars loop
        }
      };
      AudioSys._bgmTimer = setInterval(tick, 50);
    },
    _stopBgm(){
      if (AudioSys._bgmTimer){ clearInterval(AudioSys._bgmTimer); AudioSys._bgmTimer=null; }
    },
    _playBgmStep(t, step, dur){
      if (!AudioSys.ctx || !AudioSys.musicOn) return;
      const ctx = AudioSys.ctx;
      const mode = AudioSys.bgmMode || "idle";

      const bar = Math.floor(step/8);
      const idx = step % 8;

      const play=(freq, d, vol, typeA="triangle", typeB="sine")=>{
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g  = ctx.createGain();

        o1.type = typeA;
        o2.type = typeB;
        o1.frequency.setValueAtTime(freq, t);
        o2.frequency.setValueAtTime(freq*2, t);

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t+d*0.95);

        o1.connect(g); o2.connect(g);
        g.connect(AudioSys.musicGain);

        o1.start(t); o2.start(t);
        o1.stop(t+d); o2.stop(t+d);
      };

      // ---- idle (setup/shop) ----
      if (mode === "idle"){
        // C - Am - F - G (gentle)
        const roots = [261.63, 220.00, 174.61, 196.00];
        const root = roots[bar % roots.length];
        const arp  = [1, 1.25, 1.5, 2, 1.5, 1.25, 1, 2];

        if (idx % 2 === 0){
          play(root * arp[idx], dur*0.95, 0.032, "sine", "triangle");
        }
        if (idx === 0){
          play(root/2, dur*1.15, 0.018, "sine", "sine");
        }
        return;
      }

      // ---- defeat (collapse) ----
      if (mode === "defeat"){
        // sparse, low minor tones
        const roots = [220.00, 174.61, 196.00, 164.81]; // A, F, G, E
        const root = roots[bar % roots.length];
        if (idx === 0 || idx === 4){
          play(root,   dur*1.25, 0.028, "sine", "sine");
          play(root*1.5, dur*0.90, 0.018, "triangle", "sine");
        }
        return;
      }



      // ---- ending: normal (neutral resolve) ----
      if (mode === "endingNormal"){
        // C - G - Am - F (calm, resolved)
        const roots = [261.63, 196.00, 220.00, 174.61];
        const root = roots[bar % roots.length];
        const arp  = [1, 1.25, 1.5, 2, 1.5, 1.25, 1, 2];
        if (idx % 2 === 0){
          play(root * arp[idx], dur*0.95, 0.034, "sine", "triangle");
        }
        if (idx === 0){
          play(root/2, dur*1.15, 0.020, "sine", "sine");
        }
        return;
      }

      // ---- ending: good (uplift) ----
      if (mode === "endingGood"){
        // C - F - G - C (bright)
        const roots = [261.63, 349.23, 392.00, 261.63];
        const root = roots[bar % roots.length];
        const arp  = [1, 1.5, 2, 1.25, 1.5, 2, 1, 2];
        const f = root * arp[idx];
        if (idx % 2 === 0) play(f, dur*0.95, 0.040, "triangle", "sine");
        if (idx === 0 || idx === 4) play(root/2, dur*1.15, 0.020, "sine", "sine");
        // sparkle on bar start
        if (idx === 0){
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(root*4, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.012, t+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t+0.08);
          o.connect(g); g.connect(AudioSys.musicGain);
          o.start(t); o.stop(t+0.09);
        }
        return;
      }

      // ---- ending: bad (despair) ----
      if (mode === "endingBad"){
        // Am - F - Dm - E (tense minor)
        const roots = [220.00, 174.61, 293.66, 329.63];
        const root = roots[bar % roots.length];
        if (idx === 0 || idx === 4){
          play(root, dur*1.30, 0.030, "sine", "sine");
          // add a small dissonant bite (tritone-ish) very quietly
          play(root*1.4142, dur*0.80, 0.010, "triangle", "sine");
        }
        if (idx === 2){
          play(root*0.5, dur*1.00, 0.012, "sine", "sine");
        }
        return;
      }



      // ---- boss ----
      if (mode === "boss"){
        // Dm - Bb - F - C (more "웅장")
        const roots = [293.66, 233.08, 174.61, 261.63];
        const root = roots[bar % roots.length];
        const arp  = [1, 1.5, 2, 1.25, 1.5, 2, 1, 1.25];
        const f = root * arp[idx];

        play(f, dur*0.95, 0.052, "sawtooth", "triangle");

        // stronger kick on downbeats
        if (idx === 0 || idx === 4){
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(95, t);
          o.frequency.exponentialRampToValueAtTime(40, t+0.09);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.050, t+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t+0.11);
          o.connect(g); g.connect(AudioSys.musicGain);
          o.start(t); o.stop(t+0.12);
        }

        // brass-like stab
        if (idx === 2 || idx === 6){
          play(root*3, dur*0.70, 0.020, "square", "triangle");
        }
        return;
      }

      // ---- final ----
      if (mode === "final"){
        // Em - C - G - D (최종전: 더 웅장)
        const roots = [329.63, 261.63, 196.00, 293.66];
        const root = roots[bar % roots.length];
        const arp  = [1, 1.5, 2, 1.25, 1.5, 2, 1.25, 2];
        const f = root * arp[idx];

        play(f, dur*0.95, 0.060, "sawtooth", "sine");

        // heavy kick
        if (idx === 0 || idx === 4){
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(90, t);
          o.frequency.exponentialRampToValueAtTime(35, t+0.10);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.060, t+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
          o.connect(g); g.connect(AudioSys.musicGain);
          o.start(t); o.stop(t+0.13);
        }

        // extra harmony shimmer
        if (idx % 2 === 0){
          play(root*2, dur*0.80, 0.018, "triangle", "triangle");
        }
        return;
      }
      // ---- battle (wave) ----
      // chord progression: Am - F - C - G
      const roots = [220.00, 174.61, 261.63, 196.00];
      const root = roots[bar % roots.length];
      const arp  = [1, 1.5, 2, 1.25, 1.5, 2, 1, 1.25];
      const f = root * arp[idx];

      play(f, dur*0.95, 0.040, "triangle", "sine");

      // soft kick on downbeats
      if (idx === 0 || idx === 4){
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(85, t);
        o.frequency.exponentialRampToValueAtTime(45, t+0.08);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.030, t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.10);
        o.connect(g); g.connect(AudioSys.musicGain);
        o.start(t); o.stop(t+0.11);
      }
    }
  };



  // ===== Visual helpers (shake + core break) =====
  function addShake(s, mag, t){
    if (!s.camera) return;
    s.camera.shakeMag = Math.max(s.camera.shakeMag, mag);
    s.camera.shakeT = Math.max(s.camera.shakeT, t);
  }

  function passiveMul(s){
    return (s.passives && s.passives.fromRebirth) ? (s.passives.fromRebirthMul||0.8) : 1.0;
  }

  function twMul(s){
    return (s.passives && s.passives.rebirthTw) ? 1.15 : 1.0;
  }

  function triggerRewind(s){
    if (s.game.phase === "rewind") return;
    s.passives.rebirthUsed = true;
    s.game.phase = "rewind";
    s.game.rewindT = 0;
    s.game.rewindDur = 1.6;
    s.skill.energyCannon.charging = false;
    AudioSys.stopEnergyCharge();
  }

  function clearRebirthHazards(s){
    s.entities.projectiles.length = 0;
    s.entities.fx = s.entities.fx.filter(fx => fx.type !== "meteorWarn");
  }

  function finishRebirth(s){
    s.core.destroyed = false;
    s.core.hp = Math.max(1, s.core.hpMax * 0.45);
    s.core.sh = Math.max(0, s.core.shMax * 0.25);
    s.core.rebirthInvulT = 3.0;
    s.core.shRegenLock = 0;
    s.core.repairLock = 0;
    s.coreBreak.active = false;
    s.coreBreak.shards = [];
    clearRebirthHazards(s);

    const pool = ["rebuild","resonance","overload","overdrive"];
    s.passives.selected = pool[(Math.random()*pool.length)|0];
    s.passives.fromRebirth = true;
    s.passives.fromRebirthMul = 0.8;

    s.game.phase = "wave";
    s.ui.status = "부활 발동! 3초 무적";
    s.ui.status2 = "랜덤 패시브 효과 80% 적용";
    UI.updatePassiveDesc();
    UI.syncPassiveButtons();
    AudioSys.sfx("timeWarp", 0.85);
  }

  function triggerGameOver(s){
    if (s.game.phase === "gameover") return;

    s.game.phase = "gameover";
    s.game.running = true;  // keep stepping for animations
    s.game.paused = false;
    s.game.overT = 0;


    // bad ending: defeat during final wave (W30)
    s.game.badEnding = (s.game.waveIndex===30);
    s.core.destroyed = true;
    // force shield to 0 and stop regen (requested)
    s.core.sh = 0;
    s.core.shRegenLock = 99999;
    // stop turrets immediately
    for (const t of s.entities.turrets){ t.cd = 999; }


    // clear combat projectiles so the break reads clean
    s.entities.projectiles.length = 0;

    // Spawn shatter shards from core center
    const shards = [];
    const cx = s.core.x, cy = s.core.y;
    const n = 36;
    for (let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + (Math.random()-0.5)*0.4;
      const sp = 180 + Math.random()*520;
      shards.push({
        x: cx + (Math.random()-0.5)*18,
        y: cy + (Math.random()-0.5)*18,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp - (220 + Math.random()*220),
        rot: Math.random()*Math.PI*2,
        vr: (Math.random()-0.5)*8,
        size: 10 + Math.random()*28,
        life: 0,
        ttl: 1.0 + Math.random()*0.9
      });
    }
    s.coreBreak.active = true;
    s.coreBreak.t = 0;
    s.coreBreak.shards = shards;

    // flash + shock + shake
    s.entities.fx.push({type:"coreFlash", x:cx, y:cy, t:0.35});
    s.entities.fx.push({type:"shock", x:cx, y:cy, t:0.6});
    // no shake on collapse (requested)
    if (s.camera){ s.camera.shakeT = 0; s.camera.shakeMag = 0; }

    s.ui.status = "코어 파괴! (재시작 버튼)";
    s.ui.status2 = "";
    AudioSys.stopEnergyCharge();
    AudioSys.setBgmMode(s.game.badEnding ? "endingBad" : "defeat");
    AudioSys.sfx("gameOver");
  }

  function updateCoreBreak(s, dt){
    if (!s.coreBreak || !s.coreBreak.active) return;
    s.coreBreak.t += dt;

    const g = 980;
    for (let i=s.coreBreak.shards.length-1; i>=0; i--){
      const sh = s.coreBreak.shards[i];
      sh.life += dt;
      sh.vy += g*dt;
      sh.x += sh.vx*dt;
      sh.y += sh.vy*dt;
      sh.vx *= (1 - dt*0.35);
      sh.rot += sh.vr*dt;
      if (sh.life >= sh.ttl) s.coreBreak.shards.splice(i, 1);
    }
    if (s.coreBreak.shards.length === 0 && s.coreBreak.t > 1.1){
      s.coreBreak.active = false;
    }
  }

  function drawCoreBreak(ctx, s){
    if (!s.coreBreak || !s.coreBreak.active) return;

    // shards
    for (const sh of s.coreBreak.shards){
      const p = clamp(sh.life/sh.ttl, 0, 1);
      const a = 1-p;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.globalAlpha = 0.85*a;

      ctx.fillStyle = "rgba(90,190,254,0.85)";
      ctx.beginPath();
      ctx.moveTo(-sh.size*0.7, -sh.size*0.45);
      ctx.lineTo(sh.size*0.9, 0);
      ctx.lineTo(-sh.size*0.25, sh.size*0.75);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.55*a;
      ctx.fillStyle = "rgba(219,234,254,0.9)";
      ctx.beginPath();
      ctx.moveTo(-sh.size*0.4, -sh.size*0.25);
      ctx.lineTo(sh.size*0.45, 0);
      ctx.lineTo(-sh.size*0.12, sh.size*0.42);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // center smoke bloom
    const cx = s.core.x, cy = s.core.y;
    const t = s.coreBreak.t;
    const fade = clamp(1 - t/1.2, 0, 1);
    const r = 70 + 160*(1-fade);
    ctx.save();
    ctx.globalAlpha = 0.35*fade;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, "rgba(70,170,255,0.35)");
    g.addColorStop(0.6, "rgba(20,40,80,0.18)");
    g.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }


  const Assets = {
    towerImg: null,
    load(){
      // Never block boot: resolve even if onload/onerror never fires (some content:// cases)
      return new Promise((resolve) => {
        const img = new Image();
        let done=false;
        const finish=()=>{ if(done) return; done=true; resolve(); };
        const timeout=setTimeout(()=>{ Assets.towerImg=null; finish(); }, 700);
        img.onload = () => { clearTimeout(timeout); Assets.towerImg = img; finish(); };
        img.onerror = () => { clearTimeout(timeout); Assets.towerImg = null; finish(); };
        img.src = "./assets/tower.png";
      });
    }
  };

  const State = {
    reset(){
      // Unlocks persist via localStorage (e.g., Hard Mode after seeing an ending once)
      let hardUnlocked = false;
      try{ hardUnlocked = (localStorage.getItem("td_hard_unlocked")==="1"); }catch(_){ hardUnlocked = false; }
      return {
        debug:{ frames:0, lastErr:null },
        unlocks:{ hard: hardUnlocked },
        cheat:{ enabled:true, open:false, infiniteCrystals:false, god:false },
        game: {
          running:false, paused:false, phase:"menu", waveIndex:0, difficulty:"normal", speed:1.0, time:0, overT:0,
          // ending cinematic (after final boss clear, before clear overlay)
          endingDur:0,
          endingT:0,
          badEnding:false,
          endingType:null,
          endingHint:"",
          stats:{ leechStolen:0, meteorCalls:0, meteorImpacts:0 },
          event:{active:false, key:null, name:"", desc:"", mods:{}},
          lastEventKey:null,
          // Preview for the next wave (UI)
          nextWavePreview:{ waveIndex:0, boss:false, final:false, event:null, enemyKinds:[] },
          nextEventPreview:null,
          rewindT:0,
          rewindDur:1.6
        },
        resources: { crystals:220 },
        build: { turretType:"basic" },
        core: {
          x: CFG.LOGICAL_W*0.50, y: CFG.LOGICAL_H*0.50,
          destroyed:false,
          hpMax: CFG.core.hpMax, hp: CFG.core.hpMax,
          shMax: CFG.core.shMax, sh: CFG.core.shMax,
          shRegenLock: 0,
          // blocks "repair" (HP regen from rebuild passive, and future repair actions)
          repairLock: 0,
          repairCd: 0,
          emergencyCd: 0,
          lastHitAt: -999,
          armorHpLv: 0,
          armorShLv: 0,
          hpMaxLv: 0,
          shMaxLv: 0,
          shRegenLv: 0,
          repairUpgLv: 0,
          emergencyUpgLv: 0,
          rebirthInvulT: 0
        },
        passives: {
          selected:null, locked:false,
          rebirthSelected:false,
          rebirthUsed:false,
          rebirthTw:false,
          fromRebirth:false,
          fromRebirthMul:0.8,
          rebuild:{ emergencyT:0, emergencyCd:0 },
          resonance:{ gauge:0, pulseIcd:0 },
          overload:{ cd:0, burst:0, lastHpPct:1.0, chainExtIcd:0, chainEmergencyIcd:0 },
          overdrive:{ shotCd:0 },
        },
        skill: { energyCannon:{ cd:0, charging:false, charge:0, target:null }, wall:{ cd:0, active:0 }, timeWarp:{ cd:0, active:0 } },
        entities: { enemies:[], turrets:[], projectiles:[], fx:[], nextTurretId:1 },
        flames: [], flameSpawnAcc: 0,
        coreBreak: { active:false, t:0, shards:[] },
        camera: { shakeT:0, shakeMag:0 },
        rewindFrames: { w:320, h:180, every:2, idx:0, count:0, tick:0, buf:[] },
        ui: { buildMode:true, turretRepairMode:false, turretRepairGlobalCd:0, hover:{x:0,y:0,active:false}, status:"", status2:"", toast:{t:0}, selectedTurretId:null, turretAuto:{on:false, mode:"lv"}, _prevWaiting:false }
      };
    }
  };

  const Input = {
    mx:0,my:0,lx:0,ly:0,down:false,justPressed:false,keys:new Set(),
    init(canvas, view){
      const onMove=(e)=>{
        let x,y;
        if (e.touches && e.touches.length){ x=e.touches[0].clientX; y=e.touches[0].clientY; }
        else { x=e.clientX; y=e.clientY; }
        Input.mx=x; Input.my=y;
        const {scale,offX,offY}=view;
        Input.lx=(x-offX)/scale; Input.ly=(y-offY)/scale;
      };
      const onDown=(e)=>{ AudioSys.unlock(); Input.down=true; Input.justPressed=true; onMove(e); };
      const onUp=()=>{ Input.down=false; };
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("touchmove", (e)=>onMove(e), {passive:false});
      canvas.addEventListener("mousedown", onDown);
      canvas.addEventListener("touchstart", (e)=>onDown(e), {passive:false});
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);
      window.addEventListener("keydown",(e)=>Input.keys.add(e.key.toLowerCase()));
      window.addEventListener("keyup",(e)=>Input.keys.delete(e.key.toLowerCase()));
    },
    consumeJustPressed(){ const v=Input.justPressed; Input.justPressed=false; return v; },
    isKey(k){ return Input.keys.has(k); }
  };


  // ===== Upgrade Hub (U) =====
  const UpgHub = {
    ready:false,
    open:false,
    tab:"core",
    coreCat:"max", // max | regen | def | em
    layout:"dock", // dock | modal
    autoOpen:true,
    turretAutoOn:false,
    lastWaiting:false,
    _combat:false,
    _waiting:false,
    refs:{},

    // formatting helpers (match UI rules)
    fmtPct(p, signed=false){
      const v = Math.round(p*100);
      if (signed) return (v>=0?`+${v}%`:`${v}%`);
      return `${v}%`;
    },
    fmtTimeSec(t){ return `${fmt1(t)}s`; },
    fmtMul(m){
      const v = Math.round(m*100)/100;
      let s = v.toFixed(2);
      s = s.replace(/\.00$/, "");
      s = s.replace(/(\.\d)0$/, "$1");
      return `×${s}`;
    },
    turretName(type){
      return ({basic:"기본", slow:"슬로우", splash:"스플"}[type] || type);
    },

    _lsGet(k, def){
      try{ const v=localStorage.getItem(k); return (v==null)?def:v; }catch(_){ return def; }
    },
    _lsSet(k, v){
      try{ localStorage.setItem(k, String(v)); }catch(_){ }
    },

    loadPrefs(){
      this.tab = this._lsGet("td_upghub_tab", this.tab);
      const cc = this._lsGet("td_upghub_corecat", this.coreCat);
      this.coreCat = (cc==="regen"||cc==="def"||cc==="em") ? cc : "max";
      const lay = this._lsGet("td_upghub_layout", this.layout);
      this.layout = (lay==="modal") ? "modal" : "dock";
      const ao = this._lsGet("td_upghub_auto", this.autoOpen?"1":"0");
      this.autoOpen = (ao==="1");
      const sort = this._lsGet("td_upghub_tsort", "lv");
      this.refs.turretSort = (sort==="cost"||sort==="power") ? sort : "lv";
      const ta = this._lsGet("td_tauto_on", "0");
      this.turretAutoOn = (ta==="1");
    },

    savePrefs(){
      this._lsSet("td_upghub_tab", this.tab);
      this._lsSet("td_upghub_corecat", this.coreCat);
      this._lsSet("td_upghub_layout", this.layout);
      this._lsSet("td_upghub_auto", this.autoOpen?"1":"0");
      this._lsSet("td_upghub_tsort", this.refs.turretSort||"lv");
      this._lsSet("td_tauto_on", this.turretAutoOn?"1":"0");
    },

    bindPress(el, fn){
      if (!el) return;
      const handler = (e)=>{
        try{ e.preventDefault(); }catch(_){ }
        AudioSys.unlock();
        fn(e);
      };
      el.addEventListener("click", handler);
      el.addEventListener("touchstart", handler, {passive:false});
    },

    mkLine(name, desc){
      const el = document.createElement("div");
      el.className = "uh-line";
      el.innerHTML = `
        <div class="n"></div>
        <div class="v"><span class="cur"></span> → <span class="next"></span></div>
        <div class="r"><span class="cost"></span><button class="btn small uh-btn">UPG</button></div>
        <div class="d"></div>
      `;
      const o = {
        el,
        nameEl: el.querySelector(".n"),
        curEl: el.querySelector(".cur"),
        nextEl: el.querySelector(".next"),
        costEl: el.querySelector(".cost"),
        btnEl: el.querySelector(".uh-btn"),
        descEl: el.querySelector(".d")
      };
      o.nameEl.textContent = name;
      o.descEl.textContent = desc;

      // PC 클릭 최소화: 줄 아무 데나 클릭해도 업그레이드 (버튼/링크 클릭은 제외)
      el.addEventListener("click", (e)=>{
        const t = e.target;
        if (t && (t.closest && t.closest("button"))) return;
        if (!o.btnEl.disabled) o.btnEl.click();
      });
      return o;
    },

    setLine(o, cur, next, cost, st, enabled){
      // st: "UPG" | "MAX" | "부족"
      o.curEl.textContent = cur;
      o.nextEl.textContent = next;
      o.costEl.textContent = (st==="MAX") ? "" : String(cost);
      o.costEl.classList.toggle("bad", st==="부족");
      o.btnEl.textContent = st;
      o.btnEl.disabled = (st!=="UPG") || !enabled;
      o.el.classList.toggle("locked", !enabled);
    },

    mkSkillCard(key, title){
      const el = document.createElement("div");
      el.className = "uh-skill";
      el.innerHTML = `
        <div class="uh-skill-top"><div class="t"></div><div class="lv"></div></div>
        <div class="uh-skill-mid"></div>
        <div class="uh-skill-bot"><span class="final"></span></div>
        <div class="uh-skill-right"><span class="cost"></span><button class="btn small uh-btn">UPG</button></div>
      `;
      el.querySelector(".t").textContent = title;
      const o = {
        el,
        lvEl: el.querySelector(".lv"),
        midEl: el.querySelector(".uh-skill-mid"),
        finalEl: el.querySelector(".final"),
        costEl: el.querySelector(".cost"),
        btnEl: el.querySelector(".uh-btn")
      };
      el.addEventListener("click", (e)=>{
        const t = e.target;
        if (t && (t.closest && t.closest("button"))) return;
        if (!o.btnEl.disabled) o.btnEl.click();
      });
      return o;
    },

    init(){
      if (this.ready) return;
      this.loadPrefs();

      const hud = document.getElementById("hud");
      if (!hud) return;

      // root panel
      const root = document.createElement("div");
      root.id = "upgHub";
      root.className = `panel upghub hidden ${this.layout}`;

      root.innerHTML = `
        <div class="uh-head">
          <div class="uh-title">업그레이드 허브</div>
          <div class="uh-ctrl">
            <label class="uh-auto"><input type="checkbox" id="chk-upghub-auto"/> 대기 자동열기</label>
            <button class="mini" id="btn-upghub-layout" title="도킹/모달">▦</button>
            <button class="mini" id="btn-upghub-close" title="닫기">✕</button>
          </div>
        </div>
        <div class="uh-tabs">
          <button class="uh-tab" data-tab="core">코어</button>
          <button class="uh-tab" data-tab="skills">스킬</button>
          <button class="uh-tab" data-tab="turrets">포탑</button>
        </div>
        <div class="uh-body">
          <div class="uh-page" data-tab="core">
            <div class="uh-subtabs" aria-label="코어 카테고리">
              <button class="uh-subtab" data-corecat="max">최대치</button>
              <button class="uh-subtab" data-corecat="regen">재생</button>
              <button class="uh-subtab" data-corecat="def">방어</button>
              <button class="uh-subtab" data-corecat="em">긴급</button>
            </div>
            <div class="uh-section" data-corecat="max">
              <div class="uh-sec-body" id="uh-core-max"></div>
            </div>
            <div class="uh-section" data-corecat="regen">
              <div class="uh-sec-body" id="uh-core-regen"></div>
            </div>
            <div class="uh-section" data-corecat="def">
              <div class="uh-sec-body" id="uh-core-def"></div>
            </div>
            <div class="uh-section" data-corecat="em">
              <div class="uh-sec-body" id="uh-core-em"></div>
            </div>
          </div>

          <div class="uh-page" data-tab="skills">
            <div class="uh-skill-col" id="uh-skill-col"></div>
          </div>

          <div class="uh-page" data-tab="turrets">
            <div class="uh-turret-wrap">
              <div class="uh-turret-left">
                <div class="uh-turret-top">
                  <div class="uh-sec-title" style="margin:0;">포탑 리스트</div>
                  <div class="uh-turret-topr">
                    <button class="btn small" id="btn-uh-tbulk" title="가능한 만큼 전체 업그레이드">전체 업글</button>
                    <label class="uh-auto" title="대기시간 진입 시 자동으로 전체 업그레이드"><input type="checkbox" id="chk-uh-tauto"/> AUTO</label>
                    <select id="sel-uh-turret-sort" class="uh-select" title="정렬">
                      <option value="lv">레벨 낮은</option>
                      <option value="cost">가장 싼</option>
                      <option value="power">가장 강한</option>
                    </select>
                  </div>
                </div>
                <div class="uh-turret-list" id="uh-turret-list"></div>
              </div>
              <div class="uh-turret-right">
                <div class="uh-sec-title" style="margin:0 0 8px 0;">선택 포탑</div>
                <div class="uh-turret-empty" id="uh-turret-empty">포탑을 선택하세요.</div>
                <div class="uh-turret-detail" id="uh-turret-detail" style="display:none;">
                  <div class="uh-thead">
                    <div class="nm" id="uh-tn"></div>
                    <div class="lv" id="uh-tlv"></div>
                    <button class="mini" id="btn-uh-tclose" title="선택 해제">✕</button>
                  </div>
                  <div class="statgrid" id="uh-tstats"></div>
                  <div class="uh-next" id="uh-tnext"></div>
                  <div class="btnrow wrap" style="margin-top:8px;">
                    <button class="btn small" id="btn-uh-tup">업글 <span class="cost" id="uh-tcost">0</span></button>
                    <button class="btn small" id="btn-uh-tupA">A 업글 <span class="cost" id="uh-tcostA">0</span></button>
                    <button class="btn small" id="btn-uh-tupB">B 업글 <span class="cost" id="uh-tcostB">0</span></button>
                    <button class="btn small danger" id="btn-uh-tsell">판매 <span class="cost" id="uh-tsell">0</span></button>
                  </div>
                  <div class="hint subtle" id="uh-twarn"></div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="uh-foot" id="uh-foot"></div>
      `;

      // hint button (when closed)
      const hint = document.createElement("button");
      hint.id = "upgHubHint";
      hint.className = "upghub-hint";
      hint.textContent = "U: 업그레이드";

      hud.appendChild(root);
      hud.appendChild(hint);

      this.refs.root = root;
      this.refs.hint = hint;
      this.refs.chkAuto = root.querySelector("#chk-upghub-auto");
      this.refs.btnLayout = root.querySelector("#btn-upghub-layout");
      this.refs.btnClose = root.querySelector("#btn-upghub-close");
      this.refs.foot = root.querySelector("#uh-foot");

      // core lines
      const coreMax = root.querySelector("#uh-core-max");
      const coreRegen = root.querySelector("#uh-core-regen");
      const coreDef = root.querySelector("#uh-core-def");
      const coreEm = root.querySelector("#uh-core-em");

      const L = {};
      L.hpMax = this.mkLine("HP 최대", "코어 최대 HP 증가");
      L.shMax = this.mkLine("SH 최대", "코어 최대 보호막 증가");
      L.shRegen = this.mkLine("SH 재생", "보호막 재생 속도 증가");
      L.repair = this.mkLine("수리", "수리 회복/쿨타임 강화");
      L.armorHp = this.mkLine("HP 방어", "코어가 받는 HP 피해 감소");
      L.armorSh = this.mkLine("SH 방어", "코어가 받는 보호막 피해 감소");
      L.emergency = this.mkLine("긴급보호막", "회복량/쿨타임 강화");

      coreMax.appendChild(L.hpMax.el);
      coreMax.appendChild(L.shMax.el);
      coreRegen.appendChild(L.shRegen.el);
      coreRegen.appendChild(L.repair.el);
      coreDef.appendChild(L.armorHp.el);
      coreDef.appendChild(L.armorSh.el);
      coreEm.appendChild(L.emergency.el);

      // bind core buy actions
      this.bindPress(L.hpMax.btnEl, ()=>Core.buyCoreMax("hp"));
      this.bindPress(L.shMax.btnEl, ()=>Core.buyCoreMax("sh"));
      this.bindPress(L.shRegen.btnEl, ()=>Core.buyCoreShRegen());
      // These were previously wired to non-existent methods, causing an error popup when upgrading.
      this.bindPress(L.repair.btnEl, ()=>Core.buyCoreRepair());
      this.bindPress(L.emergency.btnEl, ()=>Core.buyCoreEmergency());
      this.bindPress(L.armorHp.btnEl, ()=>Core.buyCoreArmor("hp"));
      this.bindPress(L.armorSh.btnEl, ()=>Core.buyCoreArmor("sh"));

      this.refs.coreLines = L;

      // skill cards
      const skillCol = root.querySelector("#uh-skill-col");
      const SC = {};
      SC.energy = this.mkSkillCard("energy", "E 에너지포");
      SC.wall = this.mkSkillCard("wall", "Q 방벽");
      SC.warp = this.mkSkillCard("warp", "R 시간왜곡");
      skillCol.appendChild(SC.energy.el);
      skillCol.appendChild(SC.wall.el);
      skillCol.appendChild(SC.warp.el);
      this.bindPress(SC.energy.btnEl, ()=>Core.buySkillUpg("energy"));
      this.bindPress(SC.wall.btnEl, ()=>Core.buySkillUpg("wall"));
      this.bindPress(SC.warp.btnEl, ()=>Core.buySkillUpg("warp"));
      this.refs.skillCards = SC;

      // turrets
      this.refs.selTurretSort = root.querySelector("#sel-uh-turret-sort");
      this.refs.btnTBulk = root.querySelector("#btn-uh-tbulk");
      this.refs.chkTAuto = root.querySelector("#chk-uh-tauto");
      this.refs.turretList = root.querySelector("#uh-turret-list");
      this.refs.turretEmpty = root.querySelector("#uh-turret-empty");
      this.refs.turretDetail = root.querySelector("#uh-turret-detail");
      this.refs.turretName = root.querySelector("#uh-tn");
      this.refs.turretLv = root.querySelector("#uh-tlv");
      this.refs.turretStats = root.querySelector("#uh-tstats");
      this.refs.turretNext = root.querySelector("#uh-tnext");
      this.refs.turretWarn = root.querySelector("#uh-twarn");
      this.refs.btnTClose = root.querySelector("#btn-uh-tclose");
      this.refs.btnTUp = root.querySelector("#btn-uh-tup");
      this.refs.btnTUpA = root.querySelector("#btn-uh-tupA");
      this.refs.btnTUpB = root.querySelector("#btn-uh-tupB");
      this.refs.btnTSell = root.querySelector("#btn-uh-tsell");
      this.refs.tCost = root.querySelector("#uh-tcost");
      this.refs.tCostA = root.querySelector("#uh-tcostA");
      this.refs.tCostB = root.querySelector("#uh-tcostB");
      this.refs.tSell = root.querySelector("#uh-tsell");

      if (this.refs.selTurretSort){
        this.refs.selTurretSort.value = (this.refs.turretSort||"lv");
        this.refs.selTurretSort.addEventListener("change", ()=>{
          this.refs.turretSort = this.refs.selTurretSort.value;
          if (Core.state && Core.state.ui && Core.state.ui.turretAuto) Core.state.ui.turretAuto.mode = this.refs.turretSort;
          this.savePrefs();
        });
      }

      // bulk upgrade / auto upgrade
      if (this.refs.btnTBulk){
        this.bindPress(this.refs.btnTBulk, ()=>{
          const mode = (this.refs.selTurretSort ? this.refs.selTurretSort.value : (this.refs.turretSort||"lv"));
          Core.upgradeAllTurrets(mode);
        });
      }
      if (this.refs.chkTAuto){
        this.refs.chkTAuto.checked = !!this.turretAutoOn;
        if (Core.state && Core.state.ui && Core.state.ui.turretAuto){
          Core.state.ui.turretAuto.on = !!this.turretAutoOn;
          Core.state.ui.turretAuto.mode = (this.refs.selTurretSort ? this.refs.selTurretSort.value : (this.refs.turretSort||"lv"));
        }
        this.refs.chkTAuto.addEventListener("change", ()=>{
          const on = !!this.refs.chkTAuto.checked;
          this.turretAutoOn = on;
          try{ localStorage.setItem("td_tauto_on", on?"1":"0"); }catch(_){ }
          if (Core.state && Core.state.ui && Core.state.ui.turretAuto){
            Core.state.ui.turretAuto.on = on;
            Core.state.ui.turretAuto.mode = (this.refs.selTurretSort ? this.refs.selTurretSort.value : (this.refs.turretSort||"lv"));
          }
          UI.toast(`AUTO 업그레이드: ${on?"ON":"OFF"}`);
          AudioSys.sfx("click");
        });
      }

      this.bindPress(this.refs.btnTClose, ()=>Core.selectTurret(null));
      this.bindPress(this.refs.btnTUp, ()=>Core.upgradeSelectedTurret(null));
      this.bindPress(this.refs.btnTUpA, ()=>Core.upgradeSelectedTurret("A"));
      this.bindPress(this.refs.btnTUpB, ()=>Core.upgradeSelectedTurret("B"));
      this.bindPress(this.refs.btnTSell, ()=>Core.sellSelectedTurret());

      // passives
      this.refs.passiveChips = root.querySelector("#uh-passive-chips");
      this.refs.passiveList = root.querySelector("#uh-passive-list");

      // checkboxes/buttons
      if (this.refs.chkAuto){
        this.refs.chkAuto.checked = this.autoOpen;
        this.refs.chkAuto.addEventListener("change", ()=>{
          this.autoOpen = !!this.refs.chkAuto.checked;
          this.savePrefs();
        });
      }

      this.bindPress(this.refs.btnLayout, ()=>{
        this.layout = (this.layout==="dock") ? "modal" : "dock";
        root.classList.toggle("dock", this.layout==="dock");
        root.classList.toggle("modal", this.layout==="modal");
        this.savePrefs();
        this.relayout();
      });

      this.bindPress(this.refs.btnClose, ()=>this.hide());
      this.bindPress(hint, ()=>this.toggle());

      // tab buttons
      const tabBtns = [...root.querySelectorAll(".uh-tab")];
      this.refs.tabBtns = tabBtns;
      for (const b of tabBtns){
        this.bindPress(b, ()=>this.setTab(b.getAttribute("data-tab")));
      }

      // core category buttons (inside Core tab)
      const coreCatBtns = [...root.querySelectorAll(".uh-subtab")];
      this.refs.coreCatBtns = coreCatBtns;
      for (const b of coreCatBtns){
        this.bindPress(b, ()=>this.setCoreCat(b.getAttribute("data-corecat")));
      }

      // keyboard: U toggles. 1~3 switches tabs when opened.
      window.addEventListener("keydown", (e)=>{
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
        if (tag==="input" || tag==="textarea" || tag==="select") return;
        if (e.repeat) return;
        const k = (e.key||"").toLowerCase();
        if (k==="u"){
          this.toggle();
          return;
        }
        if (this.open){
          if (k==="1") this.setTab("core");
          else if (k==="2") this.setTab("skills");
          else if (k==="3") this.setTab("turrets");
        }
      });

      // initial tab
      this.setTab(this.tab);
      this.setCoreCat(this.coreCat, /*save*/false);

      this.ready = true;
      this.relayout();

      window.addEventListener("resize", ()=>this.relayout());
    },

    setTab(tab){
      const t = (tab==="skills"||tab==="turrets") ? tab : "core";
      this.tab = t;
      const root = this.refs.root;
      if (root){
        for (const b of (this.refs.tabBtns||[])){
          b.classList.toggle("active", b.getAttribute("data-tab")===t);
        }
        for (const p of [...root.querySelectorAll(".uh-page")]){
          p.classList.toggle("active", p.getAttribute("data-tab")===t);
        }
      }
      if (t==="core") this.setCoreCat(this.coreCat, /*save*/false);
      this.savePrefs();
    },

    setCoreCat(cat, save=true){
      const c = (cat==="regen"||cat==="def"||cat==="em") ? cat : "max";
      this.coreCat = c;
      const root = this.refs.root;
      if (root){
        for (const b of (this.refs.coreCatBtns||[])){
          b.classList.toggle("active", b.getAttribute("data-corecat")===c);
        }
        for (const sec of [...root.querySelectorAll('.uh-page[data-tab="core"] .uh-section[data-corecat]')]){
          sec.classList.toggle("hidden", sec.getAttribute("data-corecat")!==c);
        }
      }
      if (save) this.savePrefs();
    },

    show(){
      if (!this.refs.root) return;
      this.open = true;
      this.refs.root.classList.remove("hidden");
      if (this.refs.hint) this.refs.hint.classList.add("hidden");
      this.relayout();
    },

    hide(){
      if (!this.refs.root) return;
      this.open = false;
      this.refs.root.classList.add("hidden");
      if (this.refs.hint) this.refs.hint.classList.remove("hidden");
      this.relayout();
    },

    toggle(){
      if (!this.refs.root) return;
      if (this.open) this.hide(); else this.show();
    },

    relayout(){
      const root = this.refs.root;
      const hint = this.refs.hint;
      const topbar = document.getElementById("topbar");
      const bottombar = document.getElementById("bottombar");
      if (!root || !topbar || !bottombar) return;

      const tr = topbar.getBoundingClientRect();
      const br = bottombar.getBoundingClientRect();
      const top = Math.max(12, Math.round(tr.bottom + 10));
      const avail = Math.max(220, Math.round(br.top - top - 10)); // bottombar 위 여유를 확보

      if (this.layout==="dock"){
        root.style.left = "12px";
        root.style.right = "";
        root.style.transform = "";
        root.style.top = top+"px";
        root.style.bottom = "";

        // 전투 중은 슬림 고정, 대기 중은 한 화면 안에서 읽히도록 적당히 크게
        const target = this._combat ? Math.min(240, avail) : Math.min(560, avail);
        root.style.height = Math.round(target)+"px";
      } else {
        root.style.left = "50%";
        root.style.top = "50%";
        root.style.bottom = "";
        root.style.height = "";
        root.style.transform = "translate(-50%,-50%)";
      }

      if (hint){
        hint.style.left = "12px";
        hint.style.top = top+"px";
      }
    },

    // config helpers at explicit upgrade levels
    energyCfgAtLv(lv){
      const L = clamp(lv,0,3);
      const U = CFG.skillUpg && CFG.skillUpg.energy;
      const base = CFG.energyCannon;
      if (!U) return base;
      const dmg = (U.damage && U.damage[L]!=null)
        ? U.damage[L]
        : (base.damage * ((U.dmgMul && U.dmgMul[L]!=null) ? U.dmgMul[L] : 1.0));
      return { ...base, damage:dmg, cooldownSec: U.cd[L] ?? base.cooldownSec, chargeSec: U.charge[L] ?? base.chargeSec, finalShRestore: U.finalShRestore||0 };
    },
    wallCfgAtLv(lv){
      const L = clamp(lv,0,3);
      const U = CFG.skillUpg && CFG.skillUpg.wall;
      const base = CFG.wall;
      if (!U) return base;
      return {
        ...base,
        invulnSec: (base.invulnSec||1.0) * (U.inv[L] ?? 1.0),
        cooldownSec: U.cd[L] ?? base.cooldownSec,
        finalThornsPct: (L>=3) ? (U.finalThornsPct||0) : 0,
        finalThornsBossEff: (L>=3) ? ((U.finalThornsBossEff!=null)?U.finalThornsBossEff:0.55) : 0,
        finalThornsMinBase: (L>=3) ? (U.finalThornsMinBase||0) : 0,
        finalThornsMinPerWave: (L>=3) ? (U.finalThornsMinPerWave||0) : 0,
        finalThornsHitCap: (L>=3) ? (U.finalThornsHitCap||0) : 0,
        finalThornsHitCapBoss: (L>=3) ? (U.finalThornsHitCapBoss||0) : 0,
        finalThornsSecCap: (L>=3) ? (U.finalThornsSecCap||0) : 0,
        finalThornsSecCapBoss: (L>=3) ? (U.finalThornsSecCapBoss||0) : 0,
        finalThornsSplashPct: (L>=3) ? (U.finalThornsSplashPct||0) : 0,
        finalThornsSplashR: (L>=3) ? (U.finalThornsSplashR||0) : 0
      };
    },
    warpCfgAtLv(lv){
      const L = clamp(lv,0,3);
      const U = CFG.skillUpg && CFG.skillUpg.warp;
      const base = CFG.timeWarp;
      if (!U) return base;
      return {
        ...base,
        durationSec: U.dur[L] ?? base.durationSec,
        cooldownSec: U.cd[L] ?? base.cooldownSec,
        radius: U.radius[L] ?? base.radius,
        moveSlowPct: U.move[L] ?? base.moveSlowPct,
        atkSlowPct: U.atk[L] ?? base.atkSlowPct,
        bossEff: U.bossEff ?? base.bossEff,
        finalCdBoost: (L>=3) ? (U.finalCdBoost||0) : 0
      };
    },

    update(){
      if (!this.ready) return;
      const s = Core.state;
      const isOver = (s.game.phase==="gameover" || s.game.phase==="clear" || s.game.phase==="ending");
      if (isOver){
        if (this.open) this.hide();
        if (this.refs.hint) this.refs.hint.classList.add("hidden");
        return;
      }

      const running = !!s.game.running;
      const waiting = (running && (s.game.phase==="setup" || s.game.phase==="shop"));
      const combat = (running && s.game.phase==="wave");

      this._waiting = waiting;
      this._combat = combat;

      // auto-open in waiting, auto-close when entering combat
      if (waiting && this.autoOpen && !this.lastWaiting) this.show();
      if (!waiting && this.lastWaiting && running) this.hide();
      this.lastWaiting = waiting;

      // hint visibility
      if (!running || s.game.phase==="menu"){
        if (this.open) this.hide();
        if (this.refs.hint) this.refs.hint.classList.add("hidden");
      } else {
        if (this.refs.hint) this.refs.hint.classList.toggle("hidden", this.open);
      }

      // slim mode in combat
      if (this.refs.root){
        this.refs.root.classList.toggle("slim", combat);
      }

      // footer note
      if (this.refs.foot){
        if (!running) this.refs.foot.textContent = "";
        else if (waiting) this.refs.foot.textContent = "대기시간(설치/상점)에서 업그레이드 가능 · 단축키: U";
        else if (combat) this.refs.foot.textContent = "전투 중: 정보만 확인 (업그레이드는 대기시간에서) · 단축키: U";
        else this.refs.foot.textContent = "";
      }

      // update content
      const inShop = waiting;
      this.updateCore(s, inShop);
      this.updateSkills(s, inShop);
      this.updateTurrets(s, inShop);

      this.relayout();
    },

    updateCore(s, inShop){
      const cr = s.resources.crystals||0;
      const L = this.refs.coreLines;
      if (!L) return;

      // HP/SH Max
      const M = CFG.coreMaxUpg || { hpAdd:[0], hpCosts:[0], shAdd:[0], shCosts:[0] };
      const baseHp = CFG.core.hpMax, baseSh = CFG.core.shMax;
      const hpLv = clamp((s.core.hpMaxLv||0),0,3);
      const shLv = clamp((s.core.shMaxLv||0),0,3);
      const hpCur = baseHp + (M.hpAdd[hpLv] ?? 0);
      const hpNextVal = baseHp + (M.hpAdd[Math.min(3,hpLv+1)] ?? (M.hpAdd[hpLv] ?? 0));
      const shCur = baseSh + (M.shAdd[shLv] ?? 0);
      const shNextVal = baseSh + (M.shAdd[Math.min(3,shLv+1)] ?? (M.shAdd[shLv] ?? 0));
      const hpCost = (M.hpCosts[hpLv] ?? 0);
      const shCost = (M.shCosts[shLv] ?? 0);

      const hpMaxed = (hpLv>=3);
      const shMaxed = (shLv>=3);

      const hpState = hpMaxed ? "MAX" : ((cr<hpCost) ? "부족" : "UPG");
      const shState = shMaxed ? "MAX" : ((cr<shCost) ? "부족" : "UPG");
      this.setLine(L.hpMax, String(Math.round(hpCur)), hpMaxed?"MAX":String(Math.round(hpNextVal)), hpCost, hpState, inShop);
      this.setLine(L.shMax, String(Math.round(shCur)), shMaxed?"MAX":String(Math.round(shNextVal)), shCost, shState, inShop);

      // SH Regen
      const RG = CFG.coreShRegenUpg || { addPerSec:[0], costs:[0,0,0] };
      const rgLv = clamp((s.core.shRegenLv||0),0,3);
      const rgCur = (CFG.core.shRegenPerSec + (RG.addPerSec?.[rgLv] ?? 0));
      const rgNext = (CFG.core.shRegenPerSec + (RG.addPerSec?.[Math.min(3,rgLv+1)] ?? (RG.addPerSec?.[rgLv] ?? 0)));
      const rgCost = (RG.costs?.[rgLv] ?? 0);
      const rgMaxed = (rgLv>=3);
      const rgState = rgMaxed ? "MAX" : ((cr<rgCost) ? "부족" : "UPG");
      this.setLine(L.shRegen, `${Math.round(rgCur)}/s`, rgMaxed?"MAX":`${Math.round(rgNext)}/s`, rgCost, rgState, inShop);

      // Repair
      const RU = CFG.coreRepairUpg || { heal:[CFG.repair?.healHpFlat||75], cd:[CFG.repair?.cooldownSec||5.0], costs:[0,0,0] };
      const rLv = clamp((s.core.repairUpgLv||0),0,3);
      const rHealCur = (RU.heal?.[rLv] ?? (CFG.repair?.healHpFlat||75));
      const rHealNext = (RU.heal?.[Math.min(3,rLv+1)] ?? rHealCur);
      const rCdCur = (RU.cd?.[rLv] ?? (CFG.repair?.cooldownSec||5.0));
      const rCdNext = (RU.cd?.[Math.min(3,rLv+1)] ?? rCdCur);
      const rCost = (RU.costs?.[rLv] ?? 0);
      const rMaxed = (rLv>=3);
      const rState = rMaxed ? "MAX" : ((cr<rCost) ? "부족" : "UPG");
      this.setLine(L.repair, `HP+${Math.round(rHealCur)} · ${this.fmtTimeSec(rCdCur)}`, rMaxed?"MAX":`HP+${Math.round(rHealNext)} · ${this.fmtTimeSec(rCdNext)}`, rCost, rState, inShop);

      // Emergency
      const EU = CFG.coreEmergencyUpg || { restorePct:[CFG.emergencyShield?.restorePct||0.38], cd:[CFG.emergencyShield?.cooldownSec||15.0], costs:[0,0,0] };
      const eLv = clamp((s.core.emergencyUpgLv||0),0,3);
      const ePctCur = (EU.restorePct?.[eLv] ?? (CFG.emergencyShield?.restorePct||0.38));
      const ePctNext = (EU.restorePct?.[Math.min(3,eLv+1)] ?? ePctCur);
      const eCdCur = (EU.cd?.[eLv] ?? (CFG.emergencyShield?.cooldownSec||15.0));
      const eCdNext = (EU.cd?.[Math.min(3,eLv+1)] ?? eCdCur);
      const eCost = (EU.costs?.[eLv] ?? 0);
      const eMaxed = (eLv>=3);
      const eState = eMaxed ? "MAX" : ((cr<eCost) ? "부족" : "UPG");
      this.setLine(L.emergency, `${this.fmtPct(ePctCur)} · ${Math.round(eCdCur)}s`, eMaxed?"MAX":`${this.fmtPct(ePctNext)} · ${Math.round(eCdNext)}s`, eCost, eState, inShop);

      // Armor
      const steps = (CFG.coreUpg && CFG.coreUpg.armorSteps) ? CFG.coreUpg.armorSteps : [CFG.core.armorHP||0];
      const costs = (CFG.coreUpg && CFG.coreUpg.armorCosts) ? CFG.coreUpg.armorCosts : [0,0,0];
      const aHpLv = clamp((s.core.armorHpLv||0),0,3);
      const aShLv = clamp((s.core.armorShLv||0),0,3);
      const aHpCur = steps[aHpLv] ?? (CFG.core.armorHP||0);
      const aHpNext = steps[Math.min(3,aHpLv+1)] ?? aHpCur;
      const aShCur = steps[aShLv] ?? (CFG.core.armorSH||0);
      const aShNext = steps[Math.min(3,aShLv+1)] ?? aShCur;
      const aHpCost = costs[aHpLv] ?? 0;
      const aShCost = costs[aShLv] ?? 0;
      const aHpMaxed = (aHpLv>=3);
      const aShMaxed = (aShLv>=3);
      const aHpState = aHpMaxed ? "MAX" : ((cr<aHpCost) ? "부족" : "UPG");
      const aShState = aShMaxed ? "MAX" : ((cr<aShCost) ? "부족" : "UPG");
      this.setLine(L.armorHp, `-${Math.round(aHpCur)}`, aHpMaxed?"MAX":`-${Math.round(aHpNext)}`, aHpCost, aHpState, inShop);
      this.setLine(L.armorSh, `-${Math.round(aShCur)}`, aShMaxed?"MAX":`-${Math.round(aShNext)}`, aShCost, aShState, inShop);
    },

    updateSkills(s, inShop){
      const cr = s.resources.crystals||0;
      const U = CFG.skillUpg || {};
      const SC = this.refs.skillCards;
      if (!SC) return;
      if (!s.skillUpg) s.skillUpg = {energyLv:0, wallLv:0, warpLv:0};

      // Energy
      {
        const lv = clamp(s.skillUpg.energyLv||0,0,3);
        const cur = this.energyCfgAtLv(lv);
        const nxt = this.energyCfgAtLv(Math.min(3, lv+1));
        const cost = (U.energy?.costs?.[lv] ?? 0);
        const maxed = (lv>=3);
        const st = maxed ? "MAX" : ((cr<cost) ? "부족" : "UPG");
        SC.energy.lvEl.textContent = `Lv${lv}`;
        SC.energy.midEl.textContent = `피해 ${Math.round(cur.damage)}→${Math.round(nxt.damage)} · 쿨 ${this.fmtTimeSec(cur.cooldownSec)}→${this.fmtTimeSec(nxt.cooldownSec)} · 충전 ${this.fmtTimeSec(cur.chargeSec)}→${this.fmtTimeSec(nxt.chargeSec)}`;
        const finalSh = Math.round(U.energy?.finalShRestore ?? 0);
        SC.energy.finalEl.textContent = (lv>=3 && finalSh>0) ? `최종효과 ON: 적중 시 코어 SH +${finalSh}` : (finalSh>0 ? `최종효과: Lv3에 적중 시 코어 SH +${finalSh}` : "최종효과: (없음)");
        SC.energy.finalEl.classList.toggle("on", (lv>=3 && finalSh>0));
        SC.energy.costEl.textContent = maxed ? "" : String(cost);
        SC.energy.costEl.classList.toggle("bad", st==="부족");
        SC.energy.btnEl.textContent = st;
        SC.energy.btnEl.disabled = (st!=="UPG") || !inShop;
      }

      // Wall
      {
        const lv = clamp(s.skillUpg.wallLv||0,0,3);
        const cur = this.wallCfgAtLv(lv);
        const nxt = this.wallCfgAtLv(Math.min(3, lv+1));
        const cost = (U.wall?.costs?.[lv] ?? 0);
        const maxed = (lv>=3);
        const st = maxed ? "MAX" : ((cr<cost) ? "부족" : "UPG");
        SC.wall.lvEl.textContent = `Lv${lv}`;
        SC.wall.midEl.textContent = `무적 ${this.fmtTimeSec(cur.invulnSec)}→${this.fmtTimeSec(nxt.invulnSec)} · 쿨 ${this.fmtTimeSec(cur.cooldownSec)}→${this.fmtTimeSec(nxt.cooldownSec)}`;
        const pct = Math.round((U.wall?.finalThornsPct||0)*100);
        const bossEff = (U.wall?.finalThornsBossEff!=null)?U.wall.finalThornsBossEff:0.55;
        const bossPct = Math.round((U.wall?.finalThornsPct||0)*bossEff*1000)/10;
        const minB = Math.round(U.wall?.finalThornsMinBase||0);
        const minW = Math.round(U.wall?.finalThornsMinPerWave||0);
        const hitCap = Math.round(U.wall?.finalThornsHitCap||0);
        const secCap = Math.round(U.wall?.finalThornsSecCap||0);
        SC.wall.finalEl.textContent = (lv>=3 && pct>0) ? `최종효과 ON: 가시갑옷 — 차단 시 반사 ${pct}% (보스 ${bossPct}%) · 최소 ${minB}+W×${minW} · 1타 ${hitCap} / 초 ${secCap}`
          : (pct>0 ? `최종효과: Lv3에 가시갑옷 — 차단 시 반사 ${pct}% (보스 ${bossPct}%) · 최소 ${minB}+W×${minW} · 1타 ${hitCap} / 초 ${secCap}` : "최종효과: (없음)");
        SC.wall.finalEl.classList.toggle("on", (lv>=3 && pct>0));
        SC.wall.costEl.textContent = maxed ? "" : String(cost);
        SC.wall.costEl.classList.toggle("bad", st==="부족");
        SC.wall.btnEl.textContent = st;
        SC.wall.btnEl.disabled = (st!=="UPG") || !inShop;
      }

      // Warp
      {
        const lv = clamp(s.skillUpg.warpLv||0,0,3);
        const cur = this.warpCfgAtLv(lv);
        const nxt = this.warpCfgAtLv(Math.min(3, lv+1));
        const cost = (U.warp?.costs?.[lv] ?? 0);
        const maxed = (lv>=3);
        const st = maxed ? "MAX" : ((cr<cost) ? "부족" : "UPG");
        SC.warp.lvEl.textContent = `Lv${lv}`;
        SC.warp.midEl.textContent = `지속 ${this.fmtTimeSec(cur.durationSec)}→${this.fmtTimeSec(nxt.durationSec)} · 쿨 ${this.fmtTimeSec(cur.cooldownSec)}→${this.fmtTimeSec(nxt.cooldownSec)} · 범위 ${Math.round(cur.radius)}→${Math.round(nxt.radius)}`;
        const cdBoost = Math.round((U.warp?.finalCdBoost||0)*100);
        SC.warp.finalEl.textContent = (lv>=3 && cdBoost>0) ? `최종효과 ON: 스킬 쿨 회복 +${cdBoost}%` : (cdBoost>0 ? `최종효과: Lv3에 스킬 쿨 회복 +${cdBoost}%` : "최종효과: (없음)");
        SC.warp.finalEl.classList.toggle("on", (lv>=3 && cdBoost>0));
        SC.warp.costEl.textContent = maxed ? "" : String(cost);
        SC.warp.costEl.classList.toggle("bad", st==="부족");
        SC.warp.btnEl.textContent = st;
        SC.warp.btnEl.disabled = (st!=="UPG") || !inShop;
      }
    },

    updateTurrets(s, inShop){
      if (!this.refs.turretList) return;

      // list
      const alive = (s.entities.turrets||[]).filter(t=>t && !t.dead);
      const sortKey = (this.refs.selTurretSort && this.refs.selTurretSort.value) ? this.refs.selTurretSort.value : (this.refs.turretSort||"lv");
      this.refs.turretSort = sortKey;

      const power = (t)=>{
        const dps = (t.dmg||0) * (t.shotsPerSec||0);
        const spl = (t.splashPct||0);
        return dps * (1 + Math.min(0.9, spl));
      };
      const baseCost = (t)=>{
        const cfg = (CFG.turrets && CFG.turrets[t.type]) ? CFG.turrets[t.type] : (CFG.turrets ? CFG.turrets.basic : null);
        return cfg ? (cfg.cost||0) : (t.baseCost||0);
      };

      alive.sort((a,b)=>{
        if (sortKey==="cost") return baseCost(a)-baseCost(b);
        if (sortKey==="power") return power(b)-power(a);
        return (a.lv||1)-(b.lv||1);
      });

      const selectedId = (s.ui && s.ui.selectedTurretId!=null) ? s.ui.selectedTurretId : null;

      // rebuild list (small N)
      this.refs.turretList.innerHTML = "";
      if (alive.length===0){
        const d = document.createElement("div");
        d.className = "uh-empty";
        d.textContent = "설치된 포탑이 없습니다.";
        this.refs.turretList.appendChild(d);
      } else {
        for (const t of alive){
          const btn = document.createElement("button");
          btn.className = "uh-titem";
          const p = t.path ? `(${t.path})` : "";
          btn.innerHTML = `<span class="ic">${this.turretName(t.type).slice(0,1)}</span><span class="tx">${this.turretName(t.type)} Lv${t.lv}${p}</span>`;
          btn.classList.toggle("active", t.id===selectedId);
          this.bindPress(btn, ()=>Core.selectTurret(t));
          this.refs.turretList.appendChild(btn);
        }
      }

      // detail
      const t = Core.getSelectedTurret ? Core.getSelectedTurret() : null;
      if (!t){
        if (this.refs.turretEmpty) this.refs.turretEmpty.style.display = "block";
        if (this.refs.turretDetail) this.refs.turretDetail.style.display = "none";
        return;
      }
      if (this.refs.turretEmpty) this.refs.turretEmpty.style.display = "none";
      if (this.refs.turretDetail) this.refs.turretDetail.style.display = "block";

      const name = this.turretName(t.type);
      const path = t.path ? ` · ${t.path}` : "";
      if (this.refs.turretName) this.refs.turretName.textContent = name;
      if (this.refs.turretLv) this.refs.turretLv.textContent = `Lv${t.lv}${path}`;

      // stats grid
      const st = Sim.computeTurretStats(t.type, t.lv||1, t.path||null) || {};
      const dps = (t.dmg||0) * (t.shotsPerSec||0);
      const special = (t.type==="slow")
        ? `둔화 ${Math.round((t.slowPct||0)*100)}% · ${this.fmtTimeSec(t.slowSec||0)}s${(t.slowAuraPct||0)>0?` · 오라 ${Math.round((t.slowAuraPct||0)*100)}% (${Math.round(t.slowAuraR||0)})`:""}`
        : (t.type==="splash")
          ? `폭발 ${Math.round((t.splashPct||0)*100)}% · 반경 ${Math.round(t.splashR||0)}${(t.extraSplashPct||0)>0?` · 추가링 ${Math.round((t.extraSplashPct||0)*100)}%`:""}`
          : (t.path?`분기 ${t.path}`:"-");

      if (this.refs.turretStats){
        this.refs.turretStats.innerHTML = "";
        const add = (k,v)=>{
          const div=document.createElement("div");
          div.className="stat";
          div.innerHTML = `<span class="k">${k}</span> <span class="v">${v}</span>`;
          this.refs.turretStats.appendChild(div);
        };
        add("피해", Math.round(t.dmg||0));
        add("공속", fmt1(t.shotsPerSec||0)+"/s");
        add("DPS", Math.round(dps));
        add("치명타", `${Math.round((t.critChance||0)*100)}% · ${this.fmtMul(t.critMult||1)}`);
        add("사거리", Math.round(t.range||0));
        add("특수", special);
        add("내구", `${Math.round(t.hp||0)}/${Math.round(t.hpMax||0)}`);
      }

      // next preview + costs
      const lv = t.lv||1;
      const maxed = (lv>=5);
      const cr = s.resources.crystals||0;

      const upBtn = this.refs.btnTUp;
      const upA = this.refs.btnTUpA;
      const upB = this.refs.btnTUpB;

      if (maxed){
        if (this.refs.turretNext) this.refs.turretNext.textContent = "MAX 레벨입니다.";
        if (upBtn) upBtn.disabled = true;
        if (upA) upA.style.display = "none";
        if (upB) upB.style.display = "none";
        if (this.refs.tCost) this.refs.tCost.textContent = "-";
      } else if (lv===2 && !t.path){
        // branch
        if (upBtn) upBtn.style.display = "none";
        if (upA) upA.style.display = "";
        if (upB) upB.style.display = "";

        const cost = Sim.turretUpgCost(t.type, 3);
        if (this.refs.tCostA) this.refs.tCostA.textContent = String(cost);
        if (this.refs.tCostB) this.refs.tCostB.textContent = String(cost);
        if (upA) upA.disabled = (!inShop) || (cr<cost);
        if (upB) upB.disabled = (!inShop) || (cr<cost);

        const stA = Sim.computeTurretStats(t.type, 3, "A") || {};
        const stB = Sim.computeTurretStats(t.type, 3, "B") || {};
        const lineA = `A: 피해 ${Math.round(stA.dmg||0)} · 공속 ${fmt1(stA.shotsPerSec||0)}/s · 사거리 ${Math.round(stA.range||0)}`;
        const lineB = `B: 피해 ${Math.round(stB.dmg||0)} · 공속 ${fmt1(stB.shotsPerSec||0)}/s · 사거리 ${Math.round(stB.range||0)}`;
        if (this.refs.turretNext) this.refs.turretNext.textContent = `다음: Lv2 → Lv3 (분기 선택) / ${lineA} / ${lineB}`;
      } else {
        if (upBtn) upBtn.style.display = "";
        if (upA) upA.style.display = "none";
        if (upB) upB.style.display = "none";

        const toLv = lv+1;
        const cost = Sim.turretUpgCost(t.type, toLv);
        if (this.refs.tCost) this.refs.tCost.textContent = String(cost);
        if (upBtn) upBtn.disabled = (!inShop) || (cr<cost);

        const nx = Sim.computeTurretStats(t.type, toLv, t.path||null) || {};
        const line = `피해 ${Math.round(st.dmg||0)}→${Math.round(nx.dmg||0)} · 공속 ${fmt1(st.shotsPerSec||0)}→${fmt1(nx.shotsPerSec||0)}/s · 사거리 ${Math.round(st.range||0)}→${Math.round(nx.range||0)}`;
        if (this.refs.turretNext) this.refs.turretNext.textContent = `다음: Lv${lv} → Lv${toLv} / ${line}`;
      }

      // sell
      const refund = Math.floor((t.spent||0)*0.70);
      if (this.refs.tSell) this.refs.tSell.textContent = String(refund);
      if (this.refs.btnTSell) this.refs.btnTSell.disabled = !inShop;

      if (this.refs.turretWarn){
        this.refs.turretWarn.textContent = inShop ? "" : "※ 대기시간(설치/상점)에서만 업그레이드/판매 가능";
      }
    },

    updatePassives(s){
      // chips
      const p = s.passives.selected;
      const chips = this.refs.passiveChips;
      if (chips){
        chips.innerHTML = "";
        const names = [
          ["rebuild","재건"],
          ["resonance","공명"],
          ["overload","과부화"],
          ["overdrive","오버드라이브"],
          ["rebirth","부활"],
        ];
        for (const [k,nm] of names){
          const c = document.createElement("span");
          c.className = "uh-chip";
          c.textContent = nm + (p===k?" ✓":"");
          c.classList.toggle("active", p===k);
          chips.appendChild(c);
        }
      }

      // list (accordion)
      const list = this.refs.passiveList;
      if (!list) return;

      if (!list._built){
        const defs = [
          {k:"rebuild", t:"재건", s:"저체력 방어/자동 수리 중심", d:(()=>
            "• HP 70%↓부터 피해 감소(10%→12%)\n"+
            "• 보호막이 깨질 때 짧은 '긴급 보강'(피해 -38%, 쿨 7s)\n"+
            "• 보호막 재생 +15% (최종전 +10% 추가)\n"+
            "• 저체력일수록 방어↑ (최대: HP +15 / SH +7.5)\n"+
            "• 일정 시간 무피격이면 HP 자동 수리(저체력↑ / 최종전 딜레이↓)"
          )()},
          {k:"resonance", t:"공명", s:"피격 → 게이지 → 방출(AoE)", d:(()=>
            "• 피격 시 공명 게이지 상승 → 포탑 피해/공속 증가\n"+
            "• 100% 시 에너지 방출(AoE) 후 게이지 0 리셋\n"+
            "• 방출 피해: (60 + 최대보호막×20%) × (1 + 웨이브×1%)"
          )()},
          {k:"overload", t:"과부화", s:"표식/버스트/연계(수리)", d:(()=>
            "• 기본 포탑 버프(활성도 비례): 피해/공속 증가(상시)\n"+
            "• 포탑 적중 시 '표식'(최대 5, 4s 갱신) → 표식당 받는 터렛피해: 일반/엘리트 +3%, 보스 +1.5%\n"+
            "• HP 30%↓ 진입 시: 쇼크웨이브 + 버스트 6s (쿨 18s)\n"+
            "• 버스트 중: 관통+1 / 90px 폭발(35%) / 최종보스 추가피해 +25%"
          )()},
          {k:"overdrive", t:"오버드라이브", s:"코어 자동 공격(저체력 강화)", d:(()=>
            "• 코어가 직접 자동 공격(상시)\n"+
            "• HP가 낮을수록 공격력/공속 증가 (HP 10% 이하 MAX)\n"+
            "• 코어 공격 적중 시 광역 피해 30% 추가\n"+
            "• 에너지포는 30% 광역피해를 입힘"
          )()},
          {k:"rebirth", t:"부활", s:"코어 파괴 직전 시간 되감기 + 1회 부활", d:(()=>
            "• 코어 파괴 직전 시간 되감기 연출 후 즉시 전투 복귀\n"+
            "• 런당 1회 발동, 부활 시 HP 45% / SH 25% / 3초 무적\n"+
            "• 부활 직후 적 투사체(운석 포함) 전부 제거\n"+
            "• 부활 후 랜덤 패시브 자동 전환(효과 80%)\n"+
            "• 시간왜곡 +15% 강화는 부활 후에도 유지"
          )()},
        ];

        list.innerHTML = "";
        for (const it of defs){
          const row = document.createElement("div");
          row.className = "uh-acc";
          row.innerHTML = `
            <button class="uh-acc-head"><span class="t"></span><span class="s"></span><span class="chev">▾</span></button>
            <div class="uh-acc-body"></div>
          `;
          row.querySelector(".t").textContent = it.t;
          row.querySelector(".s").textContent = it.s;
          const body = row.querySelector(".uh-acc-body");
          body.textContent = it.d;

          const head = row.querySelector(".uh-acc-head");
          this.bindPress(head, ()=>{
            const open = row.classList.toggle("open");
            // close others
            for (const other of [...list.querySelectorAll(".uh-acc")]){
              if (other!==row) other.classList.remove("open");
            }
            head.querySelector(".chev").textContent = open ? "▴" : "▾";
          });

          list.appendChild(row);
        }
        list._built = true;
      }

      // highlight selected
      for (const row of [...list.querySelectorAll(".uh-acc")]){
        const t = row.querySelector(".uh-acc-head .t");
        if (!t) continue;
        const key = (t.textContent==="재건")?"rebuild":(t.textContent==="공명")?"resonance":(t.textContent==="과부화")?"overload":(t.textContent==="부활")?"rebirth":"overdrive";
        row.classList.toggle("active", s.passives.selected===key);
      }
    }
  };
  const UI = {
    els:{},
    init(){
      const ids=[
        "ui-crystals","ui-wave","ui-phase","ui-diff","ui-speed",
        "ui-hpbar","ui-shbar","ui-hpnum","ui-shnum","ui-hpdef","ui-shdef",
        "ui-statusline","ui-statusline2","ui-nextline",
        "ui-event-chip","ui-event-name","ui-event-desc",
        "ui-next-chip","ui-next-wave",
        "ui-armor-hp","ui-armor-sh",
        "ui-passive","ui-passive-lock","ui-passive-desc",
        "btn-effect-toggle",
        "coreUpgCard","btn-coreupg-toggle","btn-coremax-hp","btn-coremax-sh","ui-coremax-hp-cur","ui-coremax-hp-next","ui-coremax-hp-cost","ui-coremax-sh-cur","ui-coremax-sh-next","ui-coremax-sh-cost",
        "btn-coreshrg","ui-coreshrg-cur","ui-coreshrg-next","ui-coreshrg-sub","ui-coreshrg-cost",
        "btn-corerepair","ui-corerepair-cur","ui-corerepair-next","ui-corerepair-sub","ui-corerepair-cost","btn-coreem","ui-coreem-cur","ui-coreem-next","ui-coreem-sub","ui-coreem-cost",
        
        "btn-coreupg-hp","btn-coreupg-sh","ui-coreupg-hp-cur","ui-coreupg-hp-next","ui-coreupg-hp-sub","ui-coreupg-hp-cost","ui-coreupg-sh-cur","ui-coreupg-sh-next","ui-coreupg-sh-sub","ui-coreupg-sh-cost",
        "skillUpgCard","btn-skillupg-toggle","btn-skillupg-e","btn-skillupg-q","btn-skillupg-r","ui-skillupg-e-cur","ui-skillupg-e-next","ui-skillupg-e-sub","ui-skillupg-e-cost","ui-skillupg-q-cur","ui-skillupg-q-next","ui-skillupg-q-sub","ui-skillupg-q-cost","ui-skillupg-r-cur","ui-skillupg-r-next","ui-skillupg-r-sub","ui-skillupg-r-cost","turretUpgCard","btn-turretupg-toggle","btn-turretupg-close",
        "btn-turretupg-up","btn-turretupg-upA","btn-turretupg-upB","btn-turretupg-sell",
        "ui-turretupg-body","ui-turretupg-hint","ui-turretupg-detail","ui-turretupg-name","ui-turretupg-lv","ui-turretupg-path",
        "ui-turretupg-dmg","ui-turretupg-aspd","ui-turretupg-range","ui-turretupg-special","ui-turretupg-hp",
        "ui-turretupg-cost","ui-turretupg-costA","ui-turretupg-costB","ui-turretupg-sellval","ui-turretupg-next",
        "btn-diff","btn-start",
        "btn-passive-rebuild","btn-passive-resonance","btn-passive-overload","btn-passive-overdrive","btn-passive-rebirth",
        "btn-wave","btn-speed","btn-pause","btn-build","btn-turretrepair","btn-passiveinfo","btn-repair","btn-emergency",
        "btn-turret-basic","btn-turret-slow","btn-turret-splash","ui-turret-info",
        "btn-skill-e","ui-skill-e-sub","ui-skill-e-ring","btn-skill-q","ui-skill-q-sub","ui-skill-q-ring","btn-skill-r","ui-skill-r-sub","ui-skill-r-ring",
        "btn-music","btn-sfx","vol-master",
        "topbar","bottombar","effectCard","menupanel","gameoverpanel","btn-restart-only","toast", "ui-gaugebar","ui-gaugenum",
        "finalBossHud","ui-fbhpbar","ui-fbhpnum","ui-fbphase",
        "passivePop","btn-passivepop-close","ui-passive-desc-pop"];
      for (const id of ids) UI.els[id]=document.getElementById(id);

      // robust mobile/desktop button binding (prevents click not firing / double firing)
      const bindPress=(el, fn)=>{
        if (!el) return;
        let last=0;
        const go=(e)=>{
          const t=performance.now();
          if (t-last < 250) return;
          last=t;
          if (e){ e.preventDefault(); e.stopPropagation(); }
          AudioSys.unlock(); AudioSys.sfx("click");
          fn();
        };
        el.style.touchAction = "manipulation";
        el.addEventListener("pointerdown", go);
        el.addEventListener("click", go);
      };

      bindPress(UI.els["btn-diff"], ()=>{
        const s = Core.state;
        if (!s.unlocks || !s.unlocks.hard){
          UI.toast("하드 모드는 엔딩 이후 해금됩니다.");
          return;
        }
        s.game.difficulty = (s.game.difficulty==="normal")?"hard":"normal";
        UI.toast("난이도: "+(s.game.difficulty==="normal"?"노말":"하드"));
      });
      bindPress(UI.els["btn-start"], ()=>Core.startRun());
      bindPress(UI.els["btn-restart-only"], ()=>{ Core.resetAll(); UI.toast("재시작"); });

      const setPassive=(p)=>{
        const s=Core.state;
        if (s.passives.locked){ UI.toast("패시브는 런 시작 후 변경 불가(🔒)"); return; }
        s.passives.selected=p;
        s.passives.fromRebirth = false;
        s.passives.fromRebirthMul = 0.8;
        s.passives.rebirthSelected = (p==="rebirth");
        if (p==="rebirth") s.passives.rebirthTw = true;
        UI.toast("패시브 선택: "+UI.passiveName(p));
        UI.updatePassiveDesc();
        UI.syncPassiveButtons();
};
      bindPress(UI.els["btn-passive-rebuild"], ()=>setPassive("rebuild"));
      bindPress(UI.els["btn-passive-resonance"], ()=>setPassive("resonance"));
      bindPress(UI.els["btn-passive-overload"], ()=>setPassive("overload"));
      bindPress(UI.els["btn-passive-overdrive"], ()=>setPassive("overdrive"));
      bindPress(UI.els["btn-passive-rebirth"], ()=>setPassive("rebirth"));

      bindPress(UI.els["btn-wave"], ()=>Core.nextWaveOrStart());
      bindPress(UI.els["btn-speed"], ()=>Core.toggleSpeed());
      bindPress(UI.els["btn-pause"], ()=>Core.togglePause());
      bindPress(UI.els["btn-build"], ()=>{
        const s=Core.state;
        s.ui.buildMode = !s.ui.buildMode;
        if (s.ui.buildMode) s.ui.turretRepairMode = false;
        UI.toast("빌드 모드: "+(s.ui.buildMode?"ON":"OFF"));
        if (UI.syncModeButtons) UI.syncModeButtons();
      });

      bindPress(UI.els["btn-turretrepair"], ()=>{
        const s=Core.state;
        s.ui.turretRepairMode = !s.ui.turretRepairMode;
        if (s.ui.turretRepairMode){
          s.ui.buildMode = false;
          if (s.ui.selectedTurretId!=null){
            s.ui.selectedTurretId = null;
            UI.updateTurretUpgPanel();
          }
        }
        UI.toast("포탑 수리: "+(s.ui.turretRepairMode?"ON":"OFF"));
        if (UI.syncModeButtons) UI.syncModeButtons();
      });

      // passive description popover (Build 옆 ⓘ)
      const pop = UI.els["passivePop"];
      const btnInfo = UI.els["btn-passiveinfo"];
      const btnPopClose = UI.els["btn-passivepop-close"];
      const placePop = ()=>{
        if (!pop || pop.classList.contains("hidden")) return;
        const br = UI.els["bottombar"] ? UI.els["bottombar"].getBoundingClientRect() : null;
        const ir = btnInfo ? btnInfo.getBoundingClientRect() : null;
        if (!br || !ir) return;
        // sit above the bottom bar with a small gap
        const gap = 10;
        pop.style.bottom = Math.round(window.innerHeight - br.top + gap) + "px";
        // align right edge to the info button (clamped)
        const w = pop.getBoundingClientRect().width || 420;
        let left = Math.round(ir.right - w);
        left = clamp(left, 12, Math.max(12, window.innerWidth - w - 12));
        pop.style.left = left + "px";
      };
      const setPopOpen = (open)=>{
        if (!pop) return;
        pop.classList.toggle("hidden", !open);
        if (open){
          UI.updatePassiveDesc();
          requestAnimationFrame(placePop);
        }
      };
      bindPress(btnInfo, ()=>{
        if (!pop) return;
        const open = pop.classList.contains("hidden");
        setPopOpen(open);
      });
      bindPress(btnPopClose, ()=>setPopOpen(false));
      window.addEventListener("resize", ()=>requestAnimationFrame(placePop));
      document.addEventListener("pointerdown", (e)=>{
        if (!pop || pop.classList.contains("hidden")) return;
        const t = e.target;
        if (t && t.closest && (t.closest("#passivePop") || t.closest("#btn-passiveinfo"))) return;
        setPopOpen(false);
      });
      window.addEventListener("keydown", (e)=>{
        if (e.key === "Escape") setPopOpen(false);
      });

      // passive effect card: collapsible
      const setEffectCollapsed = (collapsed)=>{
        const card = UI.els["effectCard"]; const btn = UI.els["btn-effect-toggle"];
        if (!card || !btn) return;
        card.classList.toggle("collapsed", !!collapsed);
        btn.textContent = collapsed ? "▸" : "▾";
        try{ localStorage.setItem("effectCollapsed", collapsed?"1":"0"); }catch(_){ }
      };
      let initCollapsed=false;
      try{ initCollapsed = (localStorage.getItem("effectCollapsed")==="1"); }catch(_){ }
      setEffectCollapsed(initCollapsed);
      bindPress(UI.els["btn-effect-toggle"], ()=>{
        const card = UI.els["effectCard"]; if (!card) return;
        setEffectCollapsed(!card.classList.contains("collapsed"));
      });

      
      // core upgrade card collapsible
      const setCoreUpgCollapsed = (collapsed)=>{
        const card = UI.els["coreUpgCard"]; if (!card) return;
        card.classList.toggle("collapsed", !!collapsed);
        const btn = UI.els["btn-coreupg-toggle"]; if (btn) btn.textContent = collapsed ? "▸" : "▾";
        try{ localStorage.setItem("coreUpgCollapsed", collapsed?"1":"0"); }catch(_){ }
      };
      let initCoreCollapsed=false;
      try{ initCoreCollapsed = (localStorage.getItem("coreUpgCollapsed")==="1"); }catch(_){ }
      setCoreUpgCollapsed(initCoreCollapsed);
      bindPress(UI.els["btn-coreupg-toggle"], ()=>{
        const card = UI.els["coreUpgCard"]; if (!card) return;
        setCoreUpgCollapsed(!card.classList.contains("collapsed"));
      });

// skill upgrade card collapsible
const setSkillUpgCollapsed = (collapsed)=>{
  const card = UI.els["skillUpgCard"]; if (!card) return;
  card.classList.toggle("collapsed", !!collapsed);
  const btn = UI.els["btn-skillupg-toggle"]; if (btn) btn.textContent = collapsed ? "▸" : "▾";
  try{ localStorage.setItem("skillUpgCollapsed", collapsed?"1":"0"); }catch(_){ }
};
let initSkillCollapsed=false;
try{ initSkillCollapsed = (localStorage.getItem("skillUpgCollapsed")==="1"); }catch(_){ }
setSkillUpgCollapsed(initSkillCollapsed);
bindPress(UI.els["btn-skillupg-toggle"], ()=>{
  const card = UI.els["skillUpgCard"]; if (!card) return;
  setSkillUpgCollapsed(!card.classList.contains("collapsed"));
});


      // turret upgrade card collapse + actions
      const setTurretUpgCollapsed = (collapsed)=>{
        const card = UI.els["turretUpgCard"]; if (!card) return;
        card.classList.toggle("collapsed", collapsed);
        const btn = UI.els["btn-turretupg-toggle"]; if (btn) btn.textContent = collapsed ? "▸" : "▾";
        try{ localStorage.setItem("turretUpgCollapsed", collapsed?"1":"0"); }catch(_){ }
      };
      let initTurretCollapsed=false;
      try{ initTurretCollapsed = (localStorage.getItem("turretUpgCollapsed")==="1"); }catch(_){ }
      setTurretUpgCollapsed(initTurretCollapsed);
      bindPress(UI.els["btn-turretupg-toggle"], ()=>{
        const card = UI.els["turretUpgCard"]; if (!card) return;
        setTurretUpgCollapsed(!card.classList.contains("collapsed"));
      });

      bindPress(UI.els["btn-turretupg-close"], ()=>{ AudioSys.sfx("click"); Core.selectTurret(null); });
      bindPress(UI.els["btn-turretupg-up"], ()=>{ Core.upgradeSelectedTurret(null); });
      bindPress(UI.els["btn-turretupg-upA"], ()=>{ Core.upgradeSelectedTurret("A"); });
      bindPress(UI.els["btn-turretupg-upB"], ()=>{ Core.upgradeSelectedTurret("B"); });
      bindPress(UI.els["btn-turretupg-sell"], ()=>{ Core.sellSelectedTurret(); });


// audio controls
      bindPress(UI.els["btn-music"], ()=>{
        AudioSys.sfx("click");
        AudioSys.setMusicOn(!AudioSys.musicOn);
        UI.toast("배경음악: "+(AudioSys.musicOn?"ON":"OFF"));
      });
      bindPress(UI.els["btn-sfx"], ()=>{
        AudioSys.sfx("click");
        AudioSys.setSfxOn(!AudioSys.sfxOn);
        UI.toast("효과음: "+(AudioSys.sfxOn?"ON":"OFF"));
      });
      const vol = UI.els["vol-master"];
      if (vol){
        AudioSys.setMasterVol(parseFloat(vol.value||"0.65"));
        vol.addEventListener("input", ()=>{
          AudioSys.unlock();
          AudioSys.setMasterVol(parseFloat(vol.value||"0.65"));
        });
      }
      AudioSys.uiSync();

      const setTurret=(t)=>{
        const s=Core.state;
        if (!s.build) s.build={turretType:"basic"};
        s.build.turretType=t;
        UI.toast(`포탑 선택: ${UI.turretName(t)}`);
        UI.syncTurretButtons();
      };
      bindPress(UI.els["btn-turret-basic"], ()=>setTurret("basic"));
      bindPress(UI.els["btn-turret-slow"], ()=>setTurret("slow"));
      bindPress(UI.els["btn-turret-splash"], ()=>setTurret("splash"));

      bindPress(UI.els["btn-repair"], ()=>Core.repair());
      bindPress(UI.els["btn-emergency"], ()=>Core.emergencyShield());
      bindPress(UI.els["btn-coremax-hp"], ()=>Core.buyCoreMax("hp"));
      bindPress(UI.els["btn-coremax-sh"], ()=>Core.buyCoreMax("sh"));
      bindPress(UI.els["btn-coreshrg"], ()=>Core.buyCoreShRegen());
      bindPress(UI.els["btn-corerepair"], ()=>Core.buyCoreRepair());
      bindPress(UI.els["btn-coreem"], ()=>Core.buyCoreEmergency());
      bindPress(UI.els["btn-coreupg-hp"], ()=>Core.buyCoreArmor("hp"));
      bindPress(UI.els["btn-coreupg-sh"], ()=>Core.buyCoreArmor("sh"));
      bindPress(UI.els["btn-skillupg-e"], ()=>Core.buySkillUpg("energy"));
      bindPress(UI.els["btn-skillupg-q"], ()=>Core.buySkillUpg("wall"));
      bindPress(UI.els["btn-skillupg-r"], ()=>Core.buySkillUpg("warp"));
      bindPress(UI.els["btn-skill-e"], ()=>Core.useEnergyCannon());
      bindPress(UI.els["btn-skill-q"], ()=>Core.useWall());
      bindPress(UI.els["btn-skill-r"], ()=>Core.useTimeWarp());
      UpgHub.init();
    },
    passiveName(p){
      if (!p) return "(미선택)";
      return ({rebuild:"재건", resonance:"공명", overload:"과부화", overdrive:"오버드라이브"}[p]||p);
    },

    turretName(t){
      const cfg = (CFG.turrets && CFG.turrets[t]) ? CFG.turrets[t] : null;
      return cfg ? cfg.name : (t||"(미선택)");
    },
    turretCost(t){
      const cfg = (CFG.turrets && CFG.turrets[t]) ? CFG.turrets[t] : null;
      return cfg ? cfg.cost : 0;
    },

    enemyName(kind){
      const map = {
        normal:"일반", fast:"빠름", tank:"탱크", elite:"엘리트",
        ranged:"원거리", bomber:"자폭", disruptor:"디스럽터",
        supporter:"방패서포터", splitter:"분열체", splitling:"분열(소형)",
        leech:"흡혈충", sniper:"저격수", armored:"방열갑옷", meteor:"운석소환자",
        boss:"보스", finalBoss:"최종보스"
      };
      return map[kind] || kind;
    },

    formatEnemyList(kinds){
      const uniq=[];
      for (const k of kinds){ if (k && !uniq.includes(k)) uniq.push(k); }
      // Keep order: base -> specials -> boss
      const order = ["normal","fast","tank","elite","ranged","bomber","disruptor","supporter","splitter","leech","sniper","armored","meteor","boss","finalBoss"];
      uniq.sort((a,b)=>{
        const ia = order.indexOf(a); const ib = order.indexOf(b);
        return (ia<0?999:ia) - (ib<0?999:ib);
      });
      const names = uniq.map(UI.enemyName);
      // Avoid overlong UI strings
      let out = names.join(" · ");
      if (out.length>78) out = out.slice(0, 76) + "…";
      return out;
    },
    syncTurretButtons(){
      const s=Core.state;
      const map={basic:"btn-turret-basic", slow:"btn-turret-slow", splash:"btn-turret-splash"};
      for (const k in map){
        const el=UI.els[map[k]];
        if (!el) continue;
        el.classList.toggle("active", (s.build && s.build.turretType===k));
      }
      if (UI.els["ui-turret-info"]){
        const t = (s.build && s.build.turretType) ? s.build.turretType : "basic";
        const cfg = (CFG.turrets && CFG.turrets[t]) ? CFG.turrets[t] : null;
        if (cfg){
          UI.els["ui-turret-info"].textContent = `포탑: ${cfg.name} · 비용 ${cfg.cost}`;
        } else {
          UI.els["ui-turret-info"].textContent = "";
        }
      }
    },
    applyGameOverVisibility(){
      const s=Core.state;
      const over = (s.game.phase==="gameover" || s.game.phase==="clear");
      const ending = (s.game.phase==="ending");
      const hideHud = over || ending;
      // show only restart button (not during the ending cinematic)
      if (UI.els["gameoverpanel"]) UI.els["gameoverpanel"].style.display = over ? "block" : "none";
      if (UI.els["menupanel"]) UI.els["menupanel"].style.display = over ? "none" : UI.els["menupanel"].style.display;
      if (UI.els["bottombar"]) UI.els["bottombar"].style.display = hideHud ? "none" : "block";
      if (UI.els["effectCard"]) UI.els["effectCard"].style.display = hideHud ? "none" : "block";
      if (UI.els["topbar"]) UI.els["topbar"].style.display = hideHud ? "none" : "block";
    },


    syncModeButtons(){
      const s=Core.state;
      if (UI.els["btn-build"]) UI.els["btn-build"].classList.toggle("active", !!s.ui.buildMode);
      if (UI.els["btn-turretrepair"]) UI.els["btn-turretrepair"].classList.toggle("active", !!s.ui.turretRepairMode);
    },

    syncPassiveButtons(){
      const s=Core.state;
      const map={rebuild:"btn-passive-rebuild", resonance:"btn-passive-resonance", overload:"btn-passive-overload", overdrive:"btn-passive-overdrive", rebirth:"btn-passive-rebirth"};
      for (const k in map){
        const el=UI.els[map[k]];
        if (!el) continue;
        el.classList.toggle("active", s.passives.selected===k);
      }
    },
    updatePassiveDesc(){
      const s=Core.state, p=s.passives.selected;
      const targets = [
        UI.els["ui-passive-desc"],
        document.getElementById("ui-passive-desc-menu"),
        document.getElementById("ui-passive-desc-pop")
      ].filter(Boolean);
      const setText = (txt)=>{ for (const t of targets) t.textContent = txt; };
      const setHtml  = (html)=>{ for (const t of targets) t.innerHTML = html; };
      if (!p){ setText("아직 선택되지 않았습니다. (메뉴에서 5종 중 1개 선택)"); return; }
      if (p==="rebuild"){
        setHtml("• HP 70%↓부터 피해 감소(10%→12%)<br/>"+
          "• 보호막이 깨질 때 짧은 '긴급 보강'(피해 -38%, 쿨 7s)<br/>"+
          "• 보호막 재생 +15% (최종전 +10% 추가)<br/>"+
          "• 저체력일수록 방어↑ (최대: HP +15 / SH +7.5)<br/>"+
          "• 일정 시간 무피격이면 HP 자동 수리(저체력↑ / 최종전 딜레이↓)<br/>"+
          "");
      } else if (p==="resonance"){
        setHtml("• 피격 시 공명 게이지 상승 → 포탑 피해/공속 증가<br/>"+
          "• 100% 시 에너지 방출(AoE) 후 게이지 0 리셋<br/>"+
          "• 방출 피해: (60 + 최대보호막×20%) × (1 + 웨이브×1%)<br/>"+
          "");
      } else if (p==="overload"){
        setHtml("• 기본 포탑 버프(활성도 비례): 피해/공속 증가(상시)<br/>"+
          "• 포탑 적중 시 '표식'(최대 5, 4s 갱신) → 표식당 받는 터렛피해: 일반/엘리트 +3%, 보스 +1.5%<br/>"+
          "• HP 30%↓ 진입 시: 쇼크웨이브 + 버스트 6s (쿨 18s)<br/>"+
          "• 표식(최대 5중첩, 4s 갱신), 버스트 중 관통+1 / 90px 폭발(35%) / 최종보스 추가피해 +25%<br/>"+
          "");
      } else if (p==="overdrive"){
        setHtml("• 코어가 직접 자동 공격(상시)<br/>"+
          "• HP가 낮을수록 공격력/공속 증가 (HP 10% 이하 MAX)<br/>"+
          "• 코어 공격 적중 시 광역 피해 30% 추가<br/>"+
          "• 에너지포는 30% 광역피해를 입힘");
      } else if (p==="rebirth"){
        setHtml("• 코어 파괴 직전 시간 되감기 후 1회 부활<br/>"+
          "• 부활 수치: HP 45% / SH 25% / 3.0초 무적<br/>"+
          "• 부활 직후 적 투사체(운석 포함) 전부 삭제<br/>"+
          "• 부활 후 랜덤 패시브 자동 전환(효과 80%)<br/>"+
          "• 시간왜곡 강화 +15%는 런 끝까지 유지");
      }
      if (s.passives.fromRebirth){
        const tag = " <span style=\"color:#fcd34d\">(80%)</span>";
        for (const t of targets){ if (t && !String(t.innerHTML).includes("(80%)")) t.innerHTML += tag; }
      }
    },
    
updateCoreUpgPanel(){
  const s=Core.state;
  const card=UI.els["coreUpgCard"];
  if (!card) return;
  const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
  card.style.display = inShop ? "block" : "none";
  if (!inShop) return;

  // ===== Max HP/SH upgrades =====
  const M = CFG.coreMaxUpg || { hpAdd:[0], hpCosts:[0], shAdd:[0], shCosts:[0] };
  const hpLvM = clamp((s.core.hpMaxLv||0), 0, 3);
  const shLvM = clamp((s.core.shMaxLv||0), 0, 3);

  const baseHp = CFG.core.hpMax;
  const baseSh = CFG.core.shMax;

  const hpCur = baseHp + (M.hpAdd[hpLvM] ?? 0);
  const hpNext = baseHp + (M.hpAdd[Math.min(3, hpLvM+1)] ?? (M.hpAdd[hpLvM] ?? 0));
  const shCur = baseSh + (M.shAdd[shLvM] ?? 0);
  const shNext = baseSh + (M.shAdd[Math.min(3, shLvM+1)] ?? (M.shAdd[shLvM] ?? 0));

  if (UI.els["ui-coremax-hp-cur"]) UI.els["ui-coremax-hp-cur"].textContent = Math.round(hpCur);
  if (UI.els["ui-coremax-hp-next"]) UI.els["ui-coremax-hp-next"].textContent = (hpLvM>=3) ? "MAX" : Math.round(hpNext);
  if (UI.els["ui-coremax-sh-cur"]) UI.els["ui-coremax-sh-cur"].textContent = Math.round(shCur);
  if (UI.els["ui-coremax-sh-next"]) UI.els["ui-coremax-sh-next"].textContent = (shLvM>=3) ? "MAX" : Math.round(shNext);

  const hpCostM = (M.hpCosts[hpLvM] ?? 0);
  const shCostM = (M.shCosts[shLvM] ?? 0);
  if (UI.els["ui-coremax-hp-cost"]) UI.els["ui-coremax-hp-cost"].textContent = (hpLvM>=3) ? "-" : hpCostM;
  if (UI.els["ui-coremax-sh-cost"]) UI.els["ui-coremax-sh-cost"].textContent = (shLvM>=3) ? "-" : shCostM;

  const hpBtnM = UI.els["btn-coremax-hp"];
  const shBtnM = UI.els["btn-coremax-sh"];
  if (hpBtnM) hpBtnM.disabled = (hpLvM>=3) || (s.resources.crystals < hpCostM);
  if (shBtnM) shBtnM.disabled = (shLvM>=3) || (s.resources.crystals < shCostM);

  // ===== Shield regen upgrades =====
  const RG = CFG.coreShRegenUpg || { addPerSec:[0], costs:[0,0,0] };
  const rgLv = clamp((s.core.shRegenLv||0), 0, 3);
  const rgCur = (CFG.core.shRegenPerSec + (RG.addPerSec?.[rgLv] ?? 0));
  const rgNext = (CFG.core.shRegenPerSec + (RG.addPerSec?.[Math.min(3, rgLv+1)] ?? (RG.addPerSec?.[rgLv] ?? 0)));
  if (UI.els["ui-coreshrg-cur"]) UI.els["ui-coreshrg-cur"].textContent = Math.round(rgCur);
  if (UI.els["ui-coreshrg-next"]) UI.els["ui-coreshrg-next"].textContent = (rgLv>=3) ? "MAX" : Math.round(rgNext);
  if (UI.els["ui-coreshrg-sub"]){
    UI.els["ui-coreshrg-sub"].textContent = (rgLv>=3)
      ? `보호막 재생 속도 ${Math.round(rgCur)}/s (MAX)`
      : `보호막 재생 속도 ${Math.round(rgCur)}/s → ${Math.round(rgNext)}/s`;
  }
  const rgCost = (RG.costs?.[rgLv] ?? 0);
  if (UI.els["ui-coreshrg-cost"]) UI.els["ui-coreshrg-cost"].textContent = (rgLv>=3) ? "-" : rgCost;
  const rgBtn = UI.els["btn-coreshrg"];
  if (rgBtn) rgBtn.disabled = (rgLv>=3) || (s.resources.crystals < rgCost);


  // ===== Repair / Emergency upgrades =====
  const RU = CFG.coreRepairUpg || { heal:[CFG.repair?.healHpFlat||75], cd:[CFG.repair?.cooldownSec||5.0], costs:[0,0,0] };
  const rLv = clamp((s.core.repairUpgLv||0), 0, 3);
  const rHealCur = (RU.heal?.[rLv] ?? (CFG.repair?.healHpFlat||75));
  const rHealNext = (RU.heal?.[Math.min(3, rLv+1)] ?? rHealCur);
  const rCdCur = (RU.cd?.[rLv] ?? (CFG.repair?.cooldownSec||5.0));
  const rCdNext = (RU.cd?.[Math.min(3, rLv+1)] ?? rCdCur);

  if (UI.els["ui-corerepair-cur"]) UI.els["ui-corerepair-cur"].textContent = `HP +${Math.round(rHealCur)} · 쿨 ${fmt1(rCdCur)}s`;
  if (UI.els["ui-corerepair-next"]) UI.els["ui-corerepair-next"].textContent = (rLv>=3) ? "MAX" : `HP +${Math.round(rHealNext)} · 쿨 ${fmt1(rCdNext)}s`;
  if (UI.els["ui-corerepair-sub"]){
    UI.els["ui-corerepair-sub"].textContent = (rLv>=3)
      ? `수리: HP +${Math.round(rHealCur)} · 쿨 ${fmt1(rCdCur)}s (MAX)`
      : `수리 회복/쿨타임 강화`;
  }
  const rCost = (RU.costs?.[rLv] ?? 0);
  if (UI.els["ui-corerepair-cost"]) UI.els["ui-corerepair-cost"].textContent = (rLv>=3) ? "-" : rCost;
  const rBtn = UI.els["btn-corerepair"];
  if (rBtn) rBtn.disabled = (rLv>=3) || (s.resources.crystals < rCost);

  const EU = CFG.coreEmergencyUpg || { restorePct:[CFG.emergencyShield?.restorePct||0.38], cd:[CFG.emergencyShield?.cooldownSec||15.0], costs:[0,0,0] };
  const eLv = clamp((s.core.emergencyUpgLv||0), 0, 3);
  const ePctCur = (EU.restorePct?.[eLv] ?? (CFG.emergencyShield?.restorePct||0.38));
  const ePctNext = (EU.restorePct?.[Math.min(3, eLv+1)] ?? ePctCur);
  const eCdCur = (EU.cd?.[eLv] ?? (CFG.emergencyShield?.cooldownSec||15.0));
  const eCdNext = (EU.cd?.[Math.min(3, eLv+1)] ?? eCdCur);

  if (UI.els["ui-coreem-cur"]) UI.els["ui-coreem-cur"].textContent = `${Math.round(ePctCur*100)}% · 쿨 ${Math.round(eCdCur)}s`;
  if (UI.els["ui-coreem-next"]) UI.els["ui-coreem-next"].textContent = (eLv>=3) ? "MAX" : `${Math.round(ePctNext*100)}% · 쿨 ${Math.round(eCdNext)}s`;
  if (UI.els["ui-coreem-sub"]){
    UI.els["ui-coreem-sub"].textContent = (eLv>=3)
      ? `긴급 보호막: ${Math.round(ePctCur*100)}% · 쿨 ${Math.round(eCdCur)}s (MAX)`
      : `회복량/쿨타임 강화`;
  }
  const eCost = (EU.costs?.[eLv] ?? 0);
  if (UI.els["ui-coreem-cost"]) UI.els["ui-coreem-cost"].textContent = (eLv>=3) ? "-" : eCost;
  const eBtn = UI.els["btn-coreem"];
  if (eBtn) eBtn.disabled = (eLv>=3) || (s.resources.crystals < eCost);

  // ===== Armor upgrades =====
  const steps = (CFG.coreUpg && CFG.coreUpg.armorSteps) ? CFG.coreUpg.armorSteps : [CFG.core.armorHP||0];
  const costs = (CFG.coreUpg && CFG.coreUpg.armorCosts) ? CFG.coreUpg.armorCosts : [0,0,0];
  const hpLv = clamp((s.core.armorHpLv||0),0,3);
  const shLv = clamp((s.core.armorShLv||0),0,3);

  const aHpCur = steps[hpLv] ?? (CFG.core.armorHP||0);
  const aHpNext = steps[Math.min(3, hpLv+1)] ?? aHpCur;
  const aShCur = steps[shLv] ?? (CFG.core.armorSH||0);
  const aShNext = steps[Math.min(3, shLv+1)] ?? aShCur;

  UI.els["ui-coreupg-hp-cur"].textContent = Math.round(aHpCur);
  UI.els["ui-coreupg-hp-next"].textContent = (hpLv>=3) ? "MAX" : Math.round(aHpNext);
  UI.els["ui-coreupg-sh-cur"].textContent = Math.round(aShCur);
  UI.els["ui-coreupg-sh-next"].textContent = (shLv>=3) ? "MAX" : Math.round(aShNext);

  // Sub-lines: explain what the armor means (flat damage reduction)
  if (UI.els["ui-coreupg-hp-sub"]){
    UI.els["ui-coreupg-hp-sub"].textContent = (hpLv>=3)
      ? `코어가 받는 HP 피해 -${Math.round(aHpCur)} (MAX)`
      : `코어가 받는 HP 피해 -${Math.round(aHpCur)} → -${Math.round(aHpNext)}`;
  }
  if (UI.els["ui-coreupg-sh-sub"]){
    UI.els["ui-coreupg-sh-sub"].textContent = (shLv>=3)
      ? `코어가 받는 보호막 피해 -${Math.round(aShCur)} (MAX)`
      : `코어가 받는 보호막 피해 -${Math.round(aShCur)} → -${Math.round(aShNext)}`;
  }

  const aHpCost = costs[hpLv] ?? 0;
  const aShCost = costs[shLv] ?? 0;
  UI.els["ui-coreupg-hp-cost"].textContent = (hpLv>=3) ? "-" : aHpCost;
  UI.els["ui-coreupg-sh-cost"].textContent = (shLv>=3) ? "-" : aShCost;

  const hpBtn = UI.els["btn-coreupg-hp"];
  const shBtn = UI.els["btn-coreupg-sh"];
  if (hpBtn) hpBtn.disabled = (hpLv>=3) || (s.resources.crystals < aHpCost);
  if (shBtn) shBtn.disabled = (shLv>=3) || (s.resources.crystals < aShCost);
},

    updateTurretUpgPanel(){
      const s=Core.state;
      const card=UI.els["turretUpgCard"];
      if (!card) return;

      const isGameOver = (s.game.phase==="gameover" || s.game.phase==="clear");
      card.style.display = isGameOver ? "none" : "block";
      if (isGameOver) return;

      const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
      const t = Core.getSelectedTurret ? Core.getSelectedTurret() : null;

      const hint=UI.els["ui-turretupg-hint"];
      const detail=UI.els["ui-turretupg-detail"];

      if (!t){
        if (hint) hint.style.display = "block";
        if (detail) detail.style.display = "none";
        return;
      }
      if (hint) hint.style.display = "none";
      if (detail) detail.style.display = "block";

      const cfg = (CFG.turrets && CFG.turrets[t.type]) ? CFG.turrets[t.type] : {name:t.type, cost:0};
      UI.els["ui-turretupg-name"].textContent = cfg.name;
      UI.els["ui-turretupg-lv"].textContent = "Lv"+(t.lv||1);
      UI.els["ui-turretupg-path"].textContent = t.path ? `(${t.path})` : "";

      UI.els["ui-turretupg-dmg"].textContent = String(Math.round(t.dmg||0));
      UI.els["ui-turretupg-aspd"].textContent = fmt1(t.shotsPerSec||0);
      UI.els["ui-turretupg-range"].textContent = String(Math.round(t.range||0));
      UI.els["ui-turretupg-hp"].textContent = `${Math.ceil(t.hp||0)}/${Math.ceil(t.hpMax||0)}`;

      let sp="-";
      if (t.type==="slow"){
        sp = `둔화 ${Math.round((t.slowPct||0)*100)}% ${fmt1(t.slowSec||0)}s`;
        if (t.path==="A") sp += " +확산";
        if (t.path==="B") sp += " +보스효율";
      } else if (t.type==="splash"){
        sp = `폭발 ${Math.round((t.splashPct||0)*100)}% r${Math.round(t.splashR||0)}`;
        if (t.path==="A") sp += " +파편";
        if (t.path==="B") sp += " +중포격";
      } else {
        if (t.path==="A") sp = "집중 강화";
        else if (t.path==="B") sp = "연사 강화";
        else sp = "-";
      }
      UI.els["ui-turretupg-special"].textContent = sp;

      const lv = t.lv||1;
      const chooseBranch = (lv===2 && !t.path);

      const upBtn = UI.els["btn-turretupg-up"];
      const upA = UI.els["btn-turretupg-upA"];
      const upB = UI.els["btn-turretupg-upB"];
      const sellBtn = UI.els["btn-turretupg-sell"];

      const nextEl = UI.els["ui-turretupg-next"];

      if (chooseBranch){
        if (upBtn) upBtn.style.display="none";
        if (upA) upA.style.display="";
        if (upB) upB.style.display="";
        const c = Sim.turretUpgCost(t.type, 3);
        UI.els["ui-turretupg-costA"].textContent = String(c);
        UI.els["ui-turretupg-costB"].textContent = String(c);
        if (upA) upA.disabled = (!inShop) || (s.resources.crystals < c);
        if (upB) upB.disabled = (!inShop) || (s.resources.crystals < c);

        if (nextEl){
          if (!inShop) nextEl.textContent="대기시간(설치/상점)에서만 업그레이드/판매 가능";
          else {
            const stA = Sim.computeTurretStats(t.type, 3, "A");
            const stB = Sim.computeTurretStats(t.type, 3, "B");
            if (stA && stB){
              nextEl.textContent = `Lv3 분기: A(피해 ${Math.round(stA.dmg)} / 공속 ${fmt1(stA.shotsPerSec)}) 또는 B(피해 ${Math.round(stB.dmg)} / 공속 ${fmt1(stB.shotsPerSec)})`;
            } else nextEl.textContent="Lv3 분기를 선택하세요.";
          }
        }
      } else {
        if (upBtn) upBtn.style.display="";
        if (upA) upA.style.display="none";
        if (upB) upB.style.display="none";

        const toLv = Math.min(5, lv+1);
        const c = (lv>=5) ? 0 : Sim.turretUpgCost(t.type, toLv);
        UI.els["ui-turretupg-cost"].textContent = (lv>=5) ? "-" : String(c);
        if (upBtn) upBtn.disabled = (!inShop) || (lv>=5) || (s.resources.crystals < c);

        if (nextEl){
          if (!inShop) nextEl.textContent="대기시간(설치/상점)에서만 업그레이드/판매 가능";
          else if (lv>=5) nextEl.textContent="MAX 레벨";
          else {
            const st = Sim.computeTurretStats(t.type, toLv, t.path||null);
            if (st){
              nextEl.textContent = `다음: Lv${toLv} (피해 ${Math.round(st.dmg)} / 공속 ${fmt1(st.shotsPerSec)} / 사거리 ${Math.round(st.range)})`;
            } else nextEl.textContent = `다음: Lv${toLv}`;
          }
        }
      }

      const refund = Math.floor((t.spent!=null?t.spent:cfg.cost||0) * 0.70);
      UI.els["ui-turretupg-sellval"].textContent = String(refund);
      if (sellBtn) sellBtn.disabled = !inShop;
    },

updateSkillUpgPanel(){
  const s=Core.state;
  const card=UI.els["skillUpgCard"];
  if (!card) return;
  const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
  card.style.display = inShop ? "block" : "none";
  if (!inShop) return;

  const U = CFG.skillUpg || {};
  const eLv = clamp((s.skillUpg && s.skillUpg.energyLv)||0,0,3);
  const qLv = clamp((s.skillUpg && s.skillUpg.wallLv)||0,0,3);
  const rLv = clamp((s.skillUpg && s.skillUpg.warpLv)||0,0,3);

  // E
  const eCfg = Sim.getEnergyCfg(s);
  if (UI.els["ui-skillupg-e-cur"]) UI.els["ui-skillupg-e-cur"].textContent = "Lv"+eLv;
  if (UI.els["ui-skillupg-e-next"]) UI.els["ui-skillupg-e-next"].textContent = (eLv>=3) ? "MAX" : ("Lv"+(eLv+1));
  if (UI.els["ui-skillupg-e-sub"]){
    const nextLv = Math.min(3, eLv+1);
    const dmgNow = (U.energy?.damage?.[eLv] != null)
      ? Math.round(U.energy.damage[eLv])
      : Math.round(CFG.energyCannon.damage*(U.energy?.dmgMul?.[eLv]??1));
    const dmgNext = (U.energy?.damage?.[nextLv] != null)
      ? Math.round(U.energy.damage[nextLv])
      : Math.round(CFG.energyCannon.damage*(U.energy?.dmgMul?.[nextLv]??(U.energy?.dmgMul?.[eLv]??1)));
    const cdNow = (U.energy?.cd?.[eLv] ?? CFG.energyCannon.cooldownSec);
    const cdNext = (U.energy?.cd?.[nextLv] ?? cdNow);
    const chNow = (U.energy?.charge?.[eLv] ?? CFG.energyCannon.chargeSec);
    const chNext = (U.energy?.charge?.[nextLv] ?? chNow);
    let extra = "";
    const finalSh = (U.energy?.finalShRestore ?? 0);
    if (finalSh>0 && (eLv>=3 || nextLv>=3)) extra = ` · 최종효과: 적중 시 SH+${Math.round(finalSh)}`;
    UI.els["ui-skillupg-e-sub"].textContent = `피해 ${dmgNow}→${dmgNext} · 쿨 ${cdNow}→${cdNext} · 충전 ${fmt1(chNow)}→${fmt1(chNext)}s${extra}`;
  }
  const eCost = (U.energy?.costs?.[eLv] ?? 0);
  if (UI.els["ui-skillupg-e-cost"]) UI.els["ui-skillupg-e-cost"].textContent = (eLv>=3) ? "-" : eCost;
  if (UI.els["btn-skillupg-e"]) UI.els["btn-skillupg-e"].disabled = (eLv>=3) || (s.resources.crystals < eCost);

  // Q
  const wCfg = Sim.getWallCfg(s);
  if (UI.els["ui-skillupg-q-cur"]) UI.els["ui-skillupg-q-cur"].textContent = "Lv"+qLv;
  if (UI.els["ui-skillupg-q-next"]) UI.els["ui-skillupg-q-next"].textContent = (qLv>=3) ? "MAX" : ("Lv"+(qLv+1));
  if (UI.els["ui-skillupg-q-sub"]){
    const nextLv = Math.min(3, qLv+1);
    const invNow = (CFG.wall.invulnSec*(U.wall?.inv?.[qLv]??1));
    const invNext = (CFG.wall.invulnSec*(U.wall?.inv?.[nextLv]??(U.wall?.inv?.[qLv]??1)));
    const cdNow = (U.wall?.cd?.[qLv] ?? CFG.wall.cooldownSec);
    const cdNext = (U.wall?.cd?.[nextLv] ?? cdNow);
    let extra = "";
    const fp = (U.wall?.finalThornsPct ?? 0);
    const bossEff = (U.wall?.finalThornsBossEff!=null)?U.wall.finalThornsBossEff:0.55;
    const minB = (U.wall?.finalThornsMinBase ?? 0);
    const minW = (U.wall?.finalThornsMinPerWave ?? 0);
    const hitCap = (U.wall?.finalThornsHitCap ?? 0);
    const secCap = (U.wall?.finalThornsSecCap ?? 0);
    if (fp>0 && (qLv>=3 || nextLv>=3)){
      const pctTxt = Math.round(fp*100);
      const bossTxt = Math.round(fp*bossEff*1000)/10;
      const minTxt = (minW>0) ? ` · 최소 ${Math.round(minB)}+W×${Math.round(minW)}` : (minB>0?` · 최소 ${Math.round(minB)}`:"");
      const capTxt = (hitCap>0 || secCap>0) ? ` · 캡 1타 ${Math.round(hitCap)} / 초 ${Math.round(secCap)}` : "";
      extra = ` · 최종효과: 가시갑옷 — 차단 시 반사 ${pctTxt}% (보스 ${bossTxt}%)${minTxt}${capTxt}`;
    }
    UI.els["ui-skillupg-q-sub"].textContent = `무적 ${fmt1(invNow)}→${fmt1(invNext)}s · 쿨 ${cdNow}→${cdNext}s${extra}`;
  }
  const qCost = (U.wall?.costs?.[qLv] ?? 0);
  if (UI.els["ui-skillupg-q-cost"]) UI.els["ui-skillupg-q-cost"].textContent = (qLv>=3) ? "-" : qCost;
  if (UI.els["btn-skillupg-q"]) UI.els["btn-skillupg-q"].disabled = (qLv>=3) || (s.resources.crystals < qCost);

  // R
  const tCfg = Sim.getTimeWarpCfg(s);
  if (UI.els["ui-skillupg-r-cur"]) UI.els["ui-skillupg-r-cur"].textContent = "Lv"+rLv;
  if (UI.els["ui-skillupg-r-next"]) UI.els["ui-skillupg-r-next"].textContent = (rLv>=3) ? "MAX" : ("Lv"+(rLv+1));
  if (UI.els["ui-skillupg-r-sub"]){
    const nextLv = Math.min(3, rLv+1);
    const durNow = (U.warp?.dur?.[rLv] ?? CFG.timeWarp.durationSec);
    const durNext = (U.warp?.dur?.[nextLv] ?? durNow);
    const radNow = (U.warp?.radius?.[rLv] ?? CFG.timeWarp.radius);
    const radNext = (U.warp?.radius?.[nextLv] ?? radNow);
    const cdNow = (U.warp?.cd?.[rLv] ?? CFG.timeWarp.cooldownSec);
    const cdNext = (U.warp?.cd?.[nextLv] ?? cdNow);
    const mvNow = Math.round(100*(U.warp?.move?.[rLv] ?? CFG.timeWarp.moveSlowPct));
    const mvNext = Math.round(100*(U.warp?.move?.[nextLv] ?? (U.warp?.move?.[rLv] ?? CFG.timeWarp.moveSlowPct)));
    const akNow = Math.round(100*(U.warp?.atk?.[rLv] ?? CFG.timeWarp.atkSlowPct));
    const akNext = Math.round(100*(U.warp?.atk?.[nextLv] ?? (U.warp?.atk?.[rLv] ?? CFG.timeWarp.atkSlowPct)));
    let extra = "";
    const cb = (U.warp?.finalCdBoost ?? 0);
    if (cb>0 && (rLv>=3 || nextLv>=3)) extra = ` · 최종효과: 지속 중 스킬 쿨 회복 +${Math.round(cb*100)}%`;
    UI.els["ui-skillupg-r-sub"].textContent = `지속 ${fmt1(durNow)}→${fmt1(durNext)}s · 쿨 ${cdNow}→${cdNext}s · 반경 ${radNow}→${radNext} · 이속감소 ${mvNow}%→${mvNext}% · 공속감소 ${akNow}%→${akNext}%${extra}`;
  }
  const rCost = (U.warp?.costs?.[rLv] ?? 0);
  if (UI.els["ui-skillupg-r-cost"]) UI.els["ui-skillupg-r-cost"].textContent = (rLv>=3) ? "-" : rCost;
  if (UI.els["btn-skillupg-r"]) UI.els["btn-skillupg-r"].disabled = (rLv>=3) || (s.resources.crystals < rCost);
},

    toast(text){
      const t=UI.els["toast"];
      t.textContent=text; t.classList.add("show");
      Core.state.ui.toast.t=1.8;
    },
    ring(el, p){
      const deg=clamp(p,0,1)*360;
      el.style.background = `conic-gradient(var(--gold) 0deg, var(--gold) ${deg}deg, rgba(0,0,0,0) ${deg}deg)`;
    },


// Stack left-side panels so they never overlap the top HUD (fixes readability on mobile)
stackPanels(){
  const topbar = UI.els["topbar"];
  if (!topbar) return;
  let y = (topbar.offsetTop||0) + (topbar.offsetHeight||0) + 10;
  const gap = 10;
  const ids = ["effectCard","coreUpgCard","skillUpgCard","turretUpgCard"];
  for (const id of ids){
    const el = UI.els[id];
    if (!el) continue;
    if (el.style.display==="none") continue;
    el.style.top = y + "px";
    // ensure within viewport (don't push under bottom bar too hard)
    y += (el.offsetHeight||0) + gap;
  }
},
    update(dt){
      const s=Core.state;
      if (s.ui.toast.t>0){
        s.ui.toast.t-=dt;
        if (s.ui.toast.t<=0) UI.els["toast"].classList.remove("show");
      }
      UI.els["ui-crystals"].textContent=String(Math.floor(s.resources.crystals));
      UI.els["ui-wave"].textContent="Wave "+s.game.waveIndex;
      let phaseLabel = ({menu:"메뉴",setup:"설치",wave:"전투",shop:"상점",rewind:"되감기",gameover:"패배"}[s.game.phase]||s.game.phase);
      if (s.game.phase==="wave"){
        const w=s.game.waveIndex;
        const boss=(w%5===0);
        const ev=(s.game.event && s.game.event.active) ? s.game.event : null;
        if (boss) phaseLabel = (w===30) ? "최종전" : "보스전";
        else if (ev) phaseLabel = `이벤트: ${ev.name}`;
      }
      UI.els["ui-phase"].textContent=phaseLabel;

      /* final boss hud */
      {
        const hud = UI.els["finalBossHud"];
        if (hud){
          const fb = s.entities.enemies.find(en=>en && en.isFinalBoss && en.hp>0);
          const show = !!fb && (s.game.phase==="wave");
          hud.style.display = show ? "block" : "none";
          if (show){
            const ratio = (fb.hpMax>0)?(fb.hp/fb.hpMax):0;
            if (UI.els["ui-fbhpbar"]) UI.els["ui-fbhpbar"].style.width = (clamp(ratio,0,1)*100).toFixed(1)+"%";
            if (UI.els["ui-fbhpnum"]) UI.els["ui-fbhpnum"].textContent = `${Math.ceil(fb.hp)}/${Math.ceil(fb.hpMax)}`;
            const ph = fb.fbPhase || 1;
            if (UI.els["ui-fbphase"]) UI.els["ui-fbphase"].textContent = `P${ph}/3`;
            const tb = UI.els["topbar"];
            if (tb){
              const r = tb.getBoundingClientRect();
              hud.style.top = Math.round(r.bottom + 10) + "px";
            }
          }
        }
      }
      // event chip
      const _ev = (s.game.event && s.game.event.active) ? s.game.event : null;
      if (UI.els["ui-event-chip"]) {
        UI.els["ui-event-chip"].style.display = _ev ? "" : "none";
        if (_ev && UI.els["ui-event-name"]) UI.els["ui-event-name"].textContent = _ev.name;
        if (UI.els["ui-event-desc"]) UI.els["ui-event-desc"].textContent = _ev ? ` — ${_ev.desc}` : "";
        if (UI.els["ui-event-chip"]) UI.els["ui-event-chip"].title = _ev ? `${_ev.name}: ${_ev.desc}` : "";
      }

      // next wave preview chip/line
      if (s.game && s.game.running){
        Sim.ensureNextWavePreview(s);
        const p = s.game.nextWavePreview;
        const chip = UI.els["ui-next-chip"], txt = UI.els["ui-next-wave"], line = UI.els["ui-nextline"];
        if (p && p.waveIndex>0 && p.waveIndex<=30){
          const tags = `${p.final?" [최종]":(p.boss?" [보스]":"")}${p.event?` [이벤트:${p.event.name}]`:""}`;
          const enemies = UI.formatEnemyList(p.enemyKinds||[]);
          if (chip) chip.style.display = "";
          if (txt) txt.textContent = `다음: W${p.waveIndex}${tags}`;
          if (chip) chip.title = `W${p.waveIndex}${tags}\n적: ${enemies}${p.event?`\n이벤트: ${p.event.name} — ${p.event.desc}`:""}`;
          if (line) line.textContent = `다음 웨이브 적: ${enemies}${p.event?` · 이벤트: ${p.event.name} — ${p.event.desc}`:""}`;
        } else {
          if (chip) chip.style.display = "none";
          if (line) line.textContent = "";
        }
      } else {
        if (UI.els["ui-next-chip"]) UI.els["ui-next-chip"].style.display="none";
        if (UI.els["ui-nextline"]) UI.els["ui-nextline"].textContent="";
      }
      const hardUnlocked = !!(s.unlocks && s.unlocks.hard);
      // Hard mode is unlocked only after seeing an ending at least once.
      if (!hardUnlocked && s.game.difficulty!=="normal") s.game.difficulty="normal";
      UI.els["ui-diff"].textContent=(s.game.difficulty==="normal")?"노말":"하드";
      if (UI.els["btn-diff"]){
        if (!hardUnlocked){
          UI.els["btn-diff"].textContent = "하드 🔒";
          UI.els["btn-diff"].title = "하드 모드는 엔딩 이후 해금됩니다.";
          UI.els["btn-diff"].classList.add("locked");
        } else {
          UI.els["btn-diff"].textContent = (s.game.difficulty==="normal")?"하드":"노말";
          UI.els["btn-diff"].title = "";
          UI.els["btn-diff"].classList.remove("locked");
        }
      }
      UI.els["ui-speed"].textContent=s.game.speed.toFixed(1)+"x";

      UI.els["ui-hpbar"].style.width=(100*s.core.hp/s.core.hpMax).toFixed(1)+"%";
      UI.els["ui-shbar"].style.width=(100*s.core.sh/s.core.shMax).toFixed(1)+"%";
      UI.els["ui-hpnum"].textContent=Math.ceil(s.core.hp)+"/"+s.core.hpMax;
      UI.els["ui-shnum"].textContent=Math.ceil(s.core.sh)+"/"+s.core.shMax;

      // passive gauge (green horizontal bar)
      let gRatio=0;
      if (s.passives.selected==="resonance") gRatio = clamp(s.passives.resonance.gauge/CFG.resonance.max, 0, 1);
      else if (s.passives.selected==="overload") gRatio = clamp(Sim.act30to10(s), 0, 1);
      else if (s.passives.selected==="overdrive") gRatio = clamp(Sim.act100to10(s), 0, 1);
      else if (s.passives.selected==="rebuild") gRatio = clamp(Sim.act70to10(s), 0, 1);
      if (UI.els["ui-gaugebar"]){ UI.els["ui-gaugebar"].style.width=(gRatio*100).toFixed(1)+"%"; }
      if (UI.els["ui-gaugenum"]){ UI.els["ui-gaugenum"].textContent=Math.round(gRatio*100)+"%"; }

            {
        let pTxt = "패시브: "+UI.passiveName(s.passives.selected);
        if (s.passives.fromRebirth) pTxt += " (80%)";
        if (s.passives.rebirthTw) pTxt += " ⏳+15%";
        UI.els["ui-passive"].textContent = pTxt;
      }
      UI.els["ui-passive-lock"].textContent=s.passives.locked?"🔒":"";
      UI.syncPassiveButtons();
      UI.syncTurretButtons();

      UI.els["ui-armor-hp"].textContent=fmt1(Sim.getArmorHP(s));
      UI.els["ui-armor-sh"].textContent=fmt1(Sim.getArmorSH(s));

      // Armor is shown in the top bar chips.

      UI.updateCoreUpgPanel();
      UI.updateSkillUpgPanel();
      UI.updateTurretUpgPanel();
       UI.stackPanels();

      UpgHub.update();

      if (UI.syncModeButtons) UI.syncModeButtons();

      UI.els["ui-statusline"].textContent=s.ui.status||"상태: -";
      {
        let line2 = s.ui.status2||"";
        if (s.ui && s.ui.turretRepairMode){
          const cfgTR = CFG.turretRepair || {};
          const pickR = (cfgTR.pickR!=null) ? cfgTR.pickR : 28;
          const shift = Input.keys && Input.keys.has("shift");
          const t = (!shift) ? Sim.pickTurretAt(s, Input.lx, Input.ly, pickR) : null;
          let add = "";
          if (t && !t.dead){
            const nm = (CFG.turrets && CFG.turrets[t.type]) ? CFG.turrets[t.type].name : t.type;
            if (t.hp>=t.hpMax-0.001){
              add = `🔧포탑수리: ${nm} (최대)`;
            } else {
              const cost = Sim.turretRepairCost(s, t);
              const cd = Math.max((s.ui.turretRepairGlobalCd||0), (t.repairCd||0));
              const cdTxt = cd>0 ? (" (쿨 "+fmt1(cd)+"s)") : "";
              add = `🔧포탑수리: ${nm} ${Math.ceil(t.hp)}/${Math.ceil(t.hpMax)} → 풀수리 ${cost}💠${cdTxt}`;
            }
            add += " | Shift/빈곳 클릭: 주변 일괄수리";
          } else {
            const pr = Sim.previewTurretRepairArea(s, Input.lx, Input.ly);
            const cd = (s.ui.turretRepairGlobalCd||0);
            const cdTxt = cd>0 ? (" (쿨 "+fmt1(cd)+"s)") : "";
            if (pr && pr.any){
              const take = Math.min(pr.eligible, pr.maxN);
              if (take>0){
                add = `🔧일괄수리: 주변 손상 ${pr.damaged}기 / 가능 ${take}기, 예상 ${pr.totalCost}💠${cdTxt}`;
              } else {
                add = `🔧일괄수리: 주변 손상 ${pr.damaged}기 (전부 쿨중)${cdTxt}`;
              }
            } else {
              add = "🔧포탑수리 모드: 포탑 클릭 | 빈곳/Shift+클릭: 주변 일괄수리";
            }
          }
          line2 = line2 ? (line2 + " | " + add) : add;
        }
        UI.els["ui-statusline2"].textContent=line2;
      }

            const isGameOver = (s.game.phase==="gameover" || s.game.phase==="clear");
            const isEnding = (s.game.phase==="ending");
            const hideHud = isGameOver || isEnding;
      // menu panel: only in menu (not during run), not in gameover (restart-only)
      UI.els["menupanel"].style.display = (s.game.phase==="menu") ? "block" : "none";
      // gameover panel: restart button only
      if (UI.els["gameoverpanel"]) UI.els["gameoverpanel"].style.display = isGameOver ? "flex" : "none";
      // hide other UI during gameover
      if (UI.els["topbar"]) UI.els["topbar"].style.display = hideHud ? "none" : "block";
      if (UI.els["bottombar"]) UI.els["bottombar"].style.display = hideHud ? "none" : "block";
      if (UI.els["effectCard"]) UI.els["effectCard"].style.display = hideHud ? "none" : "block";


      // skills
      const inCombat = (s.game.running && s.game.phase==="wave");

      // E: energy cannon
      {
        const sk=s.skill.energyCannon;
        const eCfg = Sim.getEnergyCfg(s);
        const sub=UI.els["ui-skill-e-sub"], ring=UI.els["ui-skill-e-ring"];
        const btn=UI.els["btn-skill-e"];
        if (btn) btn.disabled = (!s.game.running);
        if (btn){
          const d = Math.round(eCfg.damage||0);
          btn.title = `에너지포: 피해 ${d} · 충전 ${fmt1(eCfg.chargeSec)}s · 쿨 ${fmt1(eCfg.cooldownSec)}s · 운석 약화 -45%(운석 요격)`;
        }
        if (sk.charging){
          if (sub) sub.textContent=`충전 ${fmt1(sk.charge)}/${fmt1(eCfg.chargeSec)}s`;
          if (ring) UI.ring(ring, sk.charge/Math.max(0.1, eCfg.chargeSec));
        } else if (sk.cd>0){
          if (sub) sub.textContent=`쿨 ${Math.ceil(sk.cd)}s`;
          if (ring) UI.ring(ring, 1-(sk.cd/Math.max(0.1, eCfg.cooldownSec)));
        } else {
          if (sub) sub.textContent=`READY · 피해 ${Math.round(eCfg.damage||0)}`;
          if (ring) UI.ring(ring, 1);
        }
      }

      // Q: wall (barrier)
      {
        const W=s.skill.wall;
        const wCfg = Sim.getWallCfg(s);
        const sub=UI.els["ui-skill-q-sub"], ring=UI.els["ui-skill-q-ring"];
        const btn=UI.els["btn-skill-q"];
        if (btn) btn.disabled = (!inCombat && W.active<=0);
        if (btn){
          const qLv = clamp((s.skillUpg && s.skillUpg.wallLv)||0, 0, 3);
          const sp = (qLv>=3 && (wCfg.finalThornsPct||0)>0) ? ` · 특수: 가시반사 ${Math.round((wCfg.finalThornsPct||0)*100)}%` : "";
          btn.title = `방벽: 무적 ${fmt1(wCfg.invulnSec)}s · 쿨 ${fmt1(wCfg.cooldownSec)}s · 비용 ${wCfg.cost}${sp} · 운석: 코어 무효/포탑 -50%`;
        }
        if (!inCombat && W.active<=0){
          if (sub) sub.textContent="대기";
          if (ring) UI.ring(ring, 0);
        } else if (W.active>0){
          if (sub) sub.textContent=`활성 ${fmt1(W.active)}s`;
          if (ring) UI.ring(ring, clamp(W.active/Math.max(0.1, wCfg.invulnSec||1), 0, 1));
        } else if (W.cd>0){
          if (sub) sub.textContent=`쿨 ${Math.ceil(W.cd)}s`;
          const cdMax = (wCfg.cooldownSec||Math.max(W.cd,1));
          if (ring) UI.ring(ring, 1-(W.cd/cdMax));
        } else {
          if (sub) sub.textContent=`READY (-${wCfg.cost})`;
          if (ring) UI.ring(ring, 1);
        }
      }

      // R: time warp
      {
        const T=s.skill.timeWarp;
        const tCfg = Sim.getTimeWarpCfg(s);
        const sub=UI.els["ui-skill-r-sub"], ring=UI.els["ui-skill-r-ring"];
        const btn=UI.els["btn-skill-r"];
        if (btn) btn.disabled = (!inCombat && T.active<=0);
        if (btn){
          const rLv = clamp((s.skillUpg && s.skillUpg.warpLv)||0, 0, 3);
          const sp = (rLv>=3 && (tCfg.finalCdBoost||0)>0) ? ` · 특수: 스킬 쿨 회복 +${Math.round((tCfg.finalCdBoost||0)*100)}%` : "";
          btn.title = `시간왜곡: 지속 ${fmt1(tCfg.durationSec)}s · 반경 ${tCfg.radius} · 이동 -${Math.round((tCfg.moveSlowPct||0)*100)}% · 공속 -${Math.round((tCfg.atkSlowPct||0)*100)}% · 운석 낙하 -35%${sp}`;
        }
        if (!inCombat && T.active<=0){
          if (sub) sub.textContent="대기";
          if (ring) UI.ring(ring, 0);
        } else if (T.active>0){
          if (sub) sub.textContent=`활성 ${fmt1(T.active)}/${fmt1(tCfg.durationSec)}s`;
          if (ring) UI.ring(ring, clamp(T.active/(tCfg.durationSec||1), 0, 1));
        } else if (T.cd>0){
          if (sub) sub.textContent=`쿨 ${Math.ceil(T.cd)}s`;
          const cdMax = (tCfg.cooldownSec||Math.max(T.cd,1));
          if (ring) UI.ring(ring, 1-(T.cd/cdMax));
        } else {
          if (sub) sub.textContent=`READY (-${tCfg.cost})`;
          if (ring) UI.ring(ring, 1);
        }
      }



// repair / emergency buttons
const repBtn = UI.els["btn-repair"];
if (repBtn){
  const repCd = s.core.repairCd||0;
  const repCfg = Sim.getRepairCfg(s);
  const repCost = repCfg.cost;
  repBtn.textContent = repCd>0 ? `수리 ${Math.ceil(repCd)}s` : `수리 (-${repCost})`;
  repBtn.title = `수리: HP +${Math.round(repCfg.healHpFlat||0)} · 쿨 ${fmt1(repCfg.cooldownSec||0)}s`;
  const blocked = (s.core.repairLock||0)>0;
  repBtn.disabled = (!s.game.running) || (s.game.phase==="menu") || (s.game.phase==="gameover") || (s.game.phase==="clear") || (s.game.phase==="ending") || repCd>0 || blocked || (s.core.hp>=s.core.hpMax-0.01) || (s.resources.crystals<repCost);
}
const emBtn = UI.els["btn-emergency"];
if (emBtn){
  const emCd = s.core.emergencyCd||0;
  const emCfg = Sim.getEmergencyCfg(s);
  emBtn.textContent = emCd>0 ? `긴급 ${Math.ceil(emCd)}s` : `긴급`;
  emBtn.title = `긴급 보호막: 최대 SH의 ${Math.round((emCfg.restorePct||0)*100)}% 즉시 회복 · 쿨 ${Math.round(emCfg.cooldownSec||0)}s`;
  emBtn.disabled = (!s.game.running) || (s.game.phase==="menu") || (s.game.phase==="gameover") || (s.game.phase==="clear") || (s.game.phase==="ending") || emCd>0 || (s.core.sh>=s.core.shMax-0.01);
}
    }
  };

  const Sim = {
    getHpPct(s){ return s.core.hp/s.core.hpMax; },
    act30to10(s){ const hp=Sim.getHpPct(s); return clamp((0.30-hp)/0.20,0,1); },
    act100to10(s){ const hp=Sim.getHpPct(s); return clamp((1-hp)/(1-CFG.rebuild.maxAtHpPct),0,1); },
    act70to10(s){ const hp=Sim.getHpPct(s); return clamp((0.70-hp)/0.60,0,1); },
    isFinalBattle(s){ return !!(s && s.game && s.game.phase==="wave" && s.game.waveIndex===30); },


    // ===== Event helpers =====
    eventActive(s){ return !!(s.game && s.game.event && s.game.event.active); },
    eventInWave(s){ return (s.game && s.game.phase==="wave" && Sim.eventActive(s)) ? s.game.event : null; },

// Effective skill configs (applies skill upgrade levels)
getEnergyCfg(s){
  const lv = clamp((s.skillUpg && s.skillUpg.energyLv)||0, 0, 3);
  const U = CFG.skillUpg && CFG.skillUpg.energy;
  const base = CFG.energyCannon;
  if (!U) return base;
  const dmg = (U.damage && U.damage[lv]!=null)
    ? U.damage[lv]
    : (base.damage * ((U.dmgMul && U.dmgMul[lv]!=null) ? U.dmgMul[lv] : 1.0));
  return {
    ...base,
    damage: dmg,
    cooldownSec: U.cd[lv] ?? base.cooldownSec,
    chargeSec: U.charge[lv] ?? base.chargeSec,
    finalShRestore: U.finalShRestore || 0
  };
},
getWallCfg(s){
  const lv = clamp((s.skillUpg && s.skillUpg.wallLv)||0, 0, 3);
  const U = CFG.skillUpg && CFG.skillUpg.wall;
  const base = CFG.wall;
  if (!U) return base;
  return {
    ...base,
    invulnSec: (base.invulnSec||1.0) * (U.inv[lv] ?? 1.0),
    cooldownSec: U.cd[lv] ?? base.cooldownSec,
    // final upgrade bonus (Lv3 only)
    finalThornsPct: (lv>=3) ? (U.finalThornsPct||0) : 0,
    finalThornsBossEff: (lv>=3) ? ((U.finalThornsBossEff!=null)?U.finalThornsBossEff:0.55) : 0,
    finalThornsMinBase: (lv>=3) ? (U.finalThornsMinBase||0) : 0,
    finalThornsMinPerWave: (lv>=3) ? (U.finalThornsMinPerWave||0) : 0,
    finalThornsHitCap: (lv>=3) ? (U.finalThornsHitCap||0) : 0,
    finalThornsHitCapBoss: (lv>=3) ? (U.finalThornsHitCapBoss||0) : 0,
    finalThornsSecCap: (lv>=3) ? (U.finalThornsSecCap||0) : 0,
    finalThornsSecCapBoss: (lv>=3) ? (U.finalThornsSecCapBoss||0) : 0,
    finalThornsSplashPct: (lv>=3) ? (U.finalThornsSplashPct||0) : 0,
    finalThornsSplashR: (lv>=3) ? (U.finalThornsSplashR||0) : 0
  };
},
getTimeWarpCfg(s){
  const lv = clamp((s.skillUpg && s.skillUpg.warpLv)||0, 0, 3);
  const U = CFG.skillUpg && CFG.skillUpg.warp;
  const base = CFG.timeWarp;
  const mul = twMul(s);
  if (!U){
    return {
      ...base,
      durationSec: (base.durationSec||0) * mul,
      radius: (base.radius||0) * mul,
      moveSlowPct: (base.moveSlowPct||0) * mul,
      atkSlowPct: (base.atkSlowPct||0) * mul,
      bossEff: (base.bossEff||0) * mul
    };
  }
  return {
    ...base,
    durationSec: (U.dur[lv] ?? base.durationSec) * mul,
    cooldownSec: U.cd[lv] ?? base.cooldownSec,
    radius: (U.radius[lv] ?? base.radius) * mul,
    moveSlowPct: (U.move[lv] ?? base.moveSlowPct) * mul,
    atkSlowPct: (U.atk[lv] ?? base.atkSlowPct) * mul,
    bossEff: (U.bossEff ?? base.bossEff) * mul,
    // final upgrade bonus (Lv3 only)
    finalCdBoost: (lv>=3) ? (U.finalCdBoost||0) : 0
  };
},


getRepairCfg(s){
  const lv = clamp((s.core && s.core.repairUpgLv)||0, 0, 3);
  const RU = CFG.coreRepairUpg;
  const base = CFG.repair;
  if (!RU) return base;
  return {
    ...base,
    healHpFlat: (RU.heal && RU.heal[lv]!=null) ? RU.heal[lv] : base.healHpFlat,
    cooldownSec: (RU.cd && RU.cd[lv]!=null) ? RU.cd[lv] : base.cooldownSec
  };
},
getEmergencyCfg(s){
  const lv = clamp((s.core && s.core.emergencyUpgLv)||0, 0, 3);
  const EU = CFG.coreEmergencyUpg;
  const base = CFG.emergencyShield;
  if (!EU) return base;
  return {
    ...base,
    restorePct: (EU.restorePct && EU.restorePct[lv]!=null) ? EU.restorePct[lv] : base.restorePct,
    cooldownSec: (EU.cd && EU.cd[lv]!=null) ? EU.cd[lv] : base.cooldownSec
  };
},

    crystalGainMul(s){
      let mul = (CFG.economy && typeof CFG.economy.crystalMul === "number") ? CFG.economy.crystalMul : 1.0;
      const ev = Sim.eventActive(s) ? s.game.event : null;
      if (ev && ev.mods && typeof ev.mods.crystalMul === "number") mul *= ev.mods.crystalMul;
      return mul;
    },
    assignRandomEventForWave(s, wave){
      const w = (wave!=null) ? wave : (s.game.waveIndex||0);
      const wants = (w>0) && (w%3===0) && (w%5!==0) && (w!==30);
      if (!wants || !EVENT_POOL || EVENT_POOL.length===0){
        s.game.event={active:false, key:null, name:"", desc:"", mods:{}};
        return null;
      }
      const last = s.game.lastEventKey;
      let pick = null;
      for (let i=0;i<8;i++){
        const cand = EVENT_POOL[(Math.random()*EVENT_POOL.length)|0];
        if (!last || cand.key!==last || EVENT_POOL.length===1){ pick=cand; break; }
      }
      if (!pick) pick = EVENT_POOL[0];
      s.game.lastEventKey = pick.key;
      s.game.event={active:true, key:pick.key, name:pick.name, desc:pick.desc, mods:(pick.mods||{})};
      return s.game.event;
    },

    // ===== Next wave preview (stable once rolled) =====
    rollEventPreview(s, wave){
      const w = (wave!=null) ? wave : (s.game.waveIndex||0) + 1;
      const wants = (w>0) && (w%3===0) && (w%5!==0) && (w!==30);
      if (!wants || !EVENT_POOL || EVENT_POOL.length===0){
        s.game.nextEventPreview = null;
        return null;
      }
      if (s.game.nextEventPreview && s.game.nextEventPreview.waveIndex===w){
        return s.game.nextEventPreview.event;
      }
      const last = s.game.lastEventKey;
      let pick = null;
      for (let i=0;i<8;i++){
        const cand = EVENT_POOL[(Math.random()*EVENT_POOL.length)|0];
        if (!last || cand.key!==last || EVENT_POOL.length===1){ pick=cand; break; }
      }
      if (!pick) pick = EVENT_POOL[0];
      const ev = {active:true, key:pick.key, name:pick.name, desc:pick.desc, mods:(pick.mods||{})};
      s.game.nextEventPreview = {waveIndex:w, event:ev};
      return ev;
    },

    ensureNextWavePreview(s){
      if (!s.game || !s.game.running) return;
      if (s.game.phase==="menu" || s.game.phase==="gameover" || s.game.phase==="clear") return;
      const next = (s.game.waveIndex||0) + 1;
      if (next>30) return;
      if (!s.game.nextWavePreview || s.game.nextWavePreview.waveIndex!==next){
        Sim.buildNextWavePreview(s, next);
      }
    },

    possibleEnemyKindsForWave(s, wave, ev){
      const w = Math.max(1, wave|0);
      const bossWave = (w%5===0);
      const finalWave = (w===30);
      const kinds = [];
      const add = (k)=>{ if (!kinds.includes(k)) kinds.push(k); };

      // base types
      add("normal");
      if (bossWave || w>=2) add("fast");
      if (bossWave || w>=3) add("tank");
      if (bossWave || w>=8) add("elite");

      // specials
      if (bossWave || w>=4) add("ranged");
      if (bossWave || w>=6) add("bomber");
      if (bossWave || w>=10) add("disruptor");
      if (w>=7) add("supporter");
      if (w>=8) add("splitter");
      if (w>=9) add("leech");
      if (w>=11) add("sniper");
      if (w>=14) add("armored");

      const meteorFrom = (CFG.meteor && CFG.meteor.spawnFromWave!=null) ? CFG.meteor.spawnFromWave : 16;
      if (!finalWave && w>=meteorFrom) add("meteor");

      if (bossWave){
        add(finalWave ? "finalBoss" : "boss");
      }
      return kinds;
    },

    buildNextWavePreview(s, wave){
      const w = Math.max(1, wave|0);
      const bossWave = (w%5===0);
      const finalWave = (w===30);
      const ev = Sim.rollEventPreview(s, w);
      const enemyKinds = Sim.possibleEnemyKindsForWave(s, w, ev);
      s.game.nextWavePreview = { waveIndex:w, boss:bossWave, final:finalWave, event:ev, enemyKinds };
      return s.game.nextWavePreview;
    },

    resonancePulseDamage(s){
      const W = Math.max(1, s.game.waveIndex||1);
      const base = 60 + (s.core.shMax * 0.20);
      return Math.floor(base * (1 + 0.01*W) * passiveMul(s));
    },

    // Core armor upgrade levels map to absolute armor values via CFG.coreUpg.armorSteps.
    // We store upgrade levels (armorHpLv/armorShLv) on the core state and convert them
    // to a delta relative to the base armor (steps[0]).
    coreArmorBonus(lv){
      const steps = (CFG.coreUpg && Array.isArray(CFG.coreUpg.armorSteps)) ? CFG.coreUpg.armorSteps : null;
      const base = steps && steps.length ? (steps[0] ?? 0) : (CFG.core.armorHP||0);
      const idx = clamp((lv|0), 0, (steps && steps.length) ? (steps.length-1) : 0);
      const abs = steps && steps.length ? (steps[idx] ?? base) : base;
      return abs - base;
    },

    // Core has baseline flat armor (applies always), plus optional "rebuild" passive scaling armor.
    getArmorHP(s){
      let a = (CFG.core.armorHP||0) + Sim.coreArmorBonus(s.core.armorHpLv||0);
      if (s.passives.selected==="rebuild") a += CFG.rebuild.maxArmorHP * Sim.act70to10(s) * passiveMul(s);
      return a;
    },
    getArmorSH(s){
      let a = (CFG.core.armorSH||0) + Sim.coreArmorBonus(s.core.armorShLv||0);
      if (s.passives.selected==="rebuild") a += CFG.rebuild.maxArmorSH * Sim.act70to10(s) * passiveMul(s);
      return a;
    },


    applyWallThorns(s, raw, src, wCfg){
      try{
        if (!raw || raw<=0) return;
        if (!wCfg || (wCfg.finalThornsPct||0)<=0) return;

        // Determine attacker (enemy or projectile owner).
        let attacker = null;
        if (src){
          if (src.type==="bomberExplode") return; // environment
          if (src.type==="contact" && src.enemy) attacker = src.enemy;
          else if (src.type==="projectile" && src.proj){
            const p = src.proj;
            // Exclude meteor / environment impacts
            if (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact") return;
            attacker = p.owner || null;
          }
        }
        if (!attacker || attacker.hp<=0) return;

        const isBoss = !!attacker.isBoss;
        const wave = (s.game && s.game.waveIndex!=null) ? (s.game.waveIndex|0) : 0;

        let mult = (wCfg.finalThornsPct||0);
        if (isBoss){
          const eff = (wCfg.finalThornsBossEff!=null)?wCfg.finalThornsBossEff:0.55;
          mult *= eff;
        }

        const minBase = (wCfg.finalThornsMinBase||0);
        const minPerW = (wCfg.finalThornsMinPerWave||0);
        const minDmg = minBase + wave*minPerW;

        let dmg = raw * mult;
        if (minDmg>0) dmg = Math.max(dmg, minDmg);

        // Per-hit cap
        const hitCap = isBoss ? (wCfg.finalThornsHitCapBoss||wCfg.finalThornsHitCap||0) : (wCfg.finalThornsHitCap||0);
        if (hitCap>0) dmg = Math.min(dmg, hitCap);

        dmg = Math.round(dmg);
        if (dmg<1) return;

        // Per-second cap (tracked separately for boss / normal)
        const W = (s.skill && s.skill.wall) ? s.skill.wall : null;
        const nowSec = Math.floor((s.game && s.game.time!=null) ? s.game.time : 0);
        if (W){
          if ((W.thornsSecKey|0) !== nowSec){
            W.thornsSecKey = nowSec;
            W.thornsSpentBoss = 0;
            W.thornsSpentNormal = 0;
          }
          const secCap = isBoss ? (wCfg.finalThornsSecCapBoss||wCfg.finalThornsSecCap||0) : (wCfg.finalThornsSecCap||0);
          if (secCap>0){
            const spent = isBoss ? (W.thornsSpentBoss||0) : (W.thornsSpentNormal||0);
            let rem = Math.floor(secCap - spent);
            if (rem<=0) return;
            if (dmg>rem) dmg = rem;
            if (isBoss) W.thornsSpentBoss = spent + dmg;
            else W.thornsSpentNormal = spent + dmg;
          }
        }

        Sim.damageEnemy(s, attacker, dmg, "wallThorns");

        // Optional splash: 30% of reflected damage to nearby enemies
        const spPct = (wCfg.finalThornsSplashPct||0);
        const spR = (wCfg.finalThornsSplashR||0);
        if (spPct>0 && spR>0){
          const spDmg = dmg * spPct;
          if (spDmg>=1){
            for (const e of s.entities.enemies){
              if (!e || e===attacker || e.hp<=0) continue;
              if (dist(attacker.x, attacker.y, e.x, e.y) <= (spR + e.r)){
                Sim.damageEnemy(s, e, spDmg, "wallThornsSplash");
              }
            }
          }
        }

        // Visual / feedback on attacker
        s.entities.fx.push({type:"wallReflect", x:attacker.x, y:attacker.y, r:(wCfg.finalThornsSplashR||160), t:0.35});
        AudioSys.sfx("wallBlock", 0.85);
        addShake(s, 3, 0.08);
      } catch(_){ }
    },

    damageCore(s, raw, src){
      s.core.lastHitAt=s.game.time;

      // CHEAT: god mode (ignore damage)
      if (raw>0 && s.cheat && s.cheat.god){
        // tiny feedback so hits still feel responsive
        s.entities.fx.push({type:"coreFlash", x:s.core.x, y:s.core.y, t:0.10});
        return;
      }

      // 부활 무적
      if (raw>0 && (s.core.rebirthInvulT||0)>0){
        s.entities.fx.push({type:"wallBlock", x:s.core.x, y:s.core.y, t:0.14});
        return;
      }

      // 방벽(Q): 1초 무적 (데미지만 차단, 디스럽터의 차단(수리/재생 차단)은 별도 처리라 그대로 적용됨)
      if (raw>0 && s.skill && s.skill.wall && (s.skill.wall.active||0)>0){
        const wCfg = Sim.getWallCfg(s);
        if ((wCfg.finalThornsPct||0) > 0){
          Sim.applyWallThorns(s, raw, src, wCfg);
        }
        s.entities.fx.push({type:"wallBlock", x:s.core.x, y:s.core.y, t:0.22});
        AudioSys.sfx("wallBlock");
        return;
      }
      // rebuild passive: low-HP DR and emergency fortify
      if (raw>0 && s.passives.selected==="rebuild"){
        const hpPct=Sim.getHpPct(s);
        if (hpPct<=0.70){
          const t=Sim.act70to10(s);
          const dr=(0.10 + 0.02*t) * passiveMul(s); // 10% -> 12%
          raw *= (1 - dr);
        }
        const RB=s.passives.rebuild;
        if (RB && (RB.emergencyT||0)>0){ raw *= (1 - 0.38*passiveMul(s)); }
      }

      const hpBefore = s.core.hp;
      const shBefore = s.core.sh;
      let remaining=raw, appliedTotal=0;
      const armorSh=Sim.getArmorSH(s), armorHp=Sim.getArmorHP(s);

      // Event: some portion of incoming damage can bypass shield and hit HP directly
      const _ev = Sim.eventInWave(s);
      const _piercePct = (_ev && _ev.mods && typeof _ev.mods.shieldPiercePct === "number") ? _ev.mods.shieldPiercePct : 0;
      let _pierceRaw = 0;
      if (_piercePct>0 && raw>0){
        _pierceRaw = raw * clamp(_piercePct, 0, 0.95);
        remaining = raw - _pierceRaw;
      }

      if (s.core.sh>0 && remaining>0){
        const dmgToSh=Math.max(0, remaining-armorSh);
        const applied=Math.min(s.core.sh, dmgToSh);
        s.core.sh-=applied;
        remaining-=applied;
        appliedTotal+=applied;
        if (s.core.sh<=0.0001){ s.core.sh=0; s.core.shRegenLock=CFG.core.shRegenDelayOnBreak; }
      }
      if (remaining>0){
        const dmgToHp=Math.max(0, remaining-armorHp);
        const applied=Math.min(s.core.hp, dmgToHp);
        s.core.hp-=applied;
        appliedTotal+=applied;
      }

      // apply shield-bypass portion to HP (after shield handling)
      if (_pierceRaw>0 && s.core.hp>0){
        const dmgToHp=Math.max(0, _pierceRaw-armorHp);
        const applied=Math.min(s.core.hp, dmgToHp);
        s.core.hp-=applied;
        appliedTotal+=applied;
      }

      if (appliedTotal<CFG.core.hitMinDamage && raw>0){
        const need=CFG.core.hitMinDamage-appliedTotal;
        if (s.core.sh>0){
          const applied=Math.min(s.core.sh, need);
          s.core.sh-=applied; appliedTotal+=applied;
          if (s.core.sh<=0.0001){ s.core.sh=0; s.core.shRegenLock=CFG.core.shRegenDelayOnBreak; }
        } else {
          const applied=Math.min(s.core.hp, need);
          s.core.hp-=applied; appliedTotal+=applied;
        }
      }
      const shDamaged = (s.core.sh < shBefore-0.0001);
      const shBroken = (shBefore>0 && s.core.sh<=0.0001);
      if (shBroken && s.passives.selected==="rebuild"){
        const RB=s.passives.rebuild;
        if (RB && (RB.emergencyCd||0)<=0){
          RB.emergencyT = 1.0;
          RB.emergencyCd = 7.0;
          s.entities.fx.push({type:"rebuildEmergency", x:s.core.x, y:s.core.y, t:0.55});
        }
      }
      const hpDamaged = (s.core.hp < hpBefore-0.0001);
      if (shDamaged && !shBroken) AudioSys.sfx("shieldHit");
      if (shBroken) AudioSys.sfx("shieldBreak");
      if (raw>0 && (shBroken || hpDamaged)) AudioSys.sfx("hit");
      if (s.game.phase==="wave" && s.core.hp < hpBefore-0.0001){ s._waveHpDamaged = true; }
      if (appliedTotal>0){
        s.entities.fx.push({type:"coreHit", x:s.core.x, y:s.core.y, t:0.12});
    // no shake on collapse (requested)
    if (s.camera){ s.camera.shakeT = 0; s.camera.shakeMag = 0; }
}
      if (s.passives.selected==="resonance"){
        {
        const _evR = Sim.eventInWave(s);
        const _gMul = (_evR && _evR.mods && typeof _evR.mods.resonanceGainMul === "number") ? _evR.mods.resonanceGainMul : 1.0;
        s.passives.resonance.gauge = clamp(s.passives.resonance.gauge + appliedTotal*CFG.resonance.gainPerDamage*_gMul*passiveMul(s), 0, CFG.resonance.max);
      }
      }
      if (s.core.hp<=0.0001){
        s.core.hp=0;
        if (s.passives.rebirthSelected && !s.passives.rebirthUsed) triggerRewind(s);
        else triggerGameOver(s);
      }
    },

    spawnEnemy(s, kind="normal"){
      const diff=CFG.difficulty[s.game.difficulty];
      const baseHp=CFG.enemy.baseHp*diff.enemyHpMul;
      const baseSpeed=CFG.enemy.baseSpeed*diff.enemySpeedMul;

      const W = Math.max(1, s.game.waveIndex);
      const isBoss=(kind==="boss");
      const isFinalBoss = isBoss && (W===30);

      // === Wave scaling (recommended: light exponential) ===
      // Applies to non-boss enemies only. Bosses already have dedicated scaling.
      const _wPow = Math.max(0, W-1);
      const _waveHpMul  = Math.pow(1.04,  _wPow);
      const _waveDmgMul = Math.pow(1.02,  _wPow);
      const _waveSpdMul = Math.min(1.20, Math.pow(1.005, _wPow));

      // enemy type presets
      let hpMul=1.0, spdMul=1.0, r=CFG.enemy.radius, reward=3, armor=0, color="rgb(210,210,220)", shape="circle";
      let aoeResist=0;
      let meteorDelay=0, meteorDmg=0;
      let auraEvery=0, auraRadius=0, auraT=0;
      let tempSh=0, tempShMax=0;
      let isSplitChild=false;
      if (kind==="fast"){ hpMul=0.78; spdMul=1.38; r=12; reward=3; color="rgb(120,220,210)"; shape="diamond"; }
      if (kind==="tank"){ hpMul=2.05; spdMul=0.82; r=18; reward=5; armor=1.5; color="rgb(255,170,90)"; shape="hex"; }
      if (kind==="elite"){ hpMul=1.35; spdMul=1.08; r=16; reward=7; armor=0.8; color="rgb(190,140,255)"; shape="ring"; }

      // new enemy kinds
      if (kind==="ranged"){ hpMul=1.05; spdMul=0.95; r=15; reward=6; armor=0.4; color="rgb(255,230,140)"; shape="ranged"; }
      if (kind==="bomber"){ hpMul=0.95; spdMul=1.22; r=13; reward=6; armor=0.0; color="rgb(255,120,170)"; shape="bomber"; }
      if (kind==="disruptor"){ hpMul=1.15; spdMul=0.92; r=15; reward=7; armor=0.6; color="rgb(170,255,170)"; shape="disruptor"; }
      // additional enemies (v0.47+)
      if (kind==="supporter"){ hpMul=1.10; spdMul=0.95; r=16; reward=6; armor=0.4; color="rgb(90,190,254)"; shape="supporter"; auraEvery=2.0; auraRadius=180; auraT=randRange(0.0, 2.0); }
      if (kind==="splitter"){   hpMul=1.05; spdMul=1.02; r=16; reward=5; armor=0.2; color="rgb(170,170,255)"; shape="splitter"; }
      if (kind==="splitling"){  hpMul=0.35; spdMul=1.20; r=11; reward=3; armor=0.0; color="rgb(140,140,255)"; shape="splitling"; isSplitChild=true; }
      if (kind==="sniper"){     hpMul=0.65; spdMul=0.82; r=14; reward=8; armor=0.2; color="rgb(255,210,110)"; shape="sniper"; }
      if (kind==="leech"){      hpMul=0.55; spdMul=1.65; r=12; reward=5; armor=0.0; color="rgb(190,110,255)"; shape="leech"; }
      if (kind==="armored"){    hpMul=1.75; spdMul=0.85; r=19; reward=9; armor=1.8; color="rgb(200,210,220)"; shape="armored"; aoeResist=0.60; }
      if (kind==="meteor"){     hpMul=1.20; spdMul=0.92; r=17; reward=10; armor=0.9; color="rgb(255,120,70)"; shape="meteor"; meteorDelay=(CFG.meteor&&CFG.meteor.delaySec!=null)?CFG.meteor.delaySec:8.0; meteorDmg=(CFG.meteor&&CFG.meteor.damage!=null)?CFG.meteor.damage:280; }



      if (isBoss){
        // Bosses: much tankier + ranged projectiles
        hpMul = diff.bossHpMul; // (kept for consistency; hp is overridden below)
        // Final boss is much faster than normal boss (×1.5)
        spdMul = isFinalBoss ? (0.92*1.5) : 0.92;
        r = isFinalBoss ? 26 : 24;
        reward = 25;
        armor = isFinalBoss ? 1.4 : 1.2;
        color = "rgb(255,140,100)";
        shape = "boss";
      }

      const a=randRange(-Math.PI, Math.PI);
      const spawnR=Math.max(CFG.LOGICAL_W, CFG.LOGICAL_H)*0.52;
      const x=s.core.x+Math.cos(a)*spawnR;
      const y=s.core.y+Math.sin(a)*spawnR;

      let rewardCalc = 0;
      const _baseNormal = 8 + Math.floor(W/2);
      const _baseRanged = 14 + Math.floor(W*0.7);
      const _baseTank   = 16 + 1*W;
      if (isBoss) rewardCalc = 300 + 12*W;
      else if (kind==="elite") rewardCalc = 40 + 2*W;
      else if (kind==="disruptor") rewardCalc = 26 + 2*W;
      else if (kind==="supporter") rewardCalc = Math.round(_baseNormal * 1.50);
      else if (kind==="sniper") rewardCalc = Math.round(_baseRanged * 1.80);
      else if (kind==="armored") rewardCalc = Math.round(_baseTank * 1.80);
      else if (kind==="meteor") rewardCalc = Math.round(_baseNormal * 2.20);
      else if (kind==="tank") rewardCalc = _baseTank;
      else if (kind==="bomber") rewardCalc = 18 + 1*W;
      else if (kind==="ranged") rewardCalc = _baseRanged;
      else if (kind==="splitling") rewardCalc = Math.max(1, Math.floor(_baseNormal * 0.50));
      else rewardCalc = _baseNormal;
      if (s.game.difficulty==="hard") rewardCalc = Math.round(rewardCalc * 1.10);

      // attach special ai parameters
      let shootCd = 0;
      let keepDist = 0;
      let shootRange = 0;
      let shotsPerSec = 0;
      let projSpeed = 0;
      let projDmg = 0;
      let shLockSec = 0;
      let repairLockSec = 0;
      let explodeRadius = 0;
      let explodeTriggerDist = 0;
      let explodeTurretDmg = 0;
      let explodeCoreDmg = 0;

      if (kind==="ranged" || kind==="disruptor" || kind==="sniper"){
        const cfg = (CFG.enemySpecial && CFG.enemySpecial[kind]) ? CFG.enemySpecial[kind] : null;
        keepDist = cfg?.keepDist ?? 320;
        shootRange = cfg?.range ?? 520;
        shotsPerSec = cfg?.shotsPerSec ?? 0.8;
        projSpeed = cfg?.projSpeed ?? 620;
        projDmg = cfg?.projDmg ?? 10;
        shLockSec = cfg?.shLockSec ?? 0;
        repairLockSec = cfg?.repairLockSec ?? 0;
        shootCd = randRange(0.10, 0.90) * (1/Math.max(0.1, shotsPerSec));
      }

      if (kind==="boss"){
        const cfg = (CFG.enemySpecial) ? (isFinalBoss ? CFG.enemySpecial.finalBoss : CFG.enemySpecial.boss) : null;
        keepDist = cfg?.keepDist ?? (isFinalBoss ? 340 : 300);
        shootRange = cfg?.range ?? (isFinalBoss ? 820 : 720);
        shotsPerSec = cfg?.shotsPerSec ?? (isFinalBoss ? 1.15 : 0.95);
        projSpeed = cfg?.projSpeed ?? (isFinalBoss ? 780 : 720);
        // projectile damage scales with wave (bosses should feel dangerous)
        projDmg = (cfg?.projDmg ?? (isFinalBoss ? 22 : 16)) + W*0.35;
        shootCd = randRange(0.10, 0.90) * (1/Math.max(0.1, shotsPerSec));
      }

      if (kind==="bomber"){
        const cfg = (CFG.enemySpecial && CFG.enemySpecial.bomber) ? CFG.enemySpecial.bomber : null;
        explodeRadius = cfg?.explodeRadius ?? 140;
        explodeTriggerDist = cfg?.triggerDist ?? 40;
        explodeTurretDmg = cfg?.turretDmg ?? 110;
        explodeCoreDmg = cfg?.coreDmg ??  110;
      }

      // HP scaling (bosses are much tankier and scale by wave)
      let hpMax = baseHp*hpMul;
      if (isBoss){
        const bossScale = (20 + W*2.2);
        const scale = isFinalBoss ? (bossScale*2.0) : bossScale;
        hpMax = baseHp * diff.bossHpMul * scale;
      }

      // Wave scaling for non-boss enemies
      if (!isBoss){
        hpMax *= _waveHpMul;
        // Scale non-boss special attack damages with wave too
        projDmg *= _waveDmgMul;
        explodeTurretDmg *= _waveDmgMul;
        explodeCoreDmg *= _waveDmgMul;
        meteorDmg *= _waveDmgMul;
      }

      const moveSpeed = (baseSpeed*spdMul) * (!isBoss ? _waveSpdMul : 1.0);
      let contactDmg = CFG.enemy.dmgOnHit;
      if (isBoss) contactDmg *= (isFinalBoss?1.8:1.7);
      else contactDmg *= _waveDmgMul;

      s.entities.enemies.push({
        kind, shape, color,
        reward: rewardCalc,
        x,y, r,
        hpMax:hpMax, hp:hpMax,
        speed: moveSpeed,
        dmg: contactDmg,
        armor,
        hitT:0,
        isBoss,
        isFinalBoss,
        // Final boss bonus is handled during Overload Burst (no baseline turret resistance)
        turretResist:0,
        mark:0, markT:0, slowT:0, slowMul:1,
        tempSh, tempShMax,
        aoeResist,
        auraEvery, auraRadius, auraT,
        isSplitChild,
        meteorDelay, meteorDmg, meteorT:0, meteorFired:false,
        dead:false, deathT:0,
        hitFlash:0,

        // final boss pattern state
        fbPhase: isFinalBoss ? 1 : 0,
        fbInvT: 0,
        fbTransT: 0,
        fbLaserCd: isFinalBoss ? randRange(4.5, 6.5) : 0,
        fbLaserTele: 0,
        fbLaserFire: 0,
        fbLaserAng: 0,
        fbZoneCd: isFinalBoss ? randRange(9.5, 12.5) : 0,
        fbZoneTele: 0,
        fbZoneT: 0,
        fbZoneR: 0,
        fbZoneTick: 0,
        fbShardCd: isFinalBoss ? randRange(7.5, 10.0) : 0,

        // special AI fields (0 for normal kinds)
        shootCd, keepDist, shootRange, shotsPerSec, projSpeed, projDmg,
        shLockSec, repairLockSec,
        explodeRadius, explodeTriggerDist, explodeTurretDmg, explodeCoreDmg
      });
    },


    turretUpgCost(type, toLv){
      const cfg = (CFG.turrets && CFG.turrets[type]) ? CFG.turrets[type] : (CFG.turrets ? CFG.turrets.basic : null);
      const C = cfg ? (cfg.cost||0) : 0;
      const mul = {2:0.75, 3:0.95, 4:1.20, 5:1.50};
      return Math.max(1, Math.floor(C * (mul[toLv]||0)));
    },

    bulkUpgradeTurrets(s, mode="lv", opts={}){
      const list = (s.entities.turrets||[]).filter(t=>t && !t.dead);
      const branchNeed = new Set();
      let upgraded=0, spent=0;

      const sortList=(arr)=>{
        const a = [...arr];
        if (mode==="cost"){
          a.sort((x,y)=>{
            const cx = (x.lv>=5 || (x.lv===2 && !x.path)) ? 1e18 : Sim.turretUpgCost(x.type, (x.lv||1)+1);
            const cy = (y.lv>=5 || (y.lv===2 && !y.path)) ? 1e18 : Sim.turretUpgCost(y.type, (y.lv||1)+1);
            if (cx!==cy) return cx-cy;
            return (x.id||0)-(y.id||0);
          });
        } else if (mode==="power"){
          a.sort((x,y)=>{
            const px = (x.dmg||0)*(x.shotsPerSec||0);
            const py = (y.dmg||0)*(y.shotsPerSec||0);
            if (px!==py) return py-px;
            return (x.id||0)-(y.id||0);
          });
        } else {
          // lv (default): lowest level first
          a.sort((x,y)=>{
            const lx=x.lv||1, ly=y.lv||1;
            if (lx!==ly) return lx-ly;
            return (x.id||0)-(y.id||0);
          });
        }
        return a;
      };

      let did=true;
      while(did){
        did=false;
        const a=sortList(list);
        for (const t of a){
          if (!t || t.dead) continue;
          const lv=t.lv||1;
          if (lv>=5) continue;
          if (lv===2 && !t.path){ branchNeed.add(t.id); continue; }
          const toLv=lv+1;
          const cost=Sim.turretUpgCost(t.type, toLv);
          if (s.resources.crystals < cost) continue;
          s.resources.crystals -= cost;
          spent += cost;
          t.spent = (t.spent||0) + cost;
          t.lv = toLv;
          Sim.applyTurretStats(t);
          upgraded += 1;
          did=true;
        }
      }
      return {upgraded, spent, branchNeed: branchNeed.size};
    },

    computeTurretStats(type, lv, path){
      const base = (CFG.turrets && CFG.turrets[type]) ? CFG.turrets[type] : (CFG.turrets ? CFG.turrets.basic : null);
      if (!base) return null;

      const L = clamp((lv|0), 1, 5);
      const n = Math.max(0, L-1);

      let range = base.range;
      let shotsPerSec = base.shotsPerSec;
      let dmg = base.dmg;
      let projSpeed = base.projSpeed;

      let splashPct = base.splashPct || 0;
      let splashR   = base.splashR || 0;

      let slowPct = base.slowPct || 0;
      let slowSec = base.slowSec || 0;
      let slowBossEff = (base.slowBossEff!=null) ? base.slowBossEff : 0.60;

      let extraSplashPct=0, extraSplashR=0;
      let slowAuraPct=0, slowAuraSec=0, slowAuraR=0;

      if (type==="basic"){
        dmg *= Math.pow(1.18, n);
        shotsPerSec *= Math.pow(1.10, n);
        range *= Math.pow(1.04, n);
        if (path==="A") dmg *= 1.25;        // 집중 강화
        if (path==="B") shotsPerSec *= 1.25; // 연사 강화
      } else if (type==="slow"){
        dmg *= Math.pow(1.10, n);
        shotsPerSec *= Math.pow(1.06, n);
        range *= Math.pow(1.02, n);
        slowPct = clamp((base.slowPct||0) + 0.04*n, 0, 0.75);
        slowSec = (base.slowSec||0) + 0.15*n;

        if (path==="A"){
          // 빙결확산: 작은 범위에 약한 둔화가 퍼짐
          slowAuraPct = slowPct*0.55;
          slowAuraSec = Math.max(0.6, slowSec*0.60);
          slowAuraR = 58 + 6*n;
        } else if (path==="B"){
          // 심층동결: 보스 둔화 효율 향상
          slowBossEff = Math.max(slowBossEff, 0.75);
        }
      } else if (type==="splash"){
        dmg *= Math.pow(1.14, n);
        shotsPerSec *= Math.pow(1.06, n);
        range *= Math.pow(1.03, n);
        splashR = (base.splashR||0) * Math.pow(1.08, n);

        if (path==="A"){
          // 파편탄: 범위 증가 + 바깥 링 추가
          splashR *= 1.20;
          extraSplashPct = 0.20;
          extraSplashR = splashR*1.45;
        } else if (path==="B"){
          // 중포격: 피해 강화 + 약간 더 큰 폭발 비율
          dmg *= 1.25;
          splashPct = Math.min(0.88, splashPct + 0.05*n);
        }
      }

      const critChance = clamp(((CFG.crit && CFG.crit.baseChance)!=null?CFG.crit.baseChance:0) + (L-1)*(((CFG.crit && CFG.crit.perLevelChance)!=null)?CFG.crit.perLevelChance:0), 0, ((CFG.crit && CFG.crit.maxChance)!=null?CFG.crit.maxChance:1));
      const critMult = ((CFG.crit && CFG.crit.mult)!=null?CFG.crit.mult:1.5);
      return { range, shotsPerSec, dmg, projSpeed, splashPct, splashR, slowPct, slowSec, slowBossEff, extraSplashPct, extraSplashR, slowAuraPct, slowAuraSec, slowAuraR, critChance, critMult };
    },

    applyTurretStats(t){
      const st = Sim.computeTurretStats(t.type, t.lv||1, t.path||null);
      if (!st) return;
      t.range = st.range;
      t.shotsPerSec = st.shotsPerSec;
      t.dmg = st.dmg;
      t.projSpeed = st.projSpeed;
      t.splashPct = st.splashPct;
      t.splashR = st.splashR;
      t.extraSplashPct = st.extraSplashPct;
      t.extraSplashR = st.extraSplashR;
      t.slowPct = st.slowPct;
      t.slowSec = st.slowSec;
      t.slowBossEff = st.slowBossEff;
      t.slowAuraPct = st.slowAuraPct;
      t.slowAuraSec = st.slowAuraSec;
      t.slowAuraR = st.slowAuraR;
      t.critChance = st.critChance;
      t.critMult = st.critMult;
    },

    pickTurretAt(s, x,y, pickR=26){
      return Sim.nearestTurret(s, x,y, pickR);
    },

    turretsInRadius(s, x,y, r){
      const out = [];
      const list = (s && s.entities && s.entities.turrets) ? s.entities.turrets : null;
      if (!list) return out;
      for (const t of list){
        if (!t || t.dead) continue;
        if (dist(t.x, t.y, x, y) <= r) out.push(t);
      }
      return out;
    },

    previewTurretRepairArea(s, x,y){
      const cfg = CFG.turretRepair || {};
      const r = (cfg.multiRadius!=null) ? cfg.multiRadius : 220;
      const maxN = (cfg.multiMax!=null) ? cfg.multiMax : 12;
      const near = Sim.turretsInRadius(s, x,y, r);
      const damaged = near.filter(t => t && !t.dead && (t.hpMax>0) && (t.hp < t.hpMax - 0.001));
      if (!damaged.length) return { any:false, damaged:0, eligible:0, totalCost:0, maxN };
      const eligibleList = damaged.filter(t => (t.repairCd||0) <= 0);
      eligibleList.sort((a,b)=>{
        const ma = 1 - (a.hp / (a.hpMax||1));
        const mb = 1 - (b.hp / (b.hpMax||1));
        return mb - ma;
      });
      const sel = eligibleList.slice(0, maxN);
      let total = 0;
      for (const t of sel) total += Sim.turretRepairCost(s, t);
      return { any:true, damaged:damaged.length, eligible:eligibleList.length, totalCost:Math.ceil(total), maxN };
    },

    tryRepairTurretsArea(s, x,y){
      const gcd = (s.ui && s.ui.turretRepairGlobalCd) ? s.ui.turretRepairGlobalCd : 0;
      if (gcd>0) return {ok:false, reason:"gcd", t:gcd};
      const cfg = CFG.turretRepair || {};
      const r = (cfg.multiRadius!=null) ? cfg.multiRadius : 220;
      const maxN = (cfg.multiMax!=null) ? cfg.multiMax : 12;

      const list = Sim.turretsInRadius(s, x,y, r).filter(t => t && !t.dead && (t.hpMax>0) && (t.hp < t.hpMax - 0.001));
      if (!list.length) return {ok:false, reason:"none"};

      // prioritize most damaged first
      list.sort((a,b)=>{
        const ma = 1 - (a.hp / (a.hpMax||1));
        const mb = 1 - (b.hp / (b.hpMax||1));
        return mb - ma;
      });

      let spent = 0, count = 0, anyEligible = 0;
      let minCost = Infinity;

      for (const t of list){
        if (count >= maxN) break;
        if ((t.repairCd||0) > 0) continue;
        anyEligible++;
        const cost = Sim.turretRepairCost(s, t);
        if (cost>0) minCost = Math.min(minCost, cost);
        if (cost>0 && s.resources.crystals >= cost){
          s.resources.crystals -= cost;
          spent += cost;
          count++;
          t.hp = t.hpMax;
          t.hitFlash = Math.max(t.hitFlash||0, 0.18);
          t.repairCd = (cfg.perTurretCd!=null) ? cfg.perTurretCd : 6.0;

          // small VFX ring
          if (s.entities && s.entities.fx){
            s.entities.fx.push({type:"shBlock", x:t.x, y:t.y, t:0.14});
          }
        }
      }

      if (count>0){
        if (s.ui) s.ui.turretRepairGlobalCd = (cfg.globalCd!=null) ? cfg.globalCd : 0.4;
        return {ok:true, count, spent};
      }
      if (anyEligible<=0) return {ok:false, reason:"tcd"};
      if (!isFinite(minCost)) minCost = 0;
      return {ok:false, reason:"cost", cost:minCost};
    },

    turretRepairCost(s, t){
      if (!t || t.dead || !(t.hpMax>0)) return 0;
      const cfg = CFG.turretRepair || {};
      const cmin = (cfg.cmin!=null) ? cfg.cmin : 6;
      const cmax = (cfg.cmax!=null) ? cfg.cmax : 28;
      const pow  = (cfg.pow!=null)  ? cfg.pow  : 1.4;
      const missing = clamp(1 - (t.hp / t.hpMax), 0, 1);
      if (missing <= 0.0001) return 0;
      return Math.ceil(cmin + (cmax - cmin) * Math.pow(missing, pow));
    },

    tryRepairTurret(s, t){
      if (!t || t.dead) return {ok:false, reason:"dead"};
      const gcd = (s.ui && s.ui.turretRepairGlobalCd) ? s.ui.turretRepairGlobalCd : 0;
      if (gcd>0) return {ok:false, reason:"gcd", t:gcd};
      const tcd = t.repairCd || 0;
      if (tcd>0) return {ok:false, reason:"tcd", t:tcd};
      if (!(t.hpMax>0) || (t.hp>=t.hpMax-0.001)) return {ok:false, reason:"full"};
      const cost = Sim.turretRepairCost(s, t);
      if (cost<=0) return {ok:false, reason:"full"};
      if (s.resources.crystals < cost) return {ok:false, reason:"cost", cost};
      s.resources.crystals -= cost;
      t.hp = t.hpMax;
      t.hitFlash = Math.max(t.hitFlash||0, 0.18);
      t.repairCd = (CFG.turretRepair && CFG.turretRepair.perTurretCd!=null) ? CFG.turretRepair.perTurretCd : 6.0;
      if (s.ui) s.ui.turretRepairGlobalCd = (CFG.turretRepair && CFG.turretRepair.globalCd!=null) ? CFG.turretRepair.globalCd : 0.4;

      // small VFX ring
      if (s.entities && s.entities.fx){
        s.entities.fx.push({type:"shBlock", x:t.x, y:t.y, t:0.14});
      }
      return {ok:true, cost};
    },

    placeTurret(s, x, y, type="basic"){
      // Placement: prevent overlaps + enforce core exclusion radius.
      Sim._placeFail = null;
      const cfg = (CFG.turrets && CFG.turrets[type]) ? CFG.turrets[type] : (CFG.turrets ? CFG.turrets.basic : null);
      if (!cfg){ Sim._placeFail = "cfg"; return false; }
      const cost = cfg.cost;

      const minCore = (CFG.turret && CFG.turret.minDistFromCore!=null) ? CFG.turret.minDistFromCore : 180;
      if (dist(x,y,s.core.x,s.core.y) <= minCore){
        Sim._placeFail = "core";
        return false;
      }

      const minTur = (CFG.turret && CFG.turret.minDistBetweenTurrets!=null) ? CFG.turret.minDistBetweenTurrets : 72;
      for (const tt of s.entities.turrets){
        if (tt.dead) continue;
        if (dist(x,y,tt.x,tt.y) < minTur){
          Sim._placeFail = "overlap";
          return false;
        }
      }

      if (s.resources.crystals < cost){ Sim._placeFail = "cost"; return false; }
      s.resources.crystals -= cost;

      const nosplash = (type!=="splash"); // overload burst explosion only applies to non-splash turrets
      const hpMax = (CFG.turretHP && CFG.turretHP[type]) ? CFG.turretHP[type] : 150;

      const id = (s.entities.nextTurretId!=null) ? (s.entities.nextTurretId++) : ((s.entities.nextTurretId=2),1);

      const t = {
        id,
        type,
        x, y,
        lv: 1,
        path: null,
        baseCost: cost,
        spent: cost,

        range: cfg.range,
        shotsPerSec: cfg.shotsPerSec,
        dmg: cfg.dmg,
        projSpeed: cfg.projSpeed,
        splashPct: cfg.splashPct,
        splashR: cfg.splashR,
        slowPct: cfg.slowPct,
        slowSec: cfg.slowSec,
        slowBossEff: cfg.slowBossEff,
        extraSplashPct: 0,
        extraSplashR: 0,
        slowAuraPct: 0,
        slowAuraSec: 0,
        slowAuraR: 0,

        cd:0,
        nosplash,
        aimX:x, aimY:y,
        hpMax, hp: hpMax,
        dead:false,
        hitFlash:0,
        overheatT:0,
        repairCd:0
      };
      Sim.applyTurretStats(t);
      s.entities.turrets.push(t);
      return true;
    },

    nearestTurret(s, x,y, range=1e9){
      let best=null, bestD=1e18;
      for (const t of s.entities.turrets){
        if (t.dead) continue;
        const d=dist(x,y,t.x,t.y);
        if (d<=range && d<bestD){ bestD=d; best=t; }
      }
      return best;
    },

    damageTurret(s, t, raw, src=""){
      if (!t || t.dead) return;
      const dmg = Math.max(1, raw);
      t.hp -= dmg;
      t.hitFlash = 0.12;
      AudioSys.sfx("turretHit");
      if (t.hp<=0){
        t.hp=0; t.dead=true;
        s.entities.fx.push({type:"turretBreak", x:t.x, y:t.y, t:0.35});
        AudioSys.sfx("turretBreak");
      }
    },

    fireProj(s, x,y, tx,ty, dmg, speed, pierce, splashPct, splashR, from, opts={}){
      const dx=tx-x, dy=ty-y, len=Math.hypot(dx,dy)||1;
      s.entities.projectiles.push({ x,y, vx:dx/len*speed, vy:dy/len*speed, dmg, r:4, pierce, splashPct, splashR, life:2.2, from, ...opts });
    },

    // Find nearest living enemy within range.
    // Optional 'skip' excludes a specific enemy (useful to avoid double-hit patterns).
    nearestEnemy(s, x,y, range, skip=null){
      let best=null, bestD=1e18;
      for (const e of s.entities.enemies){
        if (e.hp<=0) continue;
        if (skip && e===skip) continue;
        const d=dist(x,y,e.x,e.y);
        if (d<=range && d<bestD){ bestD=d; best=e; }
      }
      return best;
    },
    bossElseHighestHp(s){
      for (const e of s.entities.enemies){ if (e.hp>0 && e.isBoss) return e; }
      let best=null, bestHp=-1;
      for (const e of s.entities.enemies){
        if (e.hp>0 && e.hp>bestHp){ bestHp=e.hp; best=e; }
      }
      return best;
    },

    // Energy Cannon target selection.
    // Default: Boss -> Highest HP.
    // Special-case: Meteor Caller (kind=="meteor") can be prioritized when it's channeling and
    // close to completing the cast (urgent), so Energy Cannon can realistically prevent a meteor.
    // - If "urgent" (time left <= chargeSec + margin): override even boss.
    // - Otherwise: Boss -> Meteor channeler -> Highest HP.
    energyCannonTarget(s){
      const eCfg = Sim.getEnergyCfg(s);
      const chargeSec = (eCfg && eCfg.chargeSec!=null) ? eCfg.chargeSec : 3.0;
      const margin = (CFG.energyCannon && CFG.energyCannon.meteorUrgentMarginSec!=null) ? CFG.energyCannon.meteorUrgentMarginSec : 0.85;

      // 1) Meteor projectile (actual falling meteor) can be targeted to weaken its impact.
      // If a meteor is about to hit soon enough, prioritize it even over bosses.
      let bestMeteor=null, bestT=1e18;
      for (const p of s.entities.projectiles){
        if (!p || (p.life||0) <= 0) continue;
        const isMeteor = (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact");
        if (!isMeteor) continue;
        if (p.meteorWeakened) continue;
        const sp = Math.hypot(p.vx||0, p.vy||0) || 1;
        const tImpact = dist(p.x,p.y, s.core.x, s.core.y) / sp;
        if (tImpact < bestT){ bestT=tImpact; bestMeteor=p; }
      }
      if (bestMeteor && bestT <= (chargeSec + margin)) return bestMeteor;

      // 2) Boss first (default behavior)
      for (const e of s.entities.enemies){ if (e.hp>0 && e.isBoss) return e; }

      // 3) If there is an active meteor in the air (not urgent), target it next (counterplay option).
      if (bestMeteor) return bestMeteor;

      // 4) Highest HP
      let best=null, bestHp=-1;
      for (const e of s.entities.enemies){
        if (e.hp>0 && e.hp>bestHp){ bestHp=e.hp; best=e; }
      }
      return best;
    },

    highestHpEnemy(s){
      let best=null, bestHp=-1;
      for (const e of s.entities.enemies){
        if (e.hp>0 && e.hp>bestHp){ bestHp=e.hp; best=e; }
      }
      return best;
    },
    
    damageEnemy(s, e, dmg, src=""){
      if (!e || e.hp<=0) return;

      let dd = dmg;

      // Final boss phase transition invulnerability
      if (e.isFinalBoss && (e.fbInvT||0)>0){
        s.entities.fx.push({type:"shBlock", x:e.x, y:e.y, t:0.14});
        return;
      }

      // Armored: reduce AoE damage only (splash / resonance / energy AoE, etc.)
      if (src==="aoe" && e.aoeResist && e.aoeResist>0){
        dd *= (1 - clamp(e.aoeResist, 0, 0.95));
      }

      // Final boss: during Overload Burst, turrets deal +25% damage.
      if (src==="turret" && e.isFinalBoss){
        const burst = (s.passives.selected==="overload" && s.passives.overload && (s.passives.overload.burst||0)>0);
        if (burst) dd *= (1 + 0.25*passiveMul(s));
      }

      // Overload: mark stacks (max 5, 4s refresh) + marked target takes more turret damage
      if (src==="turret" && s.passives.selected==="overload"){
        const stacks = (e.mark||0);
        if (stacks>0){
          const per = e.isBoss ? 0.015 : 0.03;
          dd *= (1 + per*stacks*passiveMul(s));
        }
        e.mark = Math.min(CFG.overload.markMax, stacks + 1);
        e.markT = CFG.overload.markRefresh;
      }

      // Temporary shield layer (from Shield Supporter)
      if (e.tempSh && e.tempSh>0 && dd>0){
        const take = Math.min(e.tempSh, dd);
        e.tempSh -= take;
        dd -= take;
        e.hitFlash = 0.10;
        if (dd<=0){
          s.entities.fx.push({type:"shBlock", x:e.x, y:e.y, t:0.14});
          return;
        }
      }

      // optional flat armor for special types
      if (e.armor && e.armor>0){
        dd = Math.max(1, dd - e.armor);
      }

      e.hp -= dd;
      e.hitFlash = 0.10;
      if (e.hp<=0){
        e.hp = 0;
        if (!e.dead){
          e.dead=true;
          e.deathT = 0.35;

          // Splitter: spawn two small units on death (children do not split again)
          if (e.kind==="splitter" && !e.isSplitChild){
            const off = (e.r||16)*0.65;
            for (let i=0;i<2;i++){
              const a = randRange(-Math.PI, Math.PI);
              const cx = e.x + Math.cos(a)*off;
              const cy = e.y + Math.sin(a)*off;
              const hpMax = Math.max(1, (e.hpMax||1) * 0.35);
              s.entities.enemies.push({
                kind:"splitling", shape:"splitling", color:"rgb(140,140,255)",
                reward: Math.max(1, Math.floor(((e.reward!=null)?e.reward:0) * 0.50)),
                x:cx, y:cy, r:11,
                hpMax:hpMax, hp:hpMax,
                speed:(e.speed||CFG.enemy.baseSpeed) * 1.20,
                dmg:(e.dmg||CFG.enemy.dmgOnHit) * 0.85,
                armor:0,
                hitT:0,
                isBoss:false,
                isFinalBoss:false,
                mark:0, markT:0, slowT:0, slowMul:1,
                tempSh:0, tempShMax:0,
                aoeResist:0,
                auraEvery:0, auraRadius:0, auraT:0,
                isSplitChild:true,
                dead:false, deathT:0,
                hitFlash:0
              });
            }
          }

          // Final boss: remove summoned shards on death so the wave ends cleanly
          if (e.isFinalBoss){
            for (const other of s.entities.enemies){
              if (!other || other.hp<=0) continue;
              if (other.noReward || other.isFinalMinion){
                other.hp=0; other.dead=true; other.deathT=0.15;
              }
            }
          }


          let reward = (e.reward!=null)?e.reward:2;

          // summoned units (noReward) do not drop crystals
          if (e.noReward) reward = 0;


          // Event: bomber reward bonus
          const _ev = Sim.eventInWave(s);
          if (_ev && _ev.mods && e.kind==="bomber" && typeof _ev.mods.bomberRewardMul === "number"){
            reward *= _ev.mods.bomberRewardMul;
          }

          if (reward>0){
            const add = Math.max(1, Math.floor(reward * Sim.crystalGainMul(s)));
            s.resources.crystals += add;
            AudioSys.sfx("crystal", add>=60?1.5:1.0);
          }
          s.entities.fx.push({type:"kill", x:e.x, y:e.y, t:0.22});
        }
      }
    },


aoe(s, cx,cy, r, dmg, skip=null){
      for (const e of s.entities.enemies){
        if (e.hp<=0) continue;
        const d=dist(cx,cy,e.x,e.y);
        if (d<=r+e.r) Sim.damageEnemy(s, e, dmg, "aoe");
      }
    },

    ensureWave(s){
      const w=s.game.waveIndex;
      if (w<=0) return;
      if (!s._waveSpawn) s._waveSpawn={ remaining:0, timer:0, boss:false };
      const ws=s._waveSpawn;

      // initialize once per wave
      if (ws.remaining===0 && ws.timer===0 && !ws.boss){
        const isFinalWave = (w===30);
        const isBossWave  = (w%5===0);
        const isEventWave = (Sim.eventActive(s) && (w%3===0) && (w%5!==0) && (w!==30));

        ws.isFinalWave = isFinalWave;
        ws.isBossWave  = isBossWave;
        ws.isEventWave = isEventWave;

        // boss spawns after the mob pack
        ws.boss = isBossWave;

        const baseCount = isBossWave ? (10 + Math.floor(w*1.2))
                        : isEventWave ? (11 + Math.floor(w*1.7))
                        : (12 + Math.floor(w*1.8));

        ws.remaining = baseCount;
        ws.timer = 0.05;

        // Forced spawns for specific waves (new enemy types)
        ws.forcedKinds = [];
        if (isBossWave){
          if (w===30){
            ws.forcedKinds.push("supporter");
            ws.forcedKinds.push("sniper");
          } else {
            if (w>=7)  { const n = (Math.random()<0.5)?1:2; for (let i=0;i<n;i++) ws.forcedKinds.push("supporter"); }
            if (w>=15) { const n = 1 + Math.floor(Math.random()*3); for (let i=0;i<n;i++) ws.forcedKinds.push("sniper"); }
            if (w>=14) { const n = 1 + Math.floor(Math.random()*2); for (let i=0;i<n;i++) ws.forcedKinds.push("armored"); }
          }
        }
        // Meteor Caller per-wave cap
        ws.meteorSpawned = 0;
        ws.meteorCap = (w>=24 ? 2 : 1);
      }
    },

    updateStatus(s){
      const shLock=s.core.shRegenLock;
      const repLock=s.core.repairLock||0;
      const p=s.passives.selected;
      const waiting = (s.game.phase==="setup" || s.game.phase==="shop");
      if (!p){ s.ui.status="상태: 패시브 미선택 / 메뉴에서 선택 가능"; s.ui.status2=""; return; }

      if (p==="rebuild"){
        const act=Sim.act70to10(s);
        const bonusHp = (CFG.rebuild.maxArmorHP||0) * act;
        const bonusSh = (CFG.rebuild.maxArmorSH||0) * act;
        const tSince=s.game.time - s.core.lastHitAt;
        const ooc=Math.max(0, CFG.rebuild.oocDelay - tSince);
        const hpPct = Sim.getHpPct(s);
        const dr = (hpPct<=0.70) ? (0.10 + 0.02*act) : 0;
        const emT = (s.passives.rebuild && (s.passives.rebuild.emergencyT||0)>0) ? fmt1(s.passives.rebuild.emergencyT)+"s" : "-";
        // HUD passive line (detailed, one-line) — matches the original HUD style.
        s.ui.status=`재건: 활성도 ${Math.round(act*100)}% | 피해감소 ${Math.round(dr*100)}% | 긴급보호막 ${emT} | 추가 HP방어 +${fmt1(bonusHp)} | 추가 SH방어 +${fmt1(bonusSh)}`;
        if (waiting){
          s.ui.status2 = `대기 중: HP/SH 재생 없음 | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`;
        } else {
          s.ui.status2=(ooc>0)?`무피격 회복 대기: ${fmt1(ooc)}s | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`
            : `HP 자동 회복 중 | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`;
        }
      }

      if (p==="resonance"){
        const g=s.passives.resonance.gauge;
        const dmgB=(CFG.resonance.dmgBonusMax*passiveMul(s)*(g/CFG.resonance.max))*100;
        const aspB=(CFG.resonance.aspdBonusMax*passiveMul(s)*(g/CFG.resonance.max))*100;
        s.ui.status=`공명: 게이지 ${g.toFixed(0)}% | 포탑 피해 +${fmt1(dmgB)}% | 공속 +${fmt1(aspB)}%`;
        s.ui.status2=`100% 시 에너지 방출(AoE) | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`;
      }

      if (p==="overload"){
        const act=Sim.act30to10(s);
        const O=s.passives.overload;
        const dmgB=(CFG.overload.baseTurretDmgBonusMax*act*passiveMul(s))*100;
        const aspB=(CFG.overload.baseTurretAspdBonusMax*act*passiveMul(s))*100;
        const cd=O.cd>0?`${Math.ceil(O.cd)}s`:"READY";
        const burst=O.burst>0?`${fmt1(O.burst)}s`:"-";
        let bestMark=0; for (const e of s.entities.enemies) bestMark=Math.max(bestMark, e.mark|0);
        s.ui.status=`과부화: 활성도 ${Math.round(act*100)}% | 포탑 피해 +${fmt1(dmgB)}% | 공속 +${fmt1(aspB)}% | 쿨 ${cd}`;
        s.ui.status2=`버스트 ${burst} | HP 30%↓ 진입 시 발동 | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`;
      }

      if (p==="overdrive"){
        const act=Sim.act70to10(s);
        const dmgB=(CFG.overdrive.maxDmgBonus*act*passiveMul(s))*100;
        const aspB=(CFG.overdrive.maxAspdBonus*act*passiveMul(s))*100;
        s.ui.status=`오버드라이브: 활성도 ${Math.round(act*100)}% | 포탑 피해 +${fmt1(dmgB)}% | 공속 +${fmt1(aspB)}%`;
        s.ui.status2=`코어 자동 공격(상시) | 보호막 재생정지: ${shLock>0?fmt1(shLock)+'s':'-'} | 수리 차단: ${repLock>0?fmt1(repLock)+'s':'-'}`;
      }

      if (p==="rebirth"){
        s.ui.status = `부활: ${s.passives.rebirthUsed?"사용됨":"대기"} | 시간왜곡 ⏳+15% 유지`;
        s.ui.status2 = `발동 시 HP 45% / SH 25% / 무적 3.0초`;
      }
    },

    step(s, dt){
      if (!s.game.running || s.game.paused) return;
      const ds=dt*s.game.speed;

      // camera shake decay (was missing -> infinite shake)
      if (s.camera && s.camera.shakeT>0){
        s.camera.shakeT = Math.max(0, s.camera.shakeT - ds);
        if (s.camera.shakeT===0) s.camera.shakeMag = 0;
      }

      // turret repair global cooldown
      if (s.ui && (s.ui.turretRepairGlobalCd||0)>0){
        s.ui.turretRepairGlobalCd = Math.max(0, s.ui.turretRepairGlobalCd - ds);
      }

      s.game.time += ds;
      if (s.game.phase!=="menu") s.passives.locked=true;

      if ((s.core.rebirthInvulT||0)>0){
        s.core.rebirthInvulT = Math.max(0, (s.core.rebirthInvulT||0) - ds);
      }

      if (s.game.phase==="rewind"){
        s.game.rewindT = Math.min(s.game.rewindDur||1.6, (s.game.rewindT||0) + dt);
        if (s.game.rewindT >= (s.game.rewindDur||1.6)) finishRebirth(s);
        return;
      }

      // ENDING: stop all gameplay, play a short core sealing cinematic before the clear overlay.
      if (s.game.phase==="ending"){
        s.game.overT += ds;
        s.game.endingT = Math.max(0, (s.game.endingT||0) - ds);

        // let VFX decay while frozen
        for (const fx of s.entities.fx){
        // Keep meteor warning visuals synced with TimeWarp meteor slow.
        let dtFx = ds;
        if (fx.type==="meteorWarn" && s.skill && s.skill.timeWarp && (s.skill.timeWarp.active||0)>0){
          dtFx = ds * (1 - 0.35*twMul(s));
        }
        fx.t -= dtFx;
      }
        s.entities.fx = s.entities.fx.filter(fx=>fx.t>0);

        if ((s.game.endingT||0) <= 0.0001){
          s.game.phase = "clear";
          s.game.overT = 0;
          // Unlock Hard Mode after the player has seen an ending once.
          if (s.unlocks && !s.unlocks.hard){
            s.unlocks.hard = true;
            try{ localStorage.setItem("td_hard_unlocked","1"); }catch(_){ }
            UI.toast("하드 모드 해금!");
          }
          AudioSys.stopEnergyCharge();
          UI.applyGameOverVisibility();
        }
        return;
      }

      // GAMEOVER: stop all gameplay, keep shield at 0, only animate break/fx
      if (s.game.phase==="gameover" || s.game.phase==="clear"){
        s.game.overT += ds;

        // GAMEOVER: show core break and keep shield at 0
        if (s.game.phase==="gameover"){
          s.core.sh = 0;
          s.core.shRegenLock = 99999;
          updateCoreBreak(s, ds);
        }

        // let VFX decay while frozen
        for (const fx of s.entities.fx){
        // Keep meteor warning visuals synced with TimeWarp meteor slow.
        let dtFx = ds;
        if (fx.type==="meteorWarn" && s.skill && s.skill.timeWarp && (s.skill.timeWarp.active||0)>0){
          dtFx = ds * (1 - 0.35*twMul(s));
        }
        fx.t -= dtFx;
      }
        s.entities.fx = s.entities.fx.filter(fx=>fx.t>0);
        return;
      }


      const isWaiting = (s.game.phase==="setup" || s.game.phase==="shop");

      // AUTO turret upgrades (optional): run once when entering waiting time.
      if (s.ui && s.ui._prevWaiting==null) s.ui._prevWaiting = false;
      if (isWaiting && s.ui && !s.ui._prevWaiting){
        if (s.ui.turretAuto && s.ui.turretAuto.on){
          const mode = s.ui.turretAuto.mode || "lv";
          const res = Sim.bulkUpgradeTurrets(s, mode, {silent:true});
          if (res && (res.upgraded||0)>0){
            const b = res.branchNeed?` · 분기필요 ${res.branchNeed}`:"";
            UI.toast(`AUTO 전체 업글: +${res.upgraded}회 (-${res.spent})${b}`);
            AudioSys.sfx("buy", 0.8);
          }
        }
      }
      if (s.ui) s.ui._prevWaiting = isWaiting;

      // shield regen lock timer always ticks, but actual regen is disabled during waiting time
      if (s.core.shRegenLock>0){
        s.core.shRegenLock=Math.max(0, s.core.shRegenLock-ds);
      }
      // "repair" lock timer always ticks (used by disruptor enemies)
      if (s.core.repairLock>0){
        s.core.repairLock=Math.max(0, s.core.repairLock-ds);
      }

      // passive internal timers
      if (s.passives && s.passives.rebuild){
        s.passives.rebuild.emergencyT = Math.max(0, (s.passives.rebuild.emergencyT||0) - ds);
        s.passives.rebuild.emergencyCd = Math.max(0, (s.passives.rebuild.emergencyCd||0) - ds);
      }
      if (s.passives && s.passives.overload){
        s.passives.overload.chainExtIcd = Math.max(0, (s.passives.overload.chainExtIcd||0) - ds);
        s.passives.overload.chainEmergencyIcd = Math.max(0, (s.passives.overload.chainEmergencyIcd||0) - ds);
      }

      // ===== Regen (combat only) =====
      if (!isWaiting){
        if (s.core.shRegenLock<=0){
          {
          const _ev = Sim.eventInWave(s);
          const _mul = (_ev && _ev.mods && typeof _ev.mods.shRegenMul === "number") ? _ev.mods.shRegenMul : 1.0;
          const _rgUpg = CFG.coreShRegenUpg || { addPerSec:[0] };
          const _rgLv = clamp((s.core.shRegenLv||0),0,3);
          let _rg = (CFG.core.shRegenPerSec + (_rgUpg.addPerSec?.[_rgLv] ?? 0)) * _mul;
          if (s.passives.selected==="rebuild"){
            const _final = Sim.isFinalBattle(s);
            _rg *= (1 + 0.15 + (_final?0.10:0));
          }
          if (s.core.sh<s.core.shMax) s.core.sh=Math.min(s.core.shMax, s.core.sh + _rg*ds);
        }
        }

        // rebuild ooc regen (HP) - disabled during waiting time
        if (s.passives.selected==="rebuild" && (s.core.repairLock||0)<=0){
          const tSince=s.game.time - s.core.lastHitAt;
          const _final = Sim.isFinalBattle(s);
          const _delay = Math.max(1.0, CFG.rebuild.oocDelay - (_final?1.5:0));
          if (tSince>=_delay && s.core.hp>0 && s.core.hp<s.core.hpMax){
            const act=Sim.act70to10(s);
            const _rate = CFG.rebuild.oocRegenPerSec * (1 + 0.55*act);
            s.core.hp=Math.min(s.core.hpMax, s.core.hp + _rate*ds);
          }
        }
      }

      // resonance pulse
      if (s.passives.selected==="resonance"){
        const R=s.passives.resonance;
        R.pulseIcd=Math.max(0, R.pulseIcd-ds);
        if (R.gauge>=CFG.resonance.max && R.pulseIcd<=0){
          const pulseDmg = Sim.resonancePulseDamage(s);
          // Resonance pulse: make it meaningful vs ranged enemies by reaching their keep distance
          // and applying a small bonus multiplier.
          for (const e of s.entities.enemies){
            if (e.hp<=0) continue;
            const d=dist(s.core.x,s.core.y,e.x,e.y);
            if (d<=CFG.resonance.pulseRadius+e.r){
              let dmg=pulseDmg;
              if (e.kind==='ranged' || e.kind==='disruptor' || e.kind==='sniper') dmg*=CFG.resonance.rangedMul;
              Sim.damageEnemy(s, e, dmg, 'aoe');
            }
          }
          R.gauge=0; R.pulseIcd=CFG.resonance.pulseIcd;
          s.entities.fx.push({type:"pulse", x:s.core.x, y:s.core.y, t:0.35});
          AudioSys.sfx("resonance");
          addShake(s, 6, 0.20);
        }
      }

      // overload trigger
      if (s.passives.selected==="overload"){
        const O=s.passives.overload;
        const hpPct=Sim.getHpPct(s);
        O.cd=Math.max(0, O.cd-ds);
        O.burst=Math.max(0, O.burst-ds);
        if (O.lastHpPct>CFG.overload.activeOnEnterHpPct && hpPct<=CFG.overload.activeOnEnterHpPct && O.cd<=0){
          O.burst=CFG.overload.burstSec; O.cd=CFG.overload.cooldownSec;
          for (const e of s.entities.enemies){
            const d=dist(s.core.x,s.core.y,e.x,e.y);
            if (d<=260){
              e.slowT=CFG.overload.slowSec; e.slowMul=0.55;
              const dx=(e.x-s.core.x)/(d||1), dy=(e.y-s.core.y)/(d||1);
              e.x+=dx*26; e.y+=dy*26;
            }
          }
          s.entities.fx.push({type:"shock", x:s.core.x, y:s.core.y, t:0.5});
          addShake(s, 5, 0.18);
        }
        O.lastHpPct=hpPct;
      }

      // overdrive core auto attack (max at 10%)
      if (s.passives.selected==="overdrive"){
        const a=Sim.act100to10(s);
        const dmgMul=1 + CFG.overdrive.maxDmgBonus*a*passiveMul(s);
        const aspdMul=1 + CFG.overdrive.maxAspdBonus*a*passiveMul(s);
        const sps=CFG.overdrive.baseShotsPerSec*aspdMul*passiveMul(s);
        s.passives.overdrive.shotCd -= ds;
        if (s.passives.overdrive.shotCd<=0){
          const target=Sim.nearestEnemy(s, s.core.x, s.core.y, CFG.overdrive.range);
          if (target){
            Sim.fireProj(s, s.core.x, s.core.y, target.x, target.y, CFG.overdrive.baseDmg*dmgMul*passiveMul(s), 920, 0, 0, 0, "core");
            AudioSys.sfx("overdriveShot");
            s.passives.overdrive.shotCd = 1/Math.max(0.1, sps);
          } else s.passives.overdrive.shotCd=0.12;
        }
      }

// repair / emergency cooldowns don't tick during setup/shop/clear/gameover (only during wave)
if (s.game.phase==="wave"){
  if (s.core.repairCd>0) s.core.repairCd=Math.max(0, s.core.repairCd-ds);
  if (s.core.emergencyCd>0) s.core.emergencyCd=Math.max(0, s.core.emergencyCd-ds);
}


// wall / time warp (combat only)
const W=s.skill.wall, TW=s.skill.timeWarp;
let skillCdMul = 1.0;
let tCfgLive = null;
if (s.game.phase==="wave"){
  // Final time-warp upgrade: speed up skill cooldown recovery while active.
  tCfgLive = Sim.getTimeWarpCfg(s);
  if (TW && (TW.active||0)>0 && (tCfgLive.finalCdBoost||0)>0){
    skillCdMul = 1.0 + tCfgLive.finalCdBoost;
  }

  const dsCd = ds * skillCdMul;

  if (W.cd>0) W.cd=Math.max(0, W.cd-dsCd);

  const prevW = W.active||0;
  if (W.active>0) W.active=Math.max(0, W.active-ds);
  // Wall final upgrade: clear transient trackers on end
  if (prevW>0 && (W.active||0)<=0.0001){
    W.thornsSecKey = -1;
    W.thornsSpentBoss = 0;
    W.thornsSpentNormal = 0;
  }

  if (TW.cd>0) TW.cd=Math.max(0, TW.cd-dsCd);
  if (TW.active>0) TW.active=Math.max(0, TW.active-ds);
} else {
  // skills should not persist into shop/setup
  if (W.active>0) W.active=0;
  if (TW.active>0) TW.active=0;
  // cooldown boost is combat only
  skillCdMul = 1.0;
}

// energy cannon
const sk=s.skill.energyCannon;

// cooldown doesn't tick during setup/shop/clear/gameover (only during wave)
if (s.game.phase==="wave" && sk.cd>0 && !sk.charging) sk.cd=Math.max(0, sk.cd-(ds*skillCdMul));

if (sk.charging){
  // Keep a target while charging; if current target died or disappeared, retarget.
  const tgtEnemyOk = sk.target && sk.target.hp>0 && s.entities.enemies.includes(sk.target);
  const tgtProjOk  = sk.target && (sk.target.life||0)>0 && s.entities.projectiles.includes(sk.target);
  if (!tgtEnemyOk && !tgtProjOk){
    sk.target = Sim.energyCannonTarget(s);
  } else {
    // If a meteor is currently falling and would still be in the air when the charge completes,
    // switch to it so the shot can be used as counterplay.
    const eCfgTmp = Sim.getEnergyCfg(s);
    const chargeSec = (eCfgTmp && eCfgTmp.chargeSec!=null) ? eCfgTmp.chargeSec : (CFG.energyCannon.chargeSec||3.0);
    const leftCharge = Math.max(0, chargeSec - (sk.charge||0));
    let bestMeteor=null, bestT=1e18;
    for (const p of s.entities.projectiles){
      if (!p || (p.life||0)<=0) continue;
      const isMeteor = (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact");
      if (!isMeteor) continue;
      if (p.meteorWeakened) continue;
      const sp = Math.hypot(p.vx||0, p.vy||0) || 1;
      const tImpact = dist(p.x,p.y, s.core.x, s.core.y) / sp;
      if (tImpact < bestT){ bestT=tImpact; bestMeteor=p; }
    }
    if (bestMeteor && bestT > 0.05 && bestT <= (leftCharge + 0.35)) sk.target = bestMeteor;
  }

  const eCfg = Sim.getEnergyCfg(s);
  sk.charge += ds;
  if (sk.charge>=eCfg.chargeSec){
    const tgtEnemy = (sk.target && sk.target.hp>0 && s.entities.enemies.includes(sk.target)) ? sk.target : null;
    const tgtProj  = (!tgtEnemy && sk.target && (sk.target.life||0)>0 && s.entities.projectiles.includes(sk.target)) ? sk.target : null;

    // At the moment of firing, if an unweakened meteor is currently falling, prefer shooting it.
    let meteorNow=null, meteorT=1e18;
    for (const p of s.entities.projectiles){
      if (!p || (p.life||0)<=0) continue;
      const isMeteor = (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact");
      if (!isMeteor) continue;
      if (p.meteorWeakened) continue;
      const sp = Math.hypot(p.vx||0, p.vy||0) || 1;
      const tImpact = dist(p.x,p.y, s.core.x, s.core.y) / sp;
      if (tImpact < meteorT){ meteorT=tImpact; meteorNow=p; }
    }

    const target = (meteorNow && meteorT>0.05) ? meteorNow : (tgtEnemy || tgtProj || Sim.energyCannonTarget(s));

    sk.charging=false; sk.charge=0;
    sk.target=null;
    AudioSys.stopEnergyCharge();

    if (!target){
      // No valid target at the moment of firing: cancel without starting cooldown.
      s.ui.status = "대상이 없어 에너지포 발사 취소";
      s.ui.status2 = "";
      AudioSys.sfx("error");
    } else {
      const eCfg = Sim.getEnergyCfg(s);
      sk.cd = eCfg.cooldownSec;

      const isProjTgt = (target && (target.life||0)>0 && s.entities.projectiles.includes(target));
      if (!isProjTgt){
        Sim.damageEnemy(s, target, eCfg.damage, "energyCannon");
      } else {
        // Meteor counterplay: shoot the FALLING METEOR projectile to weaken its impact (-45% damage).
        const isMeteor = (target.from==="enemyMeteor" || target.onHitFx==="meteorImpact");
        if (isMeteor){
          if (!target.meteorWeakened){
            target.meteorWeakened = true;
            target.dmg = Math.max(0, Math.floor((target.dmg||0) * 0.55));
            if (target.aoeTurretDmgPct!=null) target.aoeTurretDmgPct = clamp((target.aoeTurretDmgPct||0) * 0.55, 0, 0.95);
            if (target.aoeTurretDmg!=null) target.aoeTurretDmg = Math.max(0, Math.floor((target.aoeTurretDmg||0) * 0.55));
            // Visual feedback: slightly dim/shrink the meteor.
            if (target.tint) target.tint = "rgba(255,170,120,0.85)";
            target.r = Math.max(16, (target.r||22) - 4);
            s.entities.fx.push({type:"pulse", x:target.x, y:target.y, t:0.22});
            s.ui.status = "에너지포 요격: 운석 약화 (-45%)";
            s.ui.status2 = "";
          } else {
            s.ui.status = "이미 약화된 운석";
            s.ui.status2 = "";
          }
        }
      }

      // Final Energy Cannon upgrade bonus: small core shield restore on hit.
      if ((s.skillUpg && (s.skillUpg.energyLv||0) >= 3) && (eCfg.finalShRestore||0) > 0){
        const gain = eCfg.finalShRestore;
        if (gain > 0 && s.core.sh < s.core.shMax - 0.01){
          s.core.sh = Math.min(s.core.shMax, s.core.sh + gain);
          // subtle feedback
          s.entities.fx.push({type:"coreFlash", x:s.core.x, y:s.core.y, t:0.18});
          AudioSys.sfx("shieldHit", 0.55);
        }
      }
      // energy cannon is single-target by default.
      // Only when OVERDRIVE passive is selected, add 30% splash.
      if (s.passives.selected==="overdrive"){
        Sim.aoe(s, target.x, target.y, eCfg.splashRadius, eCfg.damage*eCfg.splashPct, target);
        s.entities.fx.push({type:"expl", x:target.x,y:target.y,r:eCfg.splashRadius,t:0.22});
      }
      s.entities.fx.push({type:"beam", x1:s.core.x,y1:s.core.y,x2:target.x,y2:target.y,t:0.25});
      AudioSys.sfx("energyFire");
      addShake(s, 5, 0.14);
    }
  }
}

      // wave spawns
      if (s.game.phase==="wave"){
        Sim.ensureWave(s);
        const ws=s._waveSpawn;
        if (ws){
          ws.timer -= ds;
          if (ws.timer<=0 && ws.remaining>0){
            // enemy mix by wave
            let kind="normal";
            const w=s.game.waveIndex;

            // forced spawns (boss wave mix)
            if (ws.forcedKinds && ws.forcedKinds.length>0){
              kind = ws.forcedKinds.pop();
            } else {
              const r=Math.random();
            const bossWave = (w%5===0);
            const finalWave = (w===30);
            const ev = Sim.eventInWave(s);
            const eventWave = !!ev;
            const em = ev ? (ev.mods||{}) : {};

            // special enemies (added)
            const bumpR = (eventWave ? 0.04 : 0.00) + (eventWave ? (em.spawnRangedAdd||0) : 0);
            const bumpB = (eventWave ? 0.03 : 0.00) + (eventWave ? (em.spawnBomberAdd||0) : 0);
            const bumpD = (eventWave ? 0.02 : 0.00) + (eventWave ? (em.spawnDisruptAdd||0) : 0);

            const rangedP   = (bossWave ? 0.12 : (w>=16?0.12:(w>=8?0.10:(w>=4?0.06:0.00)))) + bumpR;
            const bomberP   = (bossWave ? 0.14 : (w>=18?0.12:(w>=10?0.10:(w>=6?0.06:0.00)))) + bumpB;
            const disruptP  = (bossWave ? 0.10 : (w>=20?0.10:(w>=12?0.07:(w>=10?0.05:0.00)))) + bumpD;

            // New enemy types (role-based)
            const supporterP = (w>=7  ? (bossWave ? 0.06 : 0.05) : 0.00);
            const splitterP  = (w>=8  ? (eventWave ? 0.14 : 0.07) : 0.00);
            const leechP     = (w>=9  ? (bossWave ? 0.05 : 0.06) : 0.00);
            const sniperP    = (w>=11 ? (bossWave ? 0.06 : (w>=20 ? 0.06 : 0.04)) : 0.00);
            const armoredP   = (w>=14 ? (bossWave ? 0.05 : (w>=20 ? 0.06 : 0.04)) : 0.00);

            const meteorFrom = (CFG.meteor && CFG.meteor.spawnFromWave!=null) ? CFG.meteor.spawnFromWave : 16;
            const meteorP    = (!finalWave && w>=meteorFrom && (ws.meteorSpawned||0) < (ws.meteorCap||1)) ? (bossWave ? 0.02 : (eventWave ? 0.06 : 0.03)) : 0.00;


            const sumSpecial = rangedP + bomberP + disruptP + supporterP + splitterP + leechP + sniperP + armoredP + meteorP;
            const specialSum = clamp(sumSpecial, 0, 0.75);

            if (r < disruptP) kind="disruptor";
            else if (r < disruptP + bomberP) kind="bomber";
            else if (r < disruptP + bomberP + rangedP) kind="ranged";
            else if (r < disruptP + bomberP + rangedP + supporterP) kind="supporter";
            else if (r < disruptP + bomberP + rangedP + supporterP + splitterP) kind="splitter";
            else if (r < disruptP + bomberP + rangedP + supporterP + splitterP + leechP) kind="leech";
            else if (r < disruptP + bomberP + rangedP + supporterP + splitterP + leechP + sniperP) kind="sniper";
            else if (r < disruptP + bomberP + rangedP + supporterP + splitterP + leechP + sniperP + armoredP) kind="armored";
            else if (r < disruptP + bomberP + rangedP + supporterP + splitterP + leechP + sniperP + armoredP + meteorP) kind="meteor";
            else {
              // base enemies (renormalized)
              const rr = (r - Math.min(sumSpecial, 0.95)) / Math.max(1e-6, (1 - Math.min(sumSpecial, 0.95)));
              let eliteP = bossWave ? 0.12 : (w>=18?0.10:(w>=12?0.07:(w>=8?0.04:0.00)));
              let tankP  = bossWave ? 0.34 : (w>=10?0.28:(w>=6?0.22:(w>=3?0.16:0.00)));
              let fastP  = bossWave ? 0.58 : (w>=8?0.48:(w>=4?0.40:(w>=2?0.30:0.00)));

              // Event stage: slightly more fast/special feel.
              if (eventWave && !bossWave){
                eliteP += 0.02 + (em.spawnEliteAdd||0);
                fastP  += 0.08 + (em.spawnFastAdd||0);
                tankP  = Math.max(0, tankP - 0.04 + (em.spawnTankAdd||0));
              }

              if (rr < eliteP) kind="elite";
              else if (rr < eliteP + tankP) kind="tank";
              else if (rr < eliteP + tankP + fastP) kind="fast";
            }
            }

            if (kind==="meteor") ws.meteorSpawned = (ws.meteorSpawned||0) + 1;

            Sim.spawnEnemy(s, kind);
            ws.remaining--; ws.timer=Math.max(0.12, 0.26 - w*0.003);
          }
          if (ws.remaining===0 && ws.boss){
            Sim.spawnEnemy(s, "boss");
            ws.boss=false;
          }
        }
        const alive=s.entities.enemies.some(e=>e.hp>0);
        if (!alive && ws && ws.remaining===0 && !ws.boss){
          const W = s.game.waveIndex;
          let waveClear = 120 + 6*W;
          let perfect = (!s._waveHpDamaged) ? (60 + 3*W) : 0;
          const ev = (s.game.event && s.game.event.active) ? s.game.event : null;
          let eventBonus = 0;
          if (ev){
            const base = (ev.mods && typeof ev.mods.clearBonusFlat === "number") ? ev.mods.clearBonusFlat : 0;
            const perW = (ev.mods && typeof ev.mods.clearBonusPerWave === "number") ? ev.mods.clearBonusPerWave : 0;
            eventBonus = Math.round(base + perW*W);
          }

          if (s.game.difficulty==="hard"){ waveClear = Math.round(waveClear*1.10); perfect = Math.round(perfect*1.10); eventBonus = Math.round(eventBonus*1.10); }
          let total = waveClear + perfect + eventBonus;
          if (W===30) total += 500; // final reward

          // apply global + event multipliers
          total = Math.max(0, Math.floor(total * Sim.crystalGainMul(s)));

          // event is wave-only
          if (ev) s.game.event = {active:false, key:null, name:"", desc:"", mods:{}};

          s.resources.crystals += total;
          AudioSys.sfx("waveClear");
          AudioSys.sfx("crystal", total>=450?1.6:1.2);

          if (W>=30){
            // Final wave cleared -> short cinematic, then show the clear overlay.
            s.game.phase="ending";
            s.game.overT = 0;
            s.game.badEnding = false;
            s.game.endingDur = 4.8;
            s.game.endingT = s.game.endingDur;

            // ===== Ending: normal / true =====
            const stats = s.game.stats || {leechStolen:0, meteorCalls:0, meteorImpacts:0};
            const reqLeech = 50;    // allow a small amount of loss
            const reqUpg = 3;       // sum of (HP 최대 + SH 최대) 업그레이드 레벨
            const upgSum = (s.core.hpMaxLv||0) + (s.core.shMaxLv||0);

            const miss=[];
            if ((stats.meteorImpacts||0) > 0) miss.push(`운석 낙하 ${stats.meteorImpacts}회(0회 필요)`);
            if ((stats.leechStolen||0) > reqLeech) miss.push(`흡혈 손실 ${Math.round(stats.leechStolen)}(≤${reqLeech} 필요)`);
            if (upgSum < reqUpg) miss.push(`코어 최대치 강화 ${upgSum}/${reqUpg}`);

            const isTrue = (miss.length===0);
            s.game.endingType = isTrue ? "true" : "normal";
            s.game.endingHint = isTrue ? "" : ("트루 조건 미달: " + miss.join(" / "));

            AudioSys.setBgmMode(isTrue ? "endingGood" : "endingNormal");
            AudioSys.stopEnergyCharge();
            // quick feedback + start seal vibe
            s.entities.fx.push({type:"pulse", x:s.core.x, y:s.core.y, t:0.35});
            s.entities.fx.push({type:"shock", x:s.core.x, y:s.core.y, t:0.5});
            AudioSys.sfx("resonance", 1.15);

            s.ui.status=`최종보스 격파! +${total} 크리스탈`;
            s.ui.status2 = (isTrue ? "트루 엔딩 조건 달성 — 봉인 가동" : "노멀 엔딩 — 봉합 가동") + (eventBonus>0?` / 이벤트 보너스 +${eventBonus}`:"");
            UI.applyGameOverVisibility();
            return;
          } else {
            s.game.phase="shop";
            AudioSys.setBgmMode("idle");
            s.ui.status=`웨이브 ${W} 클리어! +${total} 크리스탈 (Space/웨이브로 다음)`;
            s.ui.status2=[(ev?`이벤트: ${ev.name}`:""), (!s._waveHpDamaged)?`퍼펙트 보너스 포함 (+${perfect})`:"", (eventBonus>0)?`이벤트 보너스 +${eventBonus}`:""]
              .filter(Boolean).join(" / ");
          }
        }
      }

      // enemies

      // Meteor Caller channeling cap: only ONE meteor enemy counts down at a time.
      // The earliest-spawned alive meteor (array order) becomes the channeler; others show '대기'.
      let activeMeteor = null;
      for (const me of s.entities.enemies){
        if (!me || me.hp<=0) continue;
        if ((me.kind||"")!=="meteor") continue;
        if (me.meteorFired) continue;
        activeMeteor = me;
        break;
      }

      for (const e of s.entities.enemies){
        if (e.hitFlash>0) e.hitFlash=Math.max(0, e.hitFlash-ds);
        if (e.fbShotFlash>0) e.fbShotFlash=Math.max(0, e.fbShotFlash-ds);

        if (e.hp<=0){
          if (e.deathT>0) e.deathT=Math.max(0, e.deathT-ds);
          continue;
        }

        // timed despawn (used by final boss summons)
        if (e.despawnT!=null && e.despawnT>0){
          e.despawnT -= ds;
          if (e.despawnT<=0){
            e.hp=0; e.dead=true; e.deathT=0.18;
            continue;
          }
        }

        // mark refresh timer
        if (e.markT>0){
          e.markT -= ds;
          if (e.markT<=0){ e.markT=0; e.mark=0; }
        }

        let spd=e.speed;
        if (e.slowT>0){
          e.slowT -= ds;
          spd *= (e.slowMul!=null?e.slowMul:0.55);
          if (e.slowT<=0){ e.slowT=0; e.slowMul=1; }
        }

        // TimeWarp (R): slow enemy move/attack speed while active (core-centered radius)
        let atkMul = 1.0;
        const TW = s.skill.timeWarp;
        if (TW && TW.active>0){
          const tCfg = Sim.getTimeWarpCfg(s);
          const r = (tCfg && tCfg.radius!=null) ? tCfg.radius : 600;
          const inRange = dist(s.core.x, s.core.y, e.x, e.y) <= r;
          if (inRange){
            const eff = (e.isBoss ? (tCfg.bossEff!=null?tCfg.bossEff:0.60) : 1.0);
            spd *= (1 - (tCfg.moveSlowPct||0)*eff);
            atkMul *= (1 - (tCfg.atkSlowPct||0)*eff);
          }
        }

        const kind = e.kind || "normal";

        // Meteor Caller: if not killed within 8s (cast affected by TimeWarp), calls a giant meteor strike (one-time).
        if (kind==="meteor"){
          e.meteorDelay = (e.meteorDelay||0) > 0 ? e.meteorDelay : ((CFG.meteor && CFG.meteor.delaySec!=null) ? CFG.meteor.delaySec : 8.0);

          const isChanneler = (activeMeteor === e);
          e.meteorIsChanneler = isChanneler;

          if (isChanneler){
            // TimeWarp reduces attack speed => slows casting progress
            e.meteorT = (e.meteorT||0) + ds * atkMul;
          }

          if (isChanneler && !e.meteorFired && e.meteorT >= e.meteorDelay){
            e.meteorFired = true;
            if (s.game && s.game.stats) s.game.stats.meteorCalls = (s.game.stats.meteorCalls||0) + 1;

            const warn = (CFG.meteor && CFG.meteor.warnSec!=null) ? CFG.meteor.warnSec : 0.85;
            // Energy Cannon counterplay happens by shooting the falling meteor projectile (not the summoner).
            const dmg  = ((e.meteorDmg||0) > 0 ? e.meteorDmg : ((CFG.meteor && CFG.meteor.damage!=null) ? CFG.meteor.damage : 280));
            const R    = (CFG.meteor && CFG.meteor.impactRadius!=null) ? CFG.meteor.impactRadius : 320;
            const pct  = ((CFG.meteor && CFG.meteor.turretDmgPct!=null) ? CFG.meteor.turretDmgPct : 0.35);

            const sx = s.core.x + randRange(-120, 120);
            const sy = s.core.y - 980;
            const tx = s.core.x, ty = s.core.y;
            const len2 = Math.hypot(tx-sx, ty-sy) || 1;
            const speed = len2 / Math.max(0.20, warn);

            s.entities.fx.push({type:"meteorWarn", x:tx, y:ty, r:R, t:warn, ttl:warn});
            Sim.fireProj(
              s,
              sx, sy,
              tx, ty,
              dmg,
              speed,
              0, 0, 0,
              "enemyMeteor",
              {
                tint:"rgba(255,120,70,0.95)", r:22, life:warn+0.25,
                hitCore:true,
                onHitFx:"meteorImpact", onHitExplR:R, onHitSfx:"meteorImpact",
                // AoE impact: damages turrets in the impact radius (percentage of turret max HP)
                aoeTurretDmgPct: clamp(pct, 0, 0.95),
                aoeTurretDmgMin: 1
              }
            );
            AudioSys.sfx("meteor");
          }
        }

        // Shield Supporter: periodically grant nearby enemies temporary shield
        if (kind==="supporter"){
          e.auraT = (e.auraT!=null ? e.auraT : randRange(0.0, 2.0));
          e.auraEvery = (e.auraEvery||2.0);
          e.auraRadius = (e.auraRadius||180);
          e.auraT -= ds;
          if (e.auraT<=0){
            e.auraT += e.auraEvery;
            const R = e.auraRadius;
            for (const t of s.entities.enemies){
              if (!t || t.hp<=0) continue;
              if (dist(e.x,e.y,t.x,t.y) <= R){
                const sh = (t.hpMax||1) * 0.08;
                t.tempShMax = sh;
                t.tempSh = sh;
              }
            }
            s.entities.fx.push({type:"supportPulse", x:e.x, y:e.y, r:R, t:0.35});
          }
        }

        // ---------- Movement / AI by kind ----------
        if (kind==="bomber"){
          const t = Sim.nearestTurret(s, e.x, e.y, 1e9);
          const tx = t ? t.x : s.core.x;
          const ty = t ? t.y : s.core.y;
          const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx,dy)||1;
          const stopDist = e.r + (t ? 22 : CFG.core.coreRadius);

          if (len > stopDist){
            e.x += (dx/len)*spd*ds;
            e.y += (dy/len)*spd*ds;
          }

          const trigger = (e.explodeTriggerDist||40) + (t ? 18 : CFG.core.coreRadius);
          if (len <= trigger){
            // explode: damages nearby turrets and the core
            const R = e.explodeRadius||140;
            for (const tt of s.entities.turrets){
              if (tt.dead) continue;
              const dtt = dist(e.x,e.y,tt.x,tt.y);
              if (dtt <= R + 24){
                Sim.damageTurret(s, tt, e.explodeTurretDmg||110, "bomber");
              }
            }
            const dc = dist(e.x,e.y,s.core.x,s.core.y);
            if (dc <= R + CFG.core.coreRadius){
              Sim.damageCore(s, e.explodeCoreDmg||18, {type:"bomberExplode", enemy:e});
            }
            s.entities.fx.push({type:"expl", x:e.x, y:e.y, r:R, t:0.22});
            AudioSys.sfx("bomberExplode");
            // die and give reward
            if (!e.dead){
              e.hp=0; e.dead=true; e.deathT=0.25;
              let reward=(e.reward!=null)?e.reward:0;

              // Event: bomber reward bonus (same rule as normal kills)
              const _ev = Sim.eventInWave(s);
              if (_ev && _ev.mods && typeof _ev.mods.bomberRewardMul === "number"){
                reward *= _ev.mods.bomberRewardMul;
              }

              const add = Math.max(1, Math.floor(reward * Sim.crystalGainMul(s)));
              s.resources.crystals += add;
              if (add>0) AudioSys.sfx("crystal", add>=60?1.5:1.0);
              s.entities.fx.push({type:"kill", x:e.x, y:e.y, t:0.22});
            }
}
        } else if (kind==="ranged" || kind==="disruptor" || kind==="sniper" || kind==="boss"){
          let skipBossShot = false;
          const dx = s.core.x - e.x, dy = s.core.y - e.y, len = Math.hypot(dx,dy)||1;
          const keep = e.keepDist || 320;

          // approach / retreat to maintain distance + a little strafe
          if (len > keep){
            e.x += (dx/len)*spd*ds;
            e.y += (dy/len)*spd*ds;
          } else if (len < keep-42){
            e.x -= (dx/len)*spd*ds;
            e.y -= (dy/len)*spd*ds;
          } else {
            // orbit (bosses strafe a bit slower)
            const om = (kind==="boss") ? 0.18 : 0.25;
            e.x += (-dy/len)*spd*om*ds;
            e.y += ( dx/len)*spd*om*ds;
          }

          // ===== Final Boss patterns (3 pages: 66% / 33%) =====
          if (kind==="boss" && e.isFinalBoss){
            const hpPct = (e.hpMax>0)?(e.hp/e.hpMax):0;
            if (!e.fbPhase) e.fbPhase = 1;

            const startPhase = (ph)=>{
              e.fbPhase = ph;
              e.fbInvT = Math.max(e.fbInvT||0, 0.85);
              e.fbTransT = Math.max(e.fbTransT||0, 1.10);
              e.shootCd = Math.max(e.shootCd||0, 1.0);
              e.fbLaserCd = randRange(2.8, 4.2);
              e.fbZoneCd  = randRange(5.8, 8.2);
              e.fbShardCd = randRange(4.2, 6.2);
              s.entities.fx.push({type:"fbPhase", x:s.core.x, y:s.core.y, t:0.65, ttl:0.65});
              AudioSys.sfx("resonance", 1.15);
            };
            if (e.fbPhase===1 && hpPct<=0.66) startPhase(2);
            if (e.fbPhase===2 && hpPct<=0.33) startPhase(3);

            // decrement invuln/transition timers
            if (e.fbInvT>0) e.fbInvT = Math.max(0, e.fbInvT - ds*atkMul);
            if (e.fbTransT>0) e.fbTransT = Math.max(0, e.fbTransT - ds*atkMul);

            // update laser telegraph / fire
            if (e.fbLaserTele>0){
              e.fbLaserTele = Math.max(0, e.fbLaserTele - ds*atkMul);
              if (e.fbLaserTele===0){
                e.fbLaserFire = (e.fbPhase>=3) ? 1.25 : 1.0;
                s.entities.fx.push({type:"fbLaserFire", x:s.core.x, y:s.core.y, ang:e.fbLaserAng||0, t:e.fbLaserFire, ttl:e.fbLaserFire});
                AudioSys.sfx("enemyShot", 1.25);

                // apply overheat + chip damage to turrets along the cross-laser
                const width = (e.fbPhase>=3) ? 18 : 14;
                const dmgT = (e.fbPhase>=3) ? 58 : 42;
                const ohT  = (e.fbPhase>=3) ? 3.2 : 2.4;
                const a0 = e.fbLaserAng||0;
                const a1 = a0 + Math.PI*0.5;
                const nx0 = -Math.sin(a0), ny0 = Math.cos(a0);
                const nx1 = -Math.sin(a1), ny1 = Math.cos(a1);
                for (const t of s.entities.turrets){
                  if (!t || t.dead) continue;
                  const dx = t.x - s.core.x;
                  const dy = t.y - s.core.y;
                  const d0 = Math.abs(dx*nx0 + dy*ny0);
                  const d1 = Math.abs(dx*nx1 + dy*ny1);
                  if (d0<=width || d1<=width){
                    t.overheatT = Math.max(t.overheatT||0, ohT);
                    Sim.damageTurret(s, t, dmgT, "finalLaser");
                  }
                }
              }
            }
            if (e.fbLaserFire>0){
              e.fbLaserFire = Math.max(0, e.fbLaserFire - ds*atkMul);
              if (e.fbLaserFire===0){
                const cdMul = (e.fbPhase>=3) ? 0.78 : 1.0;
                e.fbLaserCd = randRange(5.0, 7.2) * cdMul;
              }
            }

            // update zone telegraph / active
            if (e.fbZoneTele>0){
              e.fbZoneTele = Math.max(0, e.fbZoneTele - ds*atkMul);
              if (e.fbZoneTele===0){
                e.fbZoneT = (e.fbPhase>=3) ? 4.2 : 3.8;
                e.fbZoneTick = 0;
                s.entities.fx.push({type:"fbZone", x:s.core.x, y:s.core.y, r:e.fbZoneR||560, t:e.fbZoneT, ttl:e.fbZoneT});
                AudioSys.sfx("timeWarp", 1.05);

                // apply immediate overheat to turrets inside the zone
                const rr = e.fbZoneR||560;
                const dmgT = (e.fbPhase>=3) ? 28 : 22;
                for (const t of s.entities.turrets){
                  if (!t || t.dead) continue;
                  if (dist(t.x,t.y,s.core.x,s.core.y) <= rr){
                    t.overheatT = Math.max(t.overheatT||0, (e.fbPhase>=3)?2.4:1.8);
                    Sim.damageTurret(s, t, dmgT, "finalZone");
                  }
                }
              }
            }
            if (e.fbZoneT>0){
              e.fbZoneT = Math.max(0, e.fbZoneT - ds*atkMul);
              e.fbZoneTick = (e.fbZoneTick||0) - ds*atkMul;
              if (e.fbZoneTick<=0){
                e.fbZoneTick = 0.35;
                const rr = e.fbZoneR||560;
                // if boss is within the zone, lock core regen/repair for a short window (keeps refreshing)
                if (dist(e.x,e.y,s.core.x,s.core.y) <= rr){
                  s.core.shRegenLock = Math.max(s.core.shRegenLock||0, 0.75);
                  s.core.repairLock  = Math.max(s.core.repairLock||0, 0.75);
                }
              }
              if (e.fbZoneT===0){
                const cdMul = (e.fbPhase>=3) ? 0.80 : 1.0;
                e.fbZoneCd = randRange(8.5, 11.5) * cdMul;
              }
            }

            // start new patterns when not busy
            const busy = (e.fbTransT>0) || (e.fbLaserTele>0) || (e.fbLaserFire>0) || (e.fbZoneTele>0) || (e.fbZoneT>0);
            if (!busy){
              const cdMul = (e.fbPhase>=3) ? 0.80 : 1.0;
              e.fbLaserCd -= ds*atkMul*cdMul;
              e.fbZoneCd  -= ds*atkMul*cdMul;
              e.fbShardCd -= ds*atkMul*cdMul;

              const startLaser = ()=>{
                e.fbLaserAng = randRange(0, Math.PI);
                e.fbLaserTele = 0.75;
                s.entities.fx.push({type:"fbLaserTele", x:s.core.x, y:s.core.y, ang:e.fbLaserAng, t:e.fbLaserTele, ttl:e.fbLaserTele});
                AudioSys.sfx("enemyDisrupt", 1.05);
              };
              const startZone = ()=>{
                e.fbZoneR = 540 + ((e.fbPhase>=3)?60:0);
                e.fbZoneTele = 0.90;
                s.entities.fx.push({type:"fbZoneTele", x:s.core.x, y:s.core.y, r:e.fbZoneR, t:e.fbZoneTele, ttl:e.fbZoneTele});
                AudioSys.sfx("timeWarp", 0.95);
              };
              const spawnShards = ()=>{
                const n = (e.fbPhase>=3) ? 6 : (e.fbPhase>=2 ? 4 : 3);
                for (let i=0;i<n;i++){
                  Sim.spawnEnemy(s, "splitling");
                  const m = s.entities.enemies[s.entities.enemies.length-1];
                  if (m){
                    m.x = clamp(e.x + randRange(-90,90), 18, CFG.LOGICAL_W-18);
                    m.y = clamp(e.y + randRange(-90,90), 18, CFG.LOGICAL_H-18);
                    m.reward = 0;
                    m.noReward = true;
                    m.isFinalMinion = true;
                    m.despawnT = 7.0;
                    m.hpMax *= (e.fbPhase>=3?0.70:0.60);
                    m.hp = m.hpMax;
                    m.speed *= 1.10;
                  }
                }
                s.entities.fx.push({type:"supportPulse", x:e.x, y:e.y, r:220, t:0.35});
                AudioSys.sfx("enemyShot", 0.95);
                e.fbShardCd = randRange(10.0, 13.0) * ((e.fbPhase>=3)?0.78:1.0);
              };

              if (e.fbPhase>=2 && e.fbZoneCd<=0) startZone();
              else if (e.fbLaserCd<=0) startLaser();
              else if (e.fbShardCd<=0) spawnShards();
            }

            // while telegraphing / transitioning, skip normal boss shots
            if (e.fbTransT>0 || e.fbLaserTele>0 || e.fbLaserFire>0 || e.fbZoneTele>0){
              skipBossShot = true;
            }
          }

          // shooting
          e.shootCd = (e.shootCd||0) - ds*atkMul;
          const inRange = (len <= (e.shootRange||520));
          if (!skipBossShot && e.shootCd<=0 && inRange){
            const isBoss = (kind==="boss");
            const tint = (kind==="disruptor") ? "rgba(170,255,170,0.95)"
                       : (kind==="sniper") ? "rgba(255,210,110,0.95)"
                       : isBoss ? (e.isFinalBoss ? "rgba(255,120,170,0.95)" : "rgba(255,140,100,0.95)")
                       : "rgba(255,230,140,0.95)";
            const from = (kind==="disruptor") ? "enemyDisrupt"
                       : (kind==="sniper") ? "enemySniper"
                       : isBoss ? "enemyBoss" : "enemy";
            const pr = isBoss ? (e.isFinalBoss ? 6 : 5) : (kind==="sniper" ? 5 : 4);
            const life = isBoss ? 3.2 : (kind==="sniper" ? 3.2 : 2.8);
            Sim.fireProj(
              s,
              e.x, e.y,
              s.core.x, s.core.y,
              e.projDmg||10,
              e.projSpeed||620,
              0, 0, 0,
              from,
              { owner:e, tint, r:pr, life, hitCore:true, shLockSec:e.shLockSec||0, repairLockSec:e.repairLockSec||0 }
            );
            AudioSys.sfx(kind==="disruptor"?"enemyDisrupt":"enemyShot", isBoss?1.25:1.0);
            if (isBoss && e.isFinalBoss) e.fbShotFlash = 0.12;
            e.shootCd = 1/Math.max(0.2, (e.shotsPerSec||0.8));
          }

          // emergency: if somehow touching the core, still deals contact damage
          const d=dist(e.x,e.y,s.core.x,s.core.y);
          if (d <= (e.r + CFG.core.coreRadius + 2)){
            e.hitT -= ds*atkMul;
            if (e.hitT<=0){
              // Leech: steals crystals on contact (blocked by wall/Q invulnerability)
              if (kind==="leech" && !(s.skill && s.skill.wall && (s.skill.wall.active||0)>0)){
                const steal=25;
                const before=s.resources.crystals;
                s.resources.crystals = Math.max(0, s.resources.crystals - steal);
                const took = before - s.resources.crystals;
                if (took>0){
                  if (s.game && s.game.stats) s.game.stats.leechStolen = (s.game.stats.leechStolen||0) + took;
                  s.entities.fx.push({type:"leechHit", x:s.core.x, y:s.core.y, t:0.30});
                }
              }
              Sim.damageCore(s, e.dmg, {type:"contact", enemy:e});
              e.hitT = CFG.enemy.hitInterval;
            }
          }
        } else {
          // normal melee walkers
          const dx=s.core.x-e.x, dy=s.core.y-e.y, len=Math.hypot(dx,dy)||1;

          // stop at core edge (no overlap)
          const stopDist = e.r + CFG.core.coreRadius;
          if (len > stopDist) {
            e.x += (dx/len)*spd*ds;
            e.y += (dy/len)*spd*ds;
          } else {
            const nx = dx/len, ny = dy/len;
            e.x = s.core.x - nx*stopDist;
            e.y = s.core.y - ny*stopDist;
          }

          const d=dist(e.x,e.y,s.core.x,s.core.y);
          if (d <= (e.r + CFG.core.coreRadius + 2)) {
            e.hitT -= ds*atkMul;
            if (e.hitT<=0){
              // Leech: steals crystals on contact (blocked by wall/Q invulnerability)
              if (kind==="leech" && !(s.skill && s.skill.wall && (s.skill.wall.active||0)>0)){
                const steal=25;
                const before=s.resources.crystals;
                s.resources.crystals = Math.max(0, s.resources.crystals - steal);
                const took = before - s.resources.crystals;
                if (took>0){
                  if (s.game && s.game.stats) s.game.stats.leechStolen = (s.game.stats.leechStolen||0) + took;
                  s.entities.fx.push({type:"leechHit", x:s.core.x, y:s.core.y, t:0.30});
                }
              }
              Sim.damageCore(s, e.dmg, {type:"contact", enemy:e});
              e.hitT = CFG.enemy.hitInterval;
            }
          }
        }
      }

      // turrets (combat only)
      for (const t of s.entities.turrets){
        if (t.dead) continue;

        if (t.hitFlash>0) t.hitFlash = Math.max(0, t.hitFlash - ds);
        if (t.shotFlash>0) t.shotFlash = Math.max(0, t.shotFlash - ds);

        // turret repair cooldown
        if (t.repairCd && t.repairCd>0) t.repairCd = Math.max(0, t.repairCd - ds);

        // do not fire during setup/shop/clear/gameover
        if (s.game.phase!=="wave") continue;

        let cdDec = ds;
        if (t.overheatT && t.overheatT>0){
          t.overheatT = Math.max(0, t.overheatT - ds);
          cdDec *= 0.5; // overheat: attack speed -50%
        }
        t.cd -= cdDec;
        if (t.cd<=0){
          const target = Sim.nearestEnemy(s, t.x, t.y, t.range);
          if (target){
            t.aimX = target.x; t.aimY = target.y;

            const isSlow = (t.type==="slow");
            const isSplash = (t.type==="splash");

            // passive modifiers (applied at fire time)
            let dmgMul = 1, aspdMul = 1;
            let pierce = 0;
            let burstActive = false;
            if (s.passives.selected==="overload"){
              const O = s.passives.overload;
              const act = Sim.act30to10(s);
              dmgMul *= (1 + (CFG.overload.baseTurretDmgBonusMax||0)*act*passiveMul(s));
              aspdMul *= (1 + (CFG.overload.baseTurretAspdBonusMax||0)*act*passiveMul(s));
              if ((O.burst||0) > 0){ burstActive = true; pierce = (CFG.overload.piercePlus||0); }
            }

            let tint = isSlow ? "rgba(120,255,220,0.95)"
                       : isSplash ? "rgba(255,170,90,0.95)"
                       : "rgba(200,220,255,0.95)";
            if (burstActive) tint = "rgba(255,90,90,0.95)";

            const pr = isSplash ? 5 : 4;
            const life = isSplash ? 2.8 : 2.2;

            let shotDmg = t.dmg * dmgMul;
            let isCrit = false;
            const cc = t.critChance||0;
            if (cc>0 && Math.random() < cc){
              isCrit = true;
              shotDmg *= (t.critMult||((CFG.crit&&CFG.crit.mult!=null)?CFG.crit.mult:1.5));
            }

            // burst: add a small explosion for non-splash turrets
            let extraSplashPct = t.extraSplashPct||0;
            let extraSplashR = t.extraSplashR||0;
            if (burstActive && (t.splashPct||0)<=0){
              extraSplashPct = Math.max(extraSplashPct, (CFG.overload.nosplashExplosionPct||0));
              extraSplashR = Math.max(extraSplashR, (CFG.overload.nosplashExplosionRadius||0));
            }

            Sim.fireProj(
              s,
              t.x, t.y,
              target.x, target.y,
              shotDmg,
              t.projSpeed,
              pierce,
              t.splashPct||0, t.splashR||0,
              "turret",
              { tint, r:pr, life,
                slowPct: t.slowPct||0,
                slowSec: t.slowSec||0,
                slowBossEff: t.slowBossEff,
                extraSplashPct,
                extraSplashR,
                slowAuraPct: t.slowAuraPct||0,
                slowAuraSec: t.slowAuraSec||0,
                slowAuraR: t.slowAuraR||0,
                crit: isCrit
              }
            );

            AudioSys.sfx(isSlow ? "shot_slow" : (isSplash ? "shot_splash" : "shot_basic"));

            t.shotFlash = 0.10;

            t.cd = 1/Math.max(0.1, (t.shotsPerSec||1) * aspdMul);
          } else {
            // no target: keep checking and point up
            t.aimX = t.x; t.aimY = t.y - 120;
            t.cd = 0.10;
          }
        }
      }


      // projectiles

      for (const p of s.entities.projectiles){
        // TimeWarp: slow meteor fall speed (-35%) while TimeWarp is active (gives extra reaction time).
        let dsP = ds;
        if ((p.from==="enemyMeteor" || p.onHitFx==="meteorImpact") && s.skill && s.skill.timeWarp && (s.skill.timeWarp.active||0)>0){
          dsP = ds * (1 - 0.35*twMul(s));
        }
        p.life -= dsP;
        p.x += p.vx*dsP; p.y += p.vy*dsP;
        if (p.life<=0) continue;

        // Enemy projectiles hit the core (and can apply debuffs)
        if (p.hitCore || p.from==="enemy" || p.from==="enemyDisrupt" || p.from==="enemyBoss"){
          const dc = dist(p.x,p.y,s.core.x,s.core.y);
          if (dc <= (p.r + CFG.core.coreRadius)){
            const isMeteorImpact = (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact");
            const wallOn = (isMeteorImpact && s.skill && s.skill.wall && (s.skill.wall.active||0)>0);
            const meteorTurretMul = wallOn ? 0.5 : 1.0;
            // AoE impact (e.g., Meteor): can damage turrets in the impact radius.
            if ((p.aoeTurretDmg || p.aoeTurretDmgPct) && (p.onHitExplR||0) > 0){
              const R = p.onHitExplR||0;
              const ix = s.core.x, iy = s.core.y;
              for (const t of s.entities.turrets){
                if (!t || t.dead) continue;
                if (dist(ix,iy,t.x,t.y) <= R){
                  let td = 0;
                  if (p.aoeTurretDmgPct!=null){
                    const pct = clamp(p.aoeTurretDmgPct, 0, 1);
                    const base = (t.hpMax!=null?t.hpMax:(t.hp||0));
                    td = Math.max(p.aoeTurretDmgMin||1, Math.floor(base * pct));
                  } else {
                    td = p.aoeTurretDmg||0;
                  }
                  if (td>0){
                    if (meteorTurretMul !== 1.0) td = Math.max(1, Math.floor(td * meteorTurretMul));
                    Sim.damageTurret(s, t, td, "meteor");
                  }
                }
              }
            }
            if (s.game && s.game.stats && (p.from==="enemyMeteor" || p.onHitFx==="meteorImpact")) s.game.stats.meteorImpacts = (s.game.stats.meteorImpacts||0) + 1;
            Sim.damageCore(s, p.dmg||0, {type:"projectile", proj:p});
            if (p.shLockSec) s.core.shRegenLock = Math.max(s.core.shRegenLock||0, p.shLockSec);
            if (p.repairLockSec) s.core.repairLock = Math.max(s.core.repairLock||0, p.repairLockSec);
            if (p.onHitFx) s.entities.fx.push({type:p.onHitFx, x:s.core.x, y:s.core.y, r:p.onHitExplR||220, t:0.65, ttl:0.65});
            if (p.onHitSfx) AudioSys.sfx(p.onHitSfx);
            p.life = 0;
            continue;
          }
          // do not collide with enemies
          continue;
        }

        for (const e of s.entities.enemies){
          if (e.hp<=0) continue;
          const d=dist(p.x,p.y,e.x,e.y);
          if (d <= e.r + p.r){
            Sim.damageEnemy(s, e, p.dmg, p.from);

            if (p.crit){
              s.entities.fx.push({type:"crit", x:e.x, y:e.y, r:Math.max(42, (p.splashR||0)*0.55), t:0.24});
              AudioSys.sfx("crit", 1.0);
            }

            // slow debuff (from slow turret)
            if (p.slowSec && p.slowPct){
              const eff = (e.isBoss ? (p.slowBossEff!=null?p.slowBossEff:0.6) : 1.0);
              const mul = clamp(1 - p.slowPct*eff, 0.20, 0.95);
              e.slowMul = Math.min(e.slowMul!=null?e.slowMul:1, mul);
              e.slowT = Math.max(e.slowT||0, p.slowSec);
            }

            // slow aura (slow turret A branch)
            if (p.slowAuraR && p.slowAuraSec && p.slowAuraPct){
              for (const ee of s.entities.enemies){
                if (ee===e || ee.hp<=0) continue;
                const dd = dist(e.x,e.y, ee.x, ee.y);
                if (dd <= (p.slowAuraR + ee.r)){
                  const eff2 = (ee.isBoss ? (p.slowBossEff!=null?p.slowBossEff:0.6) : 1.0);
                  const mul2 = clamp(1 - p.slowAuraPct*eff2, 0.20, 0.95);
                  ee.slowMul = Math.min(ee.slowMul!=null?ee.slowMul:1, mul2);
                  ee.slowT = Math.max(ee.slowT||0, p.slowAuraSec);
                }
              }
            }

            if (p.splashPct>0 && p.splashR>0){
              Sim.aoe(s, e.x, e.y, p.splashR, p.dmg*p.splashPct, e);
              s.entities.fx.push({type:"expl", x:e.x,y:e.y,r:p.splashR,t:0.22});
              AudioSys.sfx("expl");
            }
            if (p.extraSplashPct>0 && p.extraSplashR>0){
              Sim.aoe(s, e.x, e.y, p.extraSplashR, p.dmg*p.extraSplashPct, e);
              s.entities.fx.push({type:"expl", x:e.x,y:e.y,r:p.extraSplashR,t:0.22});
            }


            // overdrive splash 30% on core shot hits
            if (s.passives.selected==="overdrive" && p.from==="core"){
              Sim.aoe(s, e.x, e.y, CFG.overdrive.splashRadius, p.dmg*CFG.overdrive.splashPct*passiveMul(s), e);
              s.entities.fx.push({type:"expl", x:e.x,y:e.y,r:CFG.overdrive.splashRadius,t:0.18});
            }

            if (p.pierce>0) p.pierce -= 1;
            else p.life = 0;
            break;
          }
        }
      }

      // blue flames (HP low)
      updateBlueFlames(s, ds);

      // core break shards (if any)
      updateCoreBreak(s, ds);

      // CHEATS (PC testing)
      if (s.cheat){
        if (s.cheat.infiniteCrystals){
          s.resources.crystals = Math.max(s.resources.crystals, 99999);
        }
        if (s.cheat.god){
          s.core.destroyed = false;
          s.core.hp = s.core.hpMax;
          s.core.sh = s.core.shMax;
          s.core.shRegenLock = 0;
          s.core.repairLock = 0;
          s.core.repairCd = 0;
          s.core.emergencyCd = 0;
        }
      }

      // cleanup
      s.entities.enemies = s.entities.enemies.filter(e=> (e.hp>0) || (e.deathT>0));
      s.entities.turrets = s.entities.turrets.filter(t=> !t.dead);
      s.entities.projectiles = s.entities.projectiles.filter(p=>p.life>0);
      for (const fx of s.entities.fx){
        // Keep meteor warning visuals synced with TimeWarp meteor slow.
        let dtFx = ds;
        if (fx.type==="meteorWarn" && s.skill && s.skill.timeWarp && (s.skill.timeWarp.active||0)>0){
          dtFx = ds * (1 - 0.35*twMul(s));
        }
        fx.t -= dtFx;
      }
      s.entities.fx = s.entities.fx.filter(fx=>fx.t>0);

      Sim.updateStatus(s);
    }
  };
  // ---------- Blue Flames (reference-style particle) ----------
  // HP<=70% starts, HP<=5% max.
  // NOTE: 70% 근처에서 스폰량이 너무 적으면 "안 보인다" 체감이 생길 수 있어,
  // 70% 아래로 내려가면 최소 스폰률을 보장(즉시 눈에 보이도록).
  function spawnBlueFlame(s, intensity){
    // spawn around the core center (user preference)
    const baseX = s.core.x + rand(-18, 18);
    const baseY = s.core.y + rand(-18, 18);

    const size = lerp(9, 22, intensity) * (0.85 + Math.random()*0.30);
    const ttl  = lerp(0.32, 0.85, intensity) * (0.85 + Math.random()*0.28);

    s.flames.push({
      x: baseX, y: baseY,
      vx: rand(-18, 18) * (0.4 + intensity),
      vy: rand(-45, -130) * (0.6 + intensity),
      life: 0, ttl,
      size,
      intensity,
      wobble: rand(0.8, 1.6),
      phase: rand(0, Math.PI*2)
    });
  }

  function updateBlueFlames(s, dt){
    if (!s.game.running || s.game.phase === "gameover") {
      s.flames.length = 0;
      s.flameSpawnAcc = 0;
      return;
    }
    const hpRatio = s.core.hp / s.core.hpMax;

    const START = 0.70;  // start showing when HP falls below 70%
    const MAX_AT = 0.05; // maximum intensity at 5%

    if (hpRatio > START) {
      s.flames.length = 0;
      s.flameSpawnAcc = 0;
      return;
    }

    const intensity = clamp((START - hpRatio) / (START - MAX_AT), 0, 1);
    // Guarantee a minimum spawn rate once below START so flames appear immediately.
    const spawnPerSec = 2 + intensity * 16;
    s.flameSpawnAcc += spawnPerSec * dt;

    while (s.flameSpawnAcc >= 1) {
      spawnBlueFlame(s, intensity);
      s.flameSpawnAcc -= 1;
    }

    // cap count for safety
    if (s.flames.length > 120) s.flames.splice(0, s.flames.length - 120);

    for (let i = s.flames.length - 1; i >= 0; i--) {
      const f = s.flames[i];
      f.life += dt;
      f.phase += dt * f.wobble;
      f.x += (f.vx + Math.sin(f.phase)*18) * dt;
      f.y += f.vy * dt;
      f.vx *= (1 - dt*0.9);
      f.vy *= (1 - dt*0.15);
      if (f.life >= f.ttl) s.flames.splice(i, 1);
    }
  }

  function drawBlueFlames(ctx, s){
    if (!s.flames || s.flames.length === 0) return;
    for (const f of s.flames) {
      const t = clamp(f.life / f.ttl, 0, 1);
      const a = (1 - t) * (0.55 + 0.20*(f.intensity||0));
      const r = f.size * (1 - t*0.55);

      ctx.save();
      // additive glow, but scoped per-particle via save/restore
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;

      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r*1.5);
      // Use color alpha=1 and rely on globalAlpha (avoids double-multiplying alpha and becoming too faint)
      g.addColorStop(0.00, `rgba(219,234,254,1)`);
      g.addColorStop(0.35, `rgba(147,197,253,1)`);
      g.addColorStop(1.00, `rgba(96,165,250,0)`);
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.arc(f.x, f.y, r*1.15, 0, Math.PI*2);
      ctx.fill();

      ctx.globalAlpha = a*0.85;
      ctx.fillStyle = `rgba(96,165,250,1)`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r*0.50, r*0.90, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
    }
  }

const Render = {
    ctx:null,
    view:{cw:0,ch:0,dpr:1,scale:1,offX:0,offY:0},
    init(canvas){ Render.ctx=canvas.getContext("2d"); },
    resize(canvas){
      const cw=canvas.clientWidth, ch=canvas.clientHeight;
      const dpr=Math.max(1, window.devicePixelRatio||1);
      canvas.width=Math.floor(cw*dpr);
      canvas.height=Math.floor(ch*dpr);
      const scale=Math.min(cw/CFG.LOGICAL_W, ch/CFG.LOGICAL_H);
      const offX=(cw-CFG.LOGICAL_W*scale)/2;
      const offY=(ch-CFG.LOGICAL_H*scale)/2;
      Render.view={cw,ch,dpr,scale,offX,offY};
      const ctx=Render.ctx;
      ctx.setTransform(scale*dpr,0,0,scale*dpr,offX*dpr,offY*dpr);
      ctx.imageSmoothingEnabled=true;
    },
    clear(){
      const ctx=Render.ctx, {cw,ch,dpr}=Render.view;
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,cw*dpr,ch*dpr);
      ctx.restore();

      ctx.save();
      ctx.fillStyle="#080a10";
      ctx.fillRect(0,0,CFG.LOGICAL_W,CFG.LOGICAL_H);
      ctx.strokeStyle="rgba(36,46,76,0.85)";
      ctx.lineWidth=1;
      for (let x=0;x<=CFG.LOGICAL_W;x+=120){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CFG.LOGICAL_H); ctx.stroke(); }
      for (let y=0;y<=CFG.LOGICAL_H;y+=120){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CFG.LOGICAL_W,y); ctx.stroke(); }
      ctx.restore();
    },
    captureWaveFrame(s){
      const rf = s.rewindFrames;
      if (!rf || s.game.phase!=="wave") return;
      rf.tick = (rf.tick||0) + 1;
      if ((rf.tick % (rf.every||2))!==0) return;
      const w = rf.w||320, h = rf.h||180;
      const nMax = Math.max(1, Math.floor((60*3)/(rf.every||2)));
      if (!rf.buf || rf.buf.length!==nMax){
        rf.buf = Array.from({length:nMax}, ()=>{ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; });
        rf.idx = 0;
        rf.count = 0;
      }
      const c = rf.buf[rf.idx];
      const cctx = c.getContext("2d");
      cctx.clearRect(0,0,w,h);
      cctx.drawImage(Render.ctx.canvas, 0, 0, Render.ctx.canvas.width, Render.ctx.canvas.height, 0, 0, w, h);
      rf.idx = (rf.idx + 1) % rf.buf.length;
      rf.count = Math.min(rf.buf.length, (rf.count||0) + 1);
    },
    drawRewind(s){
      const ctx = Render.ctx;
      const rf = s.rewindFrames;
      Render.clear();
      if (rf && (rf.count||0)>0){
        const t = clamp((s.game.rewindT||0)/Math.max(0.001, s.game.rewindDur||1.6), 0, 1);
        const rev = Math.floor(t * Math.max(0, (rf.count||1)-1));
        const last = (rf.idx - 1 + rf.buf.length) % rf.buf.length;
        const idx = (last - rev + rf.buf.length) % rf.buf.length;
        const fr = rf.buf[idx];
        if (fr) ctx.drawImage(fr, 0,0,fr.width,fr.height, 0,0, CFG.LOGICAL_W, CFG.LOGICAL_H);

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0,0,CFG.LOGICAL_W,CFG.LOGICAL_H);
        ctx.fillStyle = "rgba(235,240,250,0.95)";
        ctx.font = "700 54px system-ui, sans-serif";
        const tx = "시간 되감기...";
        const tw = ctx.measureText(tx).width;
        ctx.fillText(tx, CFG.LOGICAL_W*0.5 - tw*0.5, CFG.LOGICAL_H*0.28);

        const bw=460,bh=14,bx=CFG.LOGICAL_W*0.5-bw*0.5,by=CFG.LOGICAL_H*0.28+26;
        ctx.fillStyle = "rgba(148,163,184,0.35)";
        ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle = "rgba(196,181,253,0.9)";
        ctx.fillRect(bx,by,bw*t,bh);
        ctx.font = "16px system-ui, sans-serif";
        ctx.fillStyle = "rgba(196,181,253,0.95)";
        ctx.fillText("클릭/Space: 스킵", bx, by+34);
      }
    },
    drawCore(s){
      const ctx=Render.ctx, x=s.core.x, y=s.core.y;
      // hide core when destroyed / hp=0
      if (s.core.destroyed || s.core.hp<=0){ return; }
      ctx.save();

      // ===== Skill visual fields (active only) =====
      const W = (s.skill && s.skill.wall) ? s.skill.wall : null;
      const TW = (s.skill && s.skill.timeWarp) ? s.skill.timeWarp : null;
      const tCfg = Sim.getTimeWarpCfg(s);
      const wCfg = Sim.getWallCfg(s);
      const eCfg = Sim.getEnergyCfg(s);

      // R: time warp field (purple)
      if (TW && TW.active>0){
        const p = clamp(TW.active/(tCfg.durationSec||CFG.timeWarp.durationSec), 0, 1);
        ctx.save();
        const R = (tCfg && tCfg.radius!=null) ? tCfg.radius : ((CFG.timeWarp && CFG.timeWarp.radius!=null) ? CFG.timeWarp.radius : 600);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0.0, `rgba(210,120,255,${0.18*p})`);
        g.addColorStop(0.55, `rgba(120,40,220,${0.10*p})`);
        g.addColorStop(1.0, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = `rgba(210,120,255,${0.30*p})`;
        ctx.lineWidth = 3;
        const rot = s.game.time*1.3;
        for (const rr of [R*0.4, R*0.6, R*0.8]){
          const wob = 1 + 0.02*Math.sin(rot + rr*0.01);
          ctx.beginPath(); ctx.arc(x, y, rr*wob, 0, Math.PI*2); ctx.stroke();
        }
        // show the actual effect radius boundary
        ctx.strokeStyle = `rgba(210,120,255,${0.14*p})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // Q: wall (blue dome)
      if (W && W.active>0){
        const p = clamp(W.active/(wCfg.invulnSec||CFG.wall.invulnSec||1), 0, 1);
        ctx.save();
        const R = 260;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0.0, `rgba(90,190,254,${0.20*p})`);
        g.addColorStop(0.55, `rgba(90,190,254,${0.10*p})`);
        g.addColorStop(1.0, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = `rgba(120,220,255,${0.55*p})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, CFG.core.coreRadius+72, 0, Math.PI*2); ctx.stroke();

        ctx.restore();


// E: energy cannon charging field (gold/blue)
const EC = (s.skill && s.skill.energyCannon) ? s.skill.energyCannon : null;
if (EC && EC.charging){
  const p = clamp((EC.charge||0)/(eCfg.chargeSec||CFG.energyCannon.chargeSec||1), 0, 1);
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  const wob = 1 + 0.03*Math.sin(s.game.time*6.0 + p*3.0);
  // outer ring
  ctx.strokeStyle = `rgba(235,200,90,${0.18 + 0.28*p})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, (CFG.core.coreRadius+66)*wob + p*22, 0, Math.PI*2); ctx.stroke();
  // inner ring
  ctx.strokeStyle = `rgba(90,190,254,${0.10 + 0.18*p})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, (CFG.core.coreRadius+44)*wob, 0, Math.PI*2); ctx.stroke();
  // spokes
  ctx.strokeStyle = `rgba(235,240,250,${0.10 + 0.16*p})`;
  ctx.lineWidth = 2;
  const n=10;
  const rot = s.game.time*1.9;
  for (let i=0;i<n;i++){
    const a = rot + (i/n)*Math.PI*2;
    const r0 = (CFG.core.coreRadius+28);
    const r1 = r0 + 42 + p*18;
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(a)*r0, y+Math.sin(a)*r0);
    ctx.lineTo(x+Math.cos(a)*r1, y+Math.sin(a)*r1);
    ctx.stroke();
  }
  ctx.restore();
}

      }

      if (Assets.towerImg){
        ctx.globalAlpha=0.95;
        ctx.drawImage(Assets.towerImg, x-100, y-100, 200, 200);
      }

      // blue flames (particles)
      drawBlueFlames(ctx, s);

      // Ending cinematic: core resonance / sealing visuals (after final boss kill)
      if (s.game && s.game.phase==="ending"){
        const dur = (s.game.endingDur||4.8);
        const p = clamp(1 - (s.game.endingT||0)/Math.max(0.001, dur), 0, 1);
        const tt = s.game.time||0;
        const isTrue = (s.game.endingType==="true");
        const R0 = (CFG.core.coreRadius||48);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // sweeping rings
        const baseR = R0 + 92;
        const aBase = 0.18 + 0.55*p;
        for (let i=0;i<3;i++){
          const rr = baseR + i*18 + Math.sin(tt*3.2 + i*1.8)*7*(1-p*0.4);
          const rot = tt*(isTrue?1.65:1.35) + i*1.7;
          const span = 0.55 + 0.30*p;
          const a = aBase * (0.92 - i*0.22);
          ctx.strokeStyle = isTrue ? `rgba(255,220,150,${a})` : `rgba(170,200,255,${a})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, rr, rot, rot + Math.PI*2*span);
          ctx.stroke();
        }

        // crack-like spokes (deterministic, no RNG)
        ctx.lineWidth = 2;
        const n = 9;
        for (let j=0;j<n;j++){
          const ang = j*(Math.PI*2/n) + Math.sin(tt*1.7 + j)*0.22;
          const r0 = R0 * 0.45;
          const r1 = R0 + 88;
          const zig = 4;
          ctx.strokeStyle = isTrue ? `rgba(255,245,210,${0.12+0.42*p})` : `rgba(215,235,255,${0.12+0.42*p})`;
          ctx.beginPath();
          for (let k=0;k<=zig;k++){
            const rk = lerp(r0, r1, k/zig) + Math.sin(tt*4.3 + j*1.9 + k*2.1)*6;
            const aa = ang + Math.sin(tt*2.2 + j*0.7 + k)*0.09;
            const px = x + Math.cos(aa)*rk;
            const py = y + Math.sin(aa)*rk;
            if (k===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }

        // soft pulse toward the end
        const flash = Math.max(0, Math.sin(p*Math.PI));
        if (flash>0.01){
          ctx.fillStyle = isTrue ? `rgba(255,235,190,${0.10*flash})` : `rgba(200,225,255,${0.10*flash})`;
          ctx.beginPath();
          ctx.arc(x, y, R0+120, 0, Math.PI*2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (!Assets.towerImg) {

        ctx.fillStyle="rgba(90,190,254,0.35)";
        ctx.beginPath();
        ctx.moveTo(x, y-90); ctx.lineTo(x+78,y); ctx.lineTo(x,y+90); ctx.lineTo(x-78,y);
        ctx.closePath(); ctx.fill();
      }

      ctx.fillStyle="rgba(90,190,254,0.95)";
      ctx.font="14px system-ui, sans-serif";
      ctx.restore();
    },
    draw(s){
      if (s.game.phase==="rewind"){ Render.drawRewind(s); return; }
      Render.clear();
      const ctx=Render.ctx;
      // camera shake
      const shakeActive = (s.camera && s.camera.shakeT>0);
      if (shakeActive){
        const p = clamp(s.camera.shakeT/0.45, 0, 1);
        const mag = s.camera.shakeMag * p;
        const sx = (Math.random()-0.5)*mag;
        const sy = (Math.random()-0.5)*mag;
        ctx.save();
        ctx.translate(sx, sy);
      }

      // core
      Render.drawCore(s);

      // turrets
      // cleaner, more "tower-defense" look (metal base + crystal head)
      const poly=(cx,cy,rad,sides,rot=0)=>{
        ctx.beginPath();
        for (let i=0;i<sides;i++){
          const a = rot + (i/sides)*Math.PI*2;
          const x = cx + Math.cos(a)*rad;
          const y = cy + Math.sin(a)*rad;
          if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath();
      };

      for (const t of s.entities.turrets){
        ctx.save();

        // selected ring
        if (s.ui && s.ui.selectedTurretId!=null && t.id===s.ui.selectedTurretId){
          ctx.strokeStyle = "rgba(255,220,120,0.85)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 44, 0, Math.PI*2);
          ctx.stroke();
        }

        // shadow
        ctx.fillStyle="rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y+20, 34, 14, 0, 0, Math.PI*2);
        ctx.fill();

        // base (hex metal)
        const metal = ctx.createLinearGradient(t.x-30, t.y-30, t.x+30, t.y+30);
        metal.addColorStop(0, "rgba(28,34,50,0.98)");
        metal.addColorStop(0.55, "rgba(16,20,32,0.98)");
        metal.addColorStop(1, "rgba(40,46,66,0.98)");

        ctx.fillStyle=metal;
        ctx.strokeStyle="rgba(180,190,215,0.55)";
        ctx.lineWidth=2;
        poly(t.x, t.y+10, 28, 6, Math.PI/6);
        ctx.fill(); ctx.stroke();

        // gold trims
        ctx.strokeStyle="rgba(235,200,90,0.55)";
        ctx.lineWidth=2;
        poly(t.x, t.y+10, 20, 6, Math.PI/6);
        ctx.stroke();

        // top pedestal
        ctx.fillStyle="rgba(12,14,22,0.9)";
        ctx.strokeStyle="rgba(140,150,175,0.55)";
        rrPath(ctx, t.x-16, t.y-12, 32, 22, 10);
        ctx.fill(); ctx.stroke();

// ===== turret head / weapon (reads like an actual turret) =====
const hasAim = (t.aimX!=null && t.aimY!=null);
const ax = hasAim ? t.aimX : t.x;
const ay = hasAim ? t.aimY : (t.y - 200);
const dx = ax - t.x, dy = ay - (t.y - 4);
const len = Math.hypot(dx,dy) || 1;
const nx = dx/len, ny = dy/len;
const ang = Math.atan2(ny, nx);

// level pips (6 slots)
const slots = 6;
const fillN = Math.max(1, Math.min(slots, (t.lv||1)));
ctx.save();
for (let i=0;i<slots;i++){
  const a = -Math.PI/2 + i*(Math.PI*2/slots);
  ctx.globalAlpha = (i<fillN) ? 0.85 : 0.18;
  ctx.fillStyle = (t.type==="slow") ? "rgba(120,240,230,0.95)"
               : (t.type==="splash") ? "rgba(255,170,90,0.95)"
               : "rgba(90,190,254,0.95)";
  ctx.beginPath();
  ctx.arc(t.x + Math.cos(a)*22, t.y+10 + Math.sin(a)*22, 2.2, 0, Math.PI*2);
  ctx.fill();
}
ctx.restore();

// shot recoil + muzzle flash timer
const sf = clamp((t.shotFlash||0)/0.10, 0, 1);
const recoil = sf * ((t.type==="splash") ? 6 : 4);

// rotate and draw gun housing + barrel
ctx.save();
ctx.translate(t.x, t.y-4);
ctx.rotate(ang);

// housing block
const hW = (t.type==="splash") ? 32 : 28;
const hH = 22;
ctx.fillStyle="rgba(18,22,34,0.96)";
ctx.strokeStyle="rgba(170,180,205,0.55)";
ctx.lineWidth=2;
rrPath(ctx, -hW*0.45, -hH*0.55, hW, hH, 10);
ctx.fill(); ctx.stroke();

// small side fins (adds silhouette)
ctx.fillStyle="rgba(12,14,22,0.85)";
ctx.beginPath();
ctx.moveTo(-6, -11); ctx.lineTo(-16, -4); ctx.lineTo(-6, -4);
ctx.closePath(); ctx.fill();
ctx.beginPath();
ctx.moveTo(-6, 11); ctx.lineTo(-16, 4); ctx.lineTo(-6, 4);
ctx.closePath(); ctx.fill();

// energy core inset (keeps "crystal" identity without making it the whole turret)
const coreGrad = ctx.createLinearGradient(-8, -12, 8, 12);
if (t.type==="slow"){
  coreGrad.addColorStop(0, "rgba(230,255,255,0.95)");
  coreGrad.addColorStop(0.55, "rgba(120,240,230,0.95)");
  coreGrad.addColorStop(1, "rgba(40,160,170,0.95)");
} else if (t.type==="splash"){
  coreGrad.addColorStop(0, "rgba(255,245,230,0.95)");
  coreGrad.addColorStop(0.55, "rgba(255,170,90,0.95)");
  coreGrad.addColorStop(1, "rgba(210,90,40,0.95)");
} else {
  coreGrad.addColorStop(0, "rgba(220,250,255,0.95)");
  coreGrad.addColorStop(0.55, "rgba(90,190,254,0.95)");
  coreGrad.addColorStop(1, "rgba(40,110,210,0.95)");
}
ctx.fillStyle=coreGrad;
ctx.strokeStyle="rgba(255,255,255,0.22)";
ctx.lineWidth=1.5;
poly(0, 0, 7.5, 6, Math.PI/6);
ctx.fill(); ctx.stroke();

// barrel / emitter by type
if (t.type==="slow"){
  // twin prongs + emitter orb
  ctx.strokeStyle="rgba(200,255,250,0.85)";
  ctx.lineWidth=3;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(6-recoil, -5); ctx.lineTo(26-recoil, -9);
  ctx.moveTo(6-recoil,  5); ctx.lineTo(26-recoil,  9);
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.globalAlpha = 0.55 + 0.30*sf;
  ctx.fillStyle="rgba(120,240,230,0.65)";
  ctx.beginPath(); ctx.arc(30-recoil, 0, 6.8, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle="rgba(255,255,255,0.55)";
  ctx.beginPath(); ctx.arc(30-recoil, -1, 2.6, 0, Math.PI*2); ctx.fill();
  ctx.restore();
} else if (t.type==="splash"){
  // thick cannon + muzzle ring
  ctx.fillStyle="rgba(12,14,22,0.88)";
  ctx.strokeStyle="rgba(235,240,250,0.55)";
  ctx.lineWidth=2;
  rrPath(ctx, 6-recoil, -6, 26, 12, 6);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle="rgba(255,220,180,0.70)";
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(34-recoil, 0, 7.6, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle="rgba(10,14,22,0.85)";
  ctx.beginPath(); ctx.arc(34-recoil, 0, 4.0, 0, Math.PI*2); ctx.fill();
} else {
  // basic rifle barrel + tip
  ctx.fillStyle="rgba(12,14,22,0.88)";
  ctx.strokeStyle="rgba(235,240,250,0.55)";
  ctx.lineWidth=2;
  rrPath(ctx, 6-recoil, -4, 28, 8, 5);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle="rgba(90,190,254,0.55)";
  ctx.beginPath(); ctx.arc(36-recoil, 0, 3.4, 0, Math.PI*2); ctx.fill();
}

// muzzle flash on shot
if (sf>0.001){
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.22 + 0.26*sf;
  ctx.fillStyle = "rgba(255,245,220,0.85)";
  const mr = (t.type==="splash") ? 12 : (t.type==="slow") ? 10 : 9;
  ctx.beginPath(); ctx.arc((t.type==="slow"?30:(t.type==="splash"?34:36)) - recoil, 0, mr*(0.55+0.45*sf), 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// overheat heat-arcs (readable, not noisy)
if (t.overheatT && t.overheatT>0){
  const op = clamp(t.overheatT/2.5, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.globalAlpha = 0.12 + 0.18*op;
  ctx.strokeStyle="rgba(255,140,80,0.85)";
  ctx.lineWidth=2;
  const rr = 18 + 6*(1-op);
  ctx.beginPath(); ctx.arc(0,0, rr, 0.2, 1.7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0, rr+6, 3.4, 4.9); ctx.stroke();
  ctx.restore();
}

ctx.restore();
        // subtle pulse ring when fighting
        if (s.game.phase==="wave"){
          const p = (Math.sin(s.game.time*6)+1)/2; // 0..1
          ctx.globalAlpha = 0.18 + p*0.10;
          ctx.strokeStyle="rgba(90,190,254,0.55)";
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 44 + p*6, 0, Math.PI*2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // overload aura hint
        if (s.passives.selected==="overload"){
          ctx.strokeStyle="rgba(255,170,90,0.34)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(t.x,t.y,64,0,Math.PI*2); ctx.stroke();
        }

        // turret HP bar (shown only when damaged)
        if (t.hp!=null && t.hpMax!=null && t.hp < t.hpMax-0.001){
          const w=58, h=7;
          const x=t.x - w/2;
          const y=t.y - 54;
          const ratio = clamp(t.hp/t.hpMax, 0, 1);
          ctx.fillStyle="rgba(10,14,22,0.85)";
          rrPath(ctx, x, y, w, h, 3); ctx.fill();
          ctx.fillStyle="rgba(90,190,254,0.90)";
          rrPath(ctx, x+1, y+1, (w-2)*ratio, h-2, 2); ctx.fill();
        }

        ctx.restore();
      }

// enemies
      for (const e of s.entities.enemies){
        // death pop
        if (e.hp<=0){
          if (e.deathT>0){
            const p = e.deathT/0.35;
            ctx.save();
            ctx.globalAlpha = 0.60*p;
            ctx.strokeStyle="rgba(90,190,254,0.55)";
            ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(e.x,e.y, e.r + (1-p)*18, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
          }
          continue;
        }

        ctx.save();

        const kind = e.kind || "normal";
        const flash = (e.hitFlash||0)>0 ? (e.hitFlash/0.10) : 0;

        // palette by kind (more distinct than plain circles)
        const pal = {
          normal: {a:"rgba(240,90,90,0.95)", glow:"rgba(240,90,90,0.35)"},
          fast:   {a:"rgba(120,240,230,0.95)", glow:"rgba(120,240,230,0.35)"},
          tank:   {a:"rgba(255,170,90,0.95)", glow:"rgba(255,170,90,0.30)"},
          elite:  {a:"rgba(190,140,255,0.95)", glow:"rgba(190,140,255,0.30)"},
          ranged: {a:"rgba(255,230,140,0.95)", glow:"rgba(255,230,140,0.30)"},
          bomber: {a:"rgba(255,120,170,0.95)", glow:"rgba(255,120,170,0.28)"},
          disruptor:{a:"rgba(170,255,170,0.95)", glow:"rgba(170,255,170,0.28)"},
          supporter:{a:"rgba(90,190,254,0.95)", glow:"rgba(90,190,254,0.26)"},
          splitter:{a:"rgba(170,170,255,0.95)", glow:"rgba(170,170,255,0.24)"},
          splitling:{a:"rgba(140,140,255,0.95)", glow:"rgba(140,140,255,0.22)"},
          sniper:{a:"rgba(255,210,110,0.95)", glow:"rgba(255,210,110,0.26)"},
          leech:{a:"rgba(190,110,255,0.95)", glow:"rgba(190,110,255,0.28)"},
          armored:{a:"rgba(200,210,220,0.95)", glow:"rgba(200,210,220,0.20)"},
          meteor:{a:"rgba(255,120,70,0.95)", glow:"rgba(255,120,70,0.28)"},
          boss:   {a:"rgba(255,140,100,0.95)", glow:"rgba(255,140,100,0.34)"}
        };
        const P = pal[kind] || pal.normal;

        // outer glow
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = P.glow;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r+10, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;

        // body shading
        const g = ctx.createRadialGradient(e.x-6, e.y-8, 2, e.x, e.y, e.r*1.25);
        g.addColorStop(0, "rgba(255,255,255,0.92)");
        g.addColorStop(0.35, P.a);
        g.addColorStop(1, "rgba(10,14,22,0.12)");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(20,26,40,0.88)";
        ctx.lineWidth = 2;

        if (flash>0){
          ctx.shadowColor = "rgba(255,255,255,0.65)";
          ctx.shadowBlur = 18*flash;
        }

        // shape per kind
        if (kind==="fast"){
          const rot = Math.atan2(e.vy||0, e.vx||1);
          poly(e.x, e.y, e.r, 3, rot); // dart
          ctx.fill(); ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(220,255,255,0.35)";
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(e.x - Math.cos(rot)*22, e.y - Math.sin(rot)*22);
          ctx.lineTo(e.x - Math.cos(rot)*38, e.y - Math.sin(rot)*38);
          ctx.stroke();

        } else if (kind==="tank"){
          rrPath(ctx, e.x-e.r, e.y-e.r, e.r*2, e.r*2, 10);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle="rgba(14,18,28,0.65)";
          rrPath(ctx, e.x-e.r+5, e.y-e.r+5, e.r*2-10, e.r*2-10, 8);
          ctx.fill();

          ctx.fillStyle="rgba(235,240,250,0.35)";
          for (const ox of [-e.r+6, e.r-6]){
            for (const oy of [-e.r+6, e.r-6]){
              ctx.beginPath(); ctx.arc(e.x+ox, e.y+oy, 2.2, 0, Math.PI*2); ctx.fill();
            }
          }

        } else if (kind==="elite"){
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();

          ctx.shadowBlur = 0;
          const ang = s.game.time*1.8;
          ctx.strokeStyle="rgba(230,210,255,0.55)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+7,0,Math.PI*2); ctx.stroke();

          ctx.strokeStyle="rgba(190,140,255,0.45)";
          ctx.lineWidth=3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r+12, ang, ang+Math.PI*1.15);
          ctx.stroke();

          ctx.fillStyle="rgba(230,210,255,0.60)";
          for (let i=0;i<3;i++){
            const a = ang + i*(Math.PI*2/3);
            ctx.beginPath();
            ctx.arc(e.x+Math.cos(a)*(e.r+12), e.y+Math.sin(a)*(e.r+12), 3.2, 0, Math.PI*2);
            ctx.fill();
          }

        
        } else if (kind==="supporter"){
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();

          ctx.shadowBlur = 0;
          // aura hint
          const R = e.auraRadius || 180;
          ctx.strokeStyle="rgba(90,190,254,0.14)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y, R, 0, Math.PI*2); ctx.stroke();

          ctx.strokeStyle="rgba(90,190,254,0.55)";
          ctx.lineWidth=3;
          const ang = s.game.time*1.6;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+10, ang, ang+Math.PI*1.25); ctx.stroke();

          // plus sign
          ctx.fillStyle="rgba(235,240,250,0.55)";
          ctx.fillRect(e.x-1.6, e.y-7.5, 3.2, 15);
          ctx.fillRect(e.x-7.5, e.y-1.6, 15, 3.2);

        } else if (kind==="splitter"){
          poly(e.x, e.y, e.r, 6, s.game.time*0.35);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(200,200,255,0.55)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+9, 0, Math.PI*2); ctx.stroke();

        } else if (kind==="splitling"){
          poly(e.x, e.y, e.r, 5, s.game.time*0.9);
          ctx.fill(); ctx.stroke();

        } else if (kind==="armored"){
          rrPath(ctx, e.x-e.r, e.y-e.r, e.r*2, e.r*2, 6);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(235,240,250,0.28)";
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(e.x-e.r+7, e.y); ctx.lineTo(e.x+e.r-7, e.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(e.x, e.y-e.r+7); ctx.lineTo(e.x, e.y+e.r-7); ctx.stroke();

        } else if (kind==="meteor"){
          poly(e.x, e.y, e.r, 8, s.game.time*0.8);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          const rot = Math.atan2(s.core.y-e.y, s.core.x-e.x);
          ctx.strokeStyle="rgba(255,230,200,0.40)";
          ctx.lineWidth=3;
          ctx.beginPath();
          ctx.moveTo(e.x - Math.cos(rot)*8, e.y - Math.sin(rot)*8);
          ctx.lineTo(e.x - Math.cos(rot)*36, e.y - Math.sin(rot)*36);
          ctx.stroke();
          ctx.strokeStyle="rgba(255,120,70,0.45)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+11, rot-0.8, rot+0.8); ctx.stroke();

        } else if (kind==="leech"){
          const rot = Math.atan2(s.core.y-e.y, s.core.x-e.x);
          poly(e.x, e.y, e.r, 3, rot);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(255,230,255,0.30)";
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(e.x+Math.cos(rot)*6, e.y+Math.sin(rot)*6);
          ctx.lineTo(e.x+Math.cos(rot)*20, e.y+Math.sin(rot)*20);
          ctx.stroke();
} else if (kind==="ranged"){
          // triangular shooter
          const rot = Math.atan2(s.core.y-e.y, s.core.x-e.x);
          poly(e.x, e.y, e.r, 3, rot);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(255,255,255,0.40)";
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(e.x+Math.cos(rot)*8, e.y+Math.sin(rot)*8);
          ctx.lineTo(e.x+Math.cos(rot)*20, e.y+Math.sin(rot)*20);
          ctx.stroke();

        
        } else if (kind==="sniper"){
          // long-range shooter
          const rot = Math.atan2(s.core.y-e.y, s.core.x-e.x);
          poly(e.x, e.y, e.r, 3, rot);
          ctx.fill(); ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(255,240,210,0.45)";
          ctx.lineWidth=2.5;
          ctx.beginPath();
          ctx.moveTo(e.x+Math.cos(rot)*10, e.y+Math.sin(rot)*10);
          ctx.lineTo(e.x+Math.cos(rot)*30, e.y+Math.sin(rot)*30);
          ctx.stroke();

          ctx.strokeStyle="rgba(255,210,110,0.45)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+10, rot-0.9, rot+0.9); ctx.stroke();
} else if (kind==="disruptor"){
          // diamond with arc
          poly(e.x, e.y, e.r, 4, Math.PI/4);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          const ang = s.game.time*2.3;
          ctx.strokeStyle="rgba(200,255,200,0.55)";
          ctx.lineWidth=3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r+10, ang, ang+Math.PI*1.3);
          ctx.stroke();

        } else if (kind==="bomber"){
          // round with spikes
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(255,200,220,0.60)";
          ctx.lineWidth=3;
          for (let i=0;i<6;i++){
            const a=i*(Math.PI*2/6)+s.game.time*0.8;
            ctx.beginPath();
            ctx.moveTo(e.x+Math.cos(a)*e.r, e.y+Math.sin(a)*e.r);
            ctx.lineTo(e.x+Math.cos(a)*(e.r+14), e.y+Math.sin(a)*(e.r+14));
            ctx.stroke();
          }

        } else if (kind==="boss"){
          poly(e.x, e.y, e.r, 8, Math.PI/8);
          ctx.fill(); ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.strokeStyle="rgba(255,210,190,0.55)";
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+10,0,Math.PI*2); ctx.stroke();

          ctx.strokeStyle="rgba(255,140,100,0.45)";
          ctx.lineWidth=3;
          for (let i=0;i<4;i++){
            const a=i*Math.PI/2 + s.game.time*0.3;
            ctx.beginPath();
            ctx.moveTo(e.x+Math.cos(a)*e.r, e.y+Math.sin(a)*e.r);
            ctx.lineTo(e.x+Math.cos(a)*(e.r+18), e.y+Math.sin(a)*(e.r+18));
            ctx.stroke();
          }



          // FINAL BOSS resonance overlay (no extra sprites)
          if (e.isFinalBoss){
            const ph = e.fbPhase || 1;
            const tt = s.game.time;
            const ringN = (ph>=2) ? 2 : 1;
            const baseR = e.r + 12;

            ctx.save();
            // subtle rotating ring segments (reads as "powered" without heavy glow)
            ctx.globalCompositeOperation = 'lighter';
            for (let k=0;k<ringN;k++){
              const sp = (ph>=3?0.95:0.75) + k*0.18;
              const ang = tt*sp + k*Math.PI*0.6;
              const rr  = baseR + k*12 + Math.sin(tt*1.1 + k)*2.0;

              ctx.globalAlpha = (ph>=3?0.30:0.22);
              ctx.strokeStyle = 'rgba(255,200,180,0.55)';
              ctx.lineWidth = 2.2;
              ctx.beginPath(); ctx.arc(e.x,e.y, rr, ang, ang+Math.PI*1.15); ctx.stroke();

              ctx.globalAlpha = (ph>=3?0.20:0.16);
              ctx.strokeStyle = 'rgba(255,200,180,0.40)';
              ctx.lineWidth = 1.6;
              ctx.beginPath(); ctx.arc(e.x,e.y, rr+6, ang+Math.PI*0.9, ang+Math.PI*1.55); ctx.stroke();
            }

            // shot pulse (quick, clean)
            const sf = (e.fbShotFlash||0)>0 ? (e.fbShotFlash/0.12) : 0;
            if (sf>0){
              const p = 1-sf;
              ctx.globalAlpha = 0.35*sf;
              ctx.strokeStyle = 'rgba(255,235,210,0.75)';
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(e.x,e.y, e.r+10 + p*18, 0, Math.PI*2); ctx.stroke();
            }

            // crack lines (structure change; avoids big glow)
            ctx.globalCompositeOperation = 'source-over';
            const ca = (ph===1)?0.20:(ph===2)?0.28:0.36;
            const rot = tt*0.12;
            const cracks = [0.55, 1.95, 3.35, 4.55];

            ctx.globalAlpha = ca;
            ctx.strokeStyle = 'rgba(22,28,44,0.75)';
            ctx.lineWidth = 2;
            for (let i=0;i<cracks.length;i++){
              const a = cracks[i] + rot;
              const r0 = e.r*0.18;
              const r1 = e.r*0.96;
              const b  = a + (i%2?0.55:-0.55);
              ctx.beginPath();
              ctx.moveTo(e.x + Math.cos(a)*r0, e.y + Math.sin(a)*r0);
              ctx.lineTo(e.x + Math.cos(a)*r1, e.y + Math.sin(a)*r1);
              ctx.lineTo(e.x + Math.cos(b)*(e.r*0.58), e.y + Math.sin(b)*(e.r*0.58));
              ctx.stroke();
            }

            // faint highlight along cracks
            ctx.globalAlpha = ca*0.55;
            ctx.strokeStyle = 'rgba(255,220,190,0.28)';
            ctx.lineWidth = 1.2;
            for (let i=0;i<cracks.length;i++){
              const a = cracks[i] + rot;
              const r0 = e.r*0.20;
              const r1 = e.r*0.86;
              ctx.beginPath();
              ctx.moveTo(e.x + Math.cos(a)*r0, e.y + Math.sin(a)*r0);
              ctx.lineTo(e.x + Math.cos(a)*r1, e.y + Math.sin(a)*r1);
              ctx.stroke();
            }

            ctx.restore();
          }
        } else {
          // normal = shard
          poly(e.x, e.y, e.r, 6, 0);
          ctx.fill(); ctx.stroke();
        }

        // inner "eye"/core
        ctx.shadowBlur = 0;
        ctx.fillStyle="rgba(12,14,22,0.55)";
        ctx.beginPath(); ctx.arc(e.x-4, e.y-2, 5.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(235,240,250,0.80)";
        ctx.beginPath(); ctx.arc(e.x-2, e.y-3, 1.8, 0, Math.PI*2); ctx.fill(); 

        // temp shield indicator (from Shield Supporter)
        if (e.tempSh && e.tempSh>0){
          const shr = clamp(e.tempSh / Math.max(1e-6, (e.tempShMax||e.tempSh)), 0, 1);

          ctx.strokeStyle="rgba(90,190,254,0.55)";
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(e.x,e.y,e.r+15,0,Math.PI*2); ctx.stroke();

          const shw = e.isBoss ? 86 : 62;
          const shh = 6;
          const sx = e.x - shw/2;
          const sy = e.y - e.r - 28;
          ctx.fillStyle="rgba(10,14,22,0.75)";
          rrPath(ctx, sx, sy, shw, shh, 5); ctx.fill();
          ctx.fillStyle="rgba(90,190,254,0.85)";
          rrPath(ctx, sx+1.5, sy+1.5, (shw-3)*shr, shh-3, 4); ctx.fill();
        }

        // small HP bar
        const hpw = e.isBoss ? 86 : 62;
        const hph = 8;
        const hx = e.x - hpw/2;
        const hy = e.y - e.r - 18;
        const ratio = Math.max(0, Math.min(1, e.hp / e.hpMax));

        ctx.fillStyle="rgba(10,14,22,0.85)";
        ctx.strokeStyle="rgba(110,130,170,0.75)";
        ctx.lineWidth=2;
        rrPath(ctx, hx, hy, hpw, hph, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = kind==="boss" ? "rgba(255,140,100,0.95)" : "rgba(240,90,90,0.85)";
        rrPath(ctx, hx+2, hy+2, (hpw-4)*ratio, hph-4, 5);
        ctx.fill();

        if (e.isBoss){
          ctx.fillStyle="rgba(255,200,170,0.95)";
          ctx.font="12px system-ui, sans-serif";
          ctx.fillText(e.isFinalBoss?"FINAL":"BOSS", hx+hpw+6, hy+8);
        }

        // overload mark
        if (e.mark>0){
          ctx.fillStyle="rgba(14,18,28,0.9)";
          ctx.strokeStyle="rgba(235,200,90,0.65)";
          ctx.lineWidth=2;
          rrPath(ctx, e.x-28, e.y-68, 56, 20, 10);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle="rgba(235,200,90,0.95)";
          ctx.font="13px system-ui, sans-serif";
          ctx.fillText(`표식 ${e.mark}/5`, e.x-20, e.y-54);
        }

        // Meteor countdown
        if (kind==="meteor" && !e.meteorFired){
          const ttl = (e.meteorDelay||8.0);
          const left = Math.max(0, ttl - (e.meteorT||0));
          ctx.fillStyle="rgba(14,18,28,0.90)";
          ctx.strokeStyle="rgba(255,160,90,0.75)";
          ctx.lineWidth=2;
          rrPath(ctx, e.x-34, e.y-92, 68, 20, 10);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle="rgba(255,200,160,0.95)";
          ctx.font="13px system-ui, sans-serif";
          const isCh = (e.meteorIsChanneler!==false);
          if (isCh){
            ctx.fillText(`운석 ${fmt1(left)}s`, e.x-28, e.y-78);
          } else {
            ctx.fillText(`대기`, e.x-12, e.y-78);
          }
        }

        ctx.restore();
      }

// projectiles
      for (const p of s.entities.projectiles){
        // projectile trail
        ctx.save();
        const fillC = p.tint ? p.tint : ((p.from==="core")?"rgba(120,220,210,0.95)":"rgba(235,240,250,0.95)");
        const trailC = p.tint ? p.tint.replace("0.95)", "0.25)") : ((p.from==="core")?"rgba(120,220,210,0.35)":"rgba(235,240,250,0.25)");
        ctx.strokeStyle=trailC;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x - p.vx*0.02, p.y - p.vy*0.02);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle=fillC;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // fx
      for (const fx of s.entities.fx){
        ctx.save();
        if (fx.type==="kill"){
          const t=fx.t/0.22;
          ctx.strokeStyle=`rgba(70,220,120,${0.55*t})`;
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 18 + (1-t)*18, 0, Math.PI*2); ctx.stroke();
        } else if (fx.type==="coreFlash"){
          const t=fx.t/0.35;
          ctx.fillStyle=`rgba(235,240,250,${0.55*t})`;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 80 + (1-t)*180, 0, Math.PI*2); ctx.fill();
        } else if (fx.type==="coreHit"){
          const t=fx.t/0.12;
          ctx.strokeStyle=`rgba(90,190,254,${0.35*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 52 + (1-t)*26, 0, Math.PI*2); ctx.stroke();
        
        } else if (fx.type==="supportPulse"){
          const t=fx.t/0.35;
          ctx.strokeStyle=`rgba(90,190,254,${0.20*t})`;
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, (fx.r||180) - (1-t)*28, 0, Math.PI*2); ctx.stroke();
        } else if (fx.type==="shBlock"){
          const t=fx.t/0.14;
          ctx.strokeStyle=`rgba(90,190,254,${0.40*t})`;
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 16 + (1-t)*10, 0, Math.PI*2); ctx.stroke();
        } else if (fx.type==="leechHit"){
          const t=fx.t/0.30;
          ctx.strokeStyle=`rgba(190,110,255,${0.28*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 70 + (1-t)*80, 0, Math.PI*2); ctx.stroke();

        } else if (fx.type==="wallCast"){
          const t=fx.t/0.45;
          ctx.strokeStyle=`rgba(90,190,254,${0.35*t})`;
          ctx.lineWidth=5;
          for (const rr of [90, 150, 210]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y, rr*(1+(1-t)*0.28), 0, Math.PI*2); ctx.stroke();
          }
        } else if (fx.type==="wallBlock"){
          const t=fx.t/0.22;
          ctx.strokeStyle=`rgba(120,220,255,${0.60*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 92 + (1-t)*22, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(235,240,250,${0.45*t})`;
          ctx.lineWidth=2;
          for (let i=0;i<7;i++){
            const a=i*(Math.PI*2/7) + (1-t)*1.6;
            ctx.beginPath();
            ctx.moveTo(fx.x+Math.cos(a)*62, fx.y+Math.sin(a)*62);
            ctx.lineTo(fx.x+Math.cos(a)*108, fx.y+Math.sin(a)*108);
            ctx.stroke();
          }
        } else if (fx.type==="wallReflect"){
          const ttl = 0.35;
          const t=clamp(fx.t/ttl,0,1);
          const R=fx.r||200;
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle=`rgba(120,220,255,${0.62*t})`;
          ctx.lineWidth=6;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1+(1-t)*0.08), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(235,240,250,${0.42*t})`;
          ctx.lineWidth=2;
          for (let i=0;i<10;i++){
            const a=i*(Math.PI*2/10) + (1-t)*2.1;
            ctx.beginPath();
            ctx.moveTo(fx.x+Math.cos(a)*(R*0.62), fx.y+Math.sin(a)*(R*0.62));
            ctx.lineTo(fx.x+Math.cos(a)*(R*1.02), fx.y+Math.sin(a)*(R*1.02));
            ctx.stroke();
          }
        } else if (fx.type==="timeWarpCast"){
          const t=fx.t/0.65;
          ctx.strokeStyle=`rgba(210,120,255,${0.35*t})`;
          ctx.lineWidth=4;
          const wob = (1-t)*0.12;
          for (const rr of [110, 170, 235]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y, rr*(1+wob), 0, Math.PI*2); ctx.stroke();
          }
          ctx.strokeStyle=`rgba(120,40,220,${0.28*t})`;
          ctx.lineWidth=2;
          for (const rr of [140, 205]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y, rr*(1+wob*1.2), 0, Math.PI*2); ctx.stroke();
          }
        
        } else if (fx.type==="energyChargeCast"){
          const t=fx.t/0.55;
          ctx.save();
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle=`rgba(235,200,90,${0.40*t})`;
          ctx.lineWidth=5;
          for (const rr of [120, 180, 245]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y, rr*(1+(1-t)*0.20), 0, Math.PI*2); ctx.stroke();
          }
          ctx.strokeStyle=`rgba(90,190,254,${0.22*t})`;
          ctx.lineWidth=3;
          for (const rr of [150, 215]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y, rr*(1+(1-t)*0.24), 0, Math.PI*2); ctx.stroke();
          }
          ctx.restore();


} else if (fx.type==="meteorWarn"){

          const ttl = fx.ttl || 0.85;
          const t=clamp(fx.t/ttl,0,1);
          const R=fx.r||260;
          ctx.globalCompositeOperation="lighter";
          ctx.fillStyle=`rgba(255,120,70,${0.10*t})`;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*0.92, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle=`rgba(255,200,160,${0.35*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1+(1-t)*0.06), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,120,70,${0.22*t})`;
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*0.62*(1+(1-t)*0.12), 0, Math.PI*2); ctx.stroke();

} else if (fx.type==="meteorImpact"){

          const ttl = fx.ttl || 0.65;
          const t=clamp(fx.t/ttl,0,1);
          const R=fx.r||320;
          ctx.globalCompositeOperation="lighter";
          ctx.fillStyle=`rgba(255,160,90,${0.16*t})`;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1-(1-t)*0.08), 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle=`rgba(255,240,220,${0.50*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1+(1-t)*0.20), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,120,70,${0.35*t})`;
          ctx.lineWidth=6;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*0.62*(1+(1-t)*0.30), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,240,220,${0.24*t})`;
          ctx.lineWidth=2;
          for (let i=0;i<10;i++){
            const a=i*(Math.PI*2/10)+(1-t)*1.2;
            ctx.beginPath();
            ctx.moveTo(fx.x+Math.cos(a)*R*0.35, fx.y+Math.sin(a)*R*0.35);
            ctx.lineTo(fx.x+Math.cos(a)*R*0.95, fx.y+Math.sin(a)*R*0.95);
            ctx.stroke();
          }


} else if (fx.type==="fbPhase"){

          const ttl = fx.ttl || 0.65;
          const t=clamp(fx.t/ttl,0,1);
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle=`rgba(255,150,190,${0.35*t})`;
          ctx.lineWidth=5;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 210*(1+(1-t)*0.10), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,220,240,${0.18*t})`;
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 270*(1+(1-t)*0.16), 0, Math.PI*2); ctx.stroke();

} else if (fx.type==="fbLaserTele"){

          const ttl = fx.ttl || 0.75;
          const t=clamp(fx.t/ttl,0,1);
          const a0 = fx.ang||0;
          const a1 = a0 + Math.PI*0.5;
          const L = 2400;
          ctx.globalCompositeOperation="lighter";
          ctx.setLineDash([10, 10]);
          ctx.strokeStyle=`rgba(255,160,200,${0.18*t})`;
          ctx.lineWidth=4;
          for (const a of [a0,a1]){
            const cx=Math.cos(a), sy=Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(fx.x - cx*L, fx.y - sy*L);
            ctx.lineTo(fx.x + cx*L, fx.y + sy*L);
            ctx.stroke();
          }
          ctx.setLineDash([]);

} else if (fx.type==="fbLaserFire"){

          const ttl = fx.ttl || 1.0;
          const t=clamp(fx.t/ttl,0,1);
          const a0 = fx.ang||0;
          const a1 = a0 + Math.PI*0.5;
          const L = 2400;
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle=`rgba(255,120,170,${0.35*t})`;
          ctx.lineWidth=10;
          for (const a of [a0,a1]){
            const cx=Math.cos(a), sy=Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(fx.x - cx*L, fx.y - sy*L);
            ctx.lineTo(fx.x + cx*L, fx.y + sy*L);
            ctx.stroke();
          }
          ctx.strokeStyle=`rgba(255,230,245,${0.16*t})`;
          ctx.lineWidth=3;
          for (const a of [a0,a1]){
            const cx=Math.cos(a), sy=Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(fx.x - cx*L, fx.y - sy*L);
            ctx.lineTo(fx.x + cx*L, fx.y + sy*L);
            ctx.stroke();
          }

} else if (fx.type==="fbZoneTele"){

          const ttl = fx.ttl || 0.90;
          const t=clamp(fx.t/ttl,0,1);
          const R=fx.r||560;
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle=`rgba(255,160,200,${0.22*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1+(1-t)*0.02), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,230,245,${0.12*t})`;
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*0.70*(1+(1-t)*0.06), 0, Math.PI*2); ctx.stroke();

} else if (fx.type==="fbZone"){

          const ttl = fx.ttl || 4.0;
          const t=clamp(fx.t/ttl,0,1);
          const R=fx.r||560;
          ctx.globalCompositeOperation="lighter";
          ctx.fillStyle=`rgba(255,120,170,${0.04 + 0.06*t})`;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle=`rgba(255,160,200,${0.22*t})`;
          ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*(1+0.01*Math.sin((1-t)*8.0)), 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,230,245,${0.10*t})`;
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, R*0.62, 0, Math.PI*2); ctx.stroke();



} else if (fx.type==="shock"){

          const t=fx.t/0.5;
          ctx.strokeStyle=`rgba(90,190,254,${0.35*t})`;
          ctx.lineWidth=4;
          for (const rr of [130,180,230]){
            ctx.beginPath(); ctx.arc(fx.x,fx.y,rr*(1+(1-t)*0.1),0,Math.PI*2); ctx.stroke();
          }
        } else if (fx.type==="pulse"){
          const t=fx.t/0.35;
          ctx.strokeStyle=`rgba(235,200,90,${0.35*t})`;
          ctx.lineWidth=5;
          ctx.beginPath(); ctx.arc(fx.x,fx.y,CFG.resonance.pulseRadius*(1+(1-t)*0.05),0,Math.PI*2); ctx.stroke();
        } else if (fx.type==="expl"){
          const t=fx.t/0.22;
          ctx.strokeStyle=`rgba(255,170,90,${0.35*t})`;
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(fx.x,fx.y,fx.r*(1+(1-t)*0.1),0,Math.PI*2); ctx.stroke();
        } else if (fx.type==="crit"){
        const a=clamp(fx.t/0.24, 0, 1);
        const k=1-a;
        const r=(fx.r||48) * (0.55 + 0.85*k);
        ctx.globalAlpha = 0.92*a;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,220,140,0.95)";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "rgba(255,245,210,0.85)";
        const n=8;
        for (let i=0;i<n;i++){
          const ang = i*(TAU/n) + k*1.1;
          const len = (fx.r||48) * (0.45 + 0.65*k);
          const x1 = fx.x + Math.cos(ang)*r*0.55;
          const y1 = fx.y + Math.sin(ang)*r*0.55;
          const x2 = x1 + Math.cos(ang)*len;
          const y2 = y1 + Math.sin(ang)*len;
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        }
        ctx.globalAlpha = 1;

      } else if (fx.type==="turretBreak"){
          const t=fx.t/0.35;
          ctx.strokeStyle=`rgba(235,240,250,${0.55*t})`;
          ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(fx.x,fx.y, 20 + (1-t)*55, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(90,190,254,${0.35*t})`;
          ctx.lineWidth=2;
          for (let i=0;i<5;i++){
            const a=i*(Math.PI*2/5) + (1-t)*1.5;
            ctx.beginPath();
            ctx.moveTo(fx.x+Math.cos(a)*12, fx.y+Math.sin(a)*12);
            ctx.lineTo(fx.x+Math.cos(a)*42, fx.y+Math.sin(a)*42);
            ctx.stroke();
          }
        } else if (fx.type==="beam"){
          const t=fx.t/0.25;
          ctx.strokeStyle=`rgba(235,200,90,${0.85*t})`;
          ctx.lineWidth=6;
          ctx.beginPath(); ctx.moveTo(fx.x1,fx.y1); ctx.lineTo(fx.x2,fx.y2); ctx.stroke();
          ctx.strokeStyle=`rgba(210,120,255,${0.55*t})`;
          ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(fx.x1,fx.y1); ctx.lineTo(fx.x2,fx.y2); ctx.stroke();
        }
        ctx.restore();
      }

      // core break shards
      drawCoreBreak(ctx, s);

      // energy cannon charge VFX (core charging + target lock)
      if (s.skill.energyCannon.charging){
        const sk=s.skill.energyCannon;
        const p=clamp(sk.charge/CFG.energyCannon.chargeSec, 0, 1);
        const tt=s.game.time;

        const targetOk = sk.target && sk.target.hp>0 && s.entities.enemies.includes(sk.target);
        const tgt = targetOk ? sk.target : null;

        const gx=s.core.x, gy=s.core.y;
        const baseR=170;

        ctx.save();
        ctx.globalAlpha = 1;

        // soft glow dome
        ctx.globalCompositeOperation = "lighter";
        const glowR = 220;
        const grad = ctx.createRadialGradient(gx,gy, 30, gx,gy, glowR);
        grad.addColorStop(0, `rgba(235,200,90,${0.10 + 0.25*p})`);
        grad.addColorStop(0.65, `rgba(90,190,254,${0.06 + 0.10*p})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(gx,gy,glowR,0,Math.PI*2); ctx.fill();

        // rotating decorative arcs
        const rot = tt*1.6;
        for (let k=0;k<3;k++){
          const rr = baseR + k*10 + Math.sin(tt*3 + k)*4;
          const a0 = rot + k*2.1;
          const span = 0.65 + 0.35*p;
          ctx.strokeStyle = `rgba(235,200,90,${0.10 + 0.25*p})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(gx,gy, rr, a0, a0 + Math.PI*2*span);
          ctx.stroke();

          ctx.strokeStyle = `rgba(90,190,254,${0.08 + 0.18*p})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(gx,gy, rr-14, -a0*0.9, -a0*0.9 + Math.PI*2*span*0.75);
          ctx.stroke();
        }

        // progress ring (main)
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle="rgba(60,80,120,0.85)";
        ctx.lineWidth=6;
        ctx.beginPath(); ctx.arc(gx,gy,baseR,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle="rgba(235,200,90,0.90)";
        ctx.lineWidth=9;
        ctx.beginPath(); ctx.arc(gx,gy,baseR,-Math.PI/2,-Math.PI/2+Math.PI*2*p); ctx.stroke();

        // outer pulse ring (more visible on mobile)
        ctx.save();
        ctx.globalCompositeOperation="lighter";
        const op = 0.10 + 0.26*p;
        const pr = baseR + 46 + 6*Math.sin(tt*5.0);
        ctx.strokeStyle = `rgba(90,190,254,${op})`;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(gx,gy, pr, 0, Math.PI*2); ctx.stroke();
        ctx.restore();

        // sparks orbiting
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i=0;i<14;i++){
          const a = i*(Math.PI*2/14) + tt*2.3;
          const rr = baseR + 16 + 8*Math.sin(tt*4 + i);
          const x = gx + Math.cos(a)*rr;
          const y = gy + Math.sin(a)*rr;
          const ssz = 2.0 + 2.2*p + 1.2*Math.sin(tt*6+i);
          ctx.fillStyle = `rgba(235,200,90,${0.15 + 0.35*p})`;
          ctx.beginPath(); ctx.arc(x,y, Math.max(1.2, ssz*0.7), 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(90,190,254,${0.08 + 0.18*p})`;
          ctx.beginPath(); ctx.arc(x + Math.cos(a+1.2)*4, y + Math.sin(a+1.2)*4, Math.max(1.0, ssz*0.45), 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        // target lock ring + thin guide beam
        if (tgt){
          const tx=tgt.x, ty=tgt.y;
          const pulse = (Math.sin(tt*10)+1)/2; // 0..1
          ctx.save();
          ctx.globalCompositeOperation="lighter";
          ctx.strokeStyle = `rgba(235,200,90,${0.10 + 0.25*p})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(tx,ty); ctx.stroke();

          const rr = 26 + 10*pulse;
          ctx.strokeStyle = `rgba(235,200,90,${0.25 + 0.45*p})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(tx,ty, rr, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = `rgba(210,120,255,${0.10 + 0.20*p})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(tx,ty, rr+12, 0, Math.PI*2); ctx.stroke();

          // tiny crosshair
          ctx.strokeStyle = `rgba(235,240,250,${0.12 + 0.20*p})`;
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(tx-18,ty); ctx.lineTo(tx-6,ty);
          ctx.moveTo(tx+6,ty); ctx.lineTo(tx+18,ty);
          ctx.moveTo(tx,ty-18); ctx.lineTo(tx,ty-6);
          ctx.moveTo(tx,ty+6); ctx.lineTo(tx,ty+18);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();

        // small label
        ctx.save();
        ctx.fillStyle="rgba(235,240,250,0.70)";
        ctx.font="12px system-ui, sans-serif";
        ctx.fillText(`충전 ${(p*100).toFixed(0)}%`, gx-22, gy-baseR-18);
        ctx.restore();
      }

      if (s.game.phase==="wave") Render.captureWaveFrame(s);

      // ending cinematic overlay (after final boss is defeated)
      if (s.game.phase==="ending"){
        ctx.save();
        const dur = (s.game.endingDur||4.8);
        const p = clamp(1 - (s.game.endingT||0)/Math.max(0.001, dur), 0, 1);
        const a = Math.min(0.40, 0.12 + p*0.28);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.fillRect(0,0,CFG.LOGICAL_W,CFG.LOGICAL_H);

        const isTrue = (s.game.endingType==="true");
        const title = isTrue ? "봉인 가동" : "봉합 가동";
        ctx.fillStyle = "rgba(235,240,250,0.95)";
        ctx.font = "800 56px system-ui, sans-serif";
        const tw = ctx.measureText(title).width;
        ctx.fillText(title, CFG.LOGICAL_W*0.5 - tw*0.5, CFG.LOGICAL_H*0.22);

        ctx.font = "16px system-ui, sans-serif";
        ctx.fillStyle = "rgba(170,185,210,0.92)";
        const sub = isTrue ? "코어 공명이 균열을 완전히 봉인합니다." : "코어가 균열을 안정화합니다.";
        const sw = ctx.measureText(sub).width;
        ctx.fillText(sub, CFG.LOGICAL_W*0.5 - sw*0.5, CFG.LOGICAL_H*0.22 + 32);

        // progress bar
        const cx = CFG.LOGICAL_W*0.5;
        const by = CFG.LOGICAL_H*0.22 + 58;
        const bw = 420, bh = 10;
        ctx.fillStyle = "rgba(170,185,210,0.28)";
        ctx.fillRect(cx-bw*0.5, by, bw, bh);
        ctx.fillStyle = "rgba(235,240,250,0.78)";
        ctx.fillRect(cx-bw*0.5, by, bw*p, bh);

        ctx.restore();
      }

      // gameover/clear overlay
      if (s.game.phase==="gameover" || s.game.phase==="clear"){
        ctx.save();
        const a = Math.min(0.78, 0.22 + s.game.overT*0.42);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.fillRect(0,0,CFG.LOGICAL_W,CFG.LOGICAL_H);

        const isClear = (s.game.phase==="clear");
        const isBad = (!isClear && !!s.game.badEnding && s.game.waveIndex===30);

        ctx.fillStyle = "rgba(235,240,250,0.95)";
        ctx.font = "800 72px system-ui, sans-serif";
        const ending = s.game.endingType || "normal";
        const title = isClear ? (ending==="true" ? "트루 엔딩" : "노멀 엔딩") : (isBad ? "배드 엔딩" : "패배");
        const tw = ctx.measureText(title).width;
        ctx.fillText(title, CFG.LOGICAL_W*0.5 - tw*0.5, CFG.LOGICAL_H*0.30);

        ctx.font = "16px system-ui, sans-serif";
        ctx.fillStyle = "rgba(170,185,210,0.9)";
        const sub = isClear ? "재시작 버튼으로 다시 시작" : "재시작 버튼으로 재도전";
        const sw = ctx.measureText(sub).width;
        ctx.fillText(sub, CFG.LOGICAL_W*0.5 - sw*0.5, CFG.LOGICAL_H*0.30 + 34);

        if (isClear){
          let y = CFG.LOGICAL_H*0.30 + 58;
          ctx.font = "14px system-ui, sans-serif";
          ctx.fillStyle = "rgba(190,200,220,0.92)";
          const line1 = (ending==="true") ? "균열이 완전히 봉인되었습니다." : "균열을 봉합했습니다.";
          const l1w = ctx.measureText(line1).width;
          ctx.fillText(line1, CFG.LOGICAL_W*0.5 - l1w*0.5, y);
          y += 20;

          const stats = s.game.stats || {};
          const upgSum = (s.core.hpMaxLv||0) + (s.core.shMaxLv||0);
          const statLine = `운석 낙하 ${stats.meteorImpacts||0}회 · 흡혈 손실 ${Math.round(stats.leechStolen||0)} · 최대치 강화 ${upgSum}/3`;
          const stw = ctx.measureText(statLine).width;
          ctx.fillText(statLine, CFG.LOGICAL_W*0.5 - stw*0.5, y);
          y += 20;

          if (ending!=="true" && s.game.endingHint){
            ctx.fillStyle = "rgba(170,185,210,0.90)";
            const hint = s.game.endingHint;
            const parts = hint.split(" / ");
            const compact = parts.join(" / ");
            if (compact.length>64 && parts.length>=2){
              const mid = Math.ceil(parts.length/2);
              const h1 = parts.slice(0, mid).join(" / ");
              const h2 = parts.slice(mid).join(" / ");
              const hw1 = ctx.measureText(h1).width;
              ctx.fillText(h1, CFG.LOGICAL_W*0.5 - hw1*0.5, y);
              y += 18;
              const hw2 = ctx.measureText(h2).width;
              ctx.fillText(h2, CFG.LOGICAL_W*0.5 - hw2*0.5, y);
            } else {
              const hw = ctx.measureText(compact).width;
              ctx.fillText(compact, CFG.LOGICAL_W*0.5 - hw*0.5, y);
            }
          }
        }

        if (isBad){
          ctx.font = "14px system-ui, sans-serif";
          ctx.fillStyle = "rgba(190,200,220,0.9)";
          const line = "최종전에서 패배했습니다. 균열이 폭주합니다…";
          const lw = ctx.measureText(line).width;
          ctx.fillText(line, CFG.LOGICAL_W*0.5 - lw*0.5, CFG.LOGICAL_H*0.30 + 58);
        }

        ctx.restore();
      }


      if (shakeActive) ctx.restore();
    }
  };



  // ================================
  // Cheat Panel (PC testing)
  // Toggle: Ctrl+Shift+C or F2
  // ================================
  const Cheat = {
    els:null,
    init(){
      const $ = (id)=>document.getElementById(id);
      this.els = {
        panel: $('cheatPanel'),
        close: $('btn-cheat-close'),
        add1k: $('btn-cheat-1k'),
        add10k: $('btn-cheat-10k'),
        max: $('btn-cheat-max'),
        inf: $('btn-cheat-inf'),
        god: $('btn-cheat-god'),
        kill: $('btn-cheat-kill'),
        win: $('btn-cheat-win'),
        wave: $('cheatWave'),
        goto: $('btn-cheat-goto'),
        spawnBoss: $('btn-cheat-spawn-boss'),
        spawnFinal: $('btn-cheat-spawn-final'),
        sp1: $('btn-cheat-speed1'),
        sp2: $('btn-cheat-speed2'),
        sp4: $('btn-cheat-speed4'),
      };

      const bind = (el, fn)=>{ if(el) el.addEventListener('click', fn); };

      bind(this.els.close, ()=>this.hide());
      bind(this.els.add1k, ()=>this.addCrystals(1000));
      bind(this.els.add10k, ()=>this.addCrystals(10000));
      bind(this.els.max, ()=>this.setCrystals(99999));
      bind(this.els.inf, ()=>this.toggleInfinite());
      bind(this.els.god, ()=>this.toggleGod());
      bind(this.els.kill, ()=>this.killAll());
      bind(this.els.win, ()=>this.winWave());
      bind(this.els.goto, ()=>this.gotoWave());
      bind(this.els.spawnBoss, ()=>this.spawnBoss(false));
      bind(this.els.spawnFinal, ()=>this.spawnBoss(true));
      bind(this.els.sp1, ()=>this.setSpeed(1.0));
      bind(this.els.sp2, ()=>this.setSpeed(2.0));
      bind(this.els.sp4, ()=>this.setSpeed(4.0));

      // key toggle
      window.addEventListener('keydown', (ev)=>{
        const key = (ev.key||'').toLowerCase();
        const hot = (key==='f2') || (ev.ctrlKey && ev.shiftKey && key==='c');
        if (hot){
          ev.preventDefault();
          this.toggle();
        }
        if (key==='escape' && this.isOpen()){
          ev.preventDefault();
          this.hide();
        }
      });

      this.sync();
    },

    s(){ return Core.state; },
    isOpen(){ const s=this.s(); return !!(s.cheat && s.cheat.open); },

    toggle(){
      const s=this.s();
      if (!s.cheat) s.cheat={ enabled:true, open:false, infiniteCrystals:false, god:false };
      s.cheat.open = !s.cheat.open;
      this.applyVisibility();
      this.sync();
      UI.toast(s.cheat.open ? '치트 패널 ON' : '치트 패널 OFF');
    },
    hide(){
      const s=this.s();
      if (s.cheat){ s.cheat.open=false; this.applyVisibility(); this.sync(); }
    },
    applyVisibility(){
      if (!this.els || !this.els.panel) return;
      const open=this.isOpen();
      this.els.panel.classList.toggle('hidden', !open);
    },

    addCrystals(n){
      const s=this.s();
      if (!s.resources) return;
      s.resources.crystals = Math.max(0, (s.resources.crystals||0) + n);
      UI.toast(`크리스탈 +${n.toLocaleString()}`);
      this.sync();
    },
    setCrystals(v){
      const s=this.s();
      if (!s.resources) return;
      s.resources.crystals = Math.max(0, v|0);
      UI.toast(`크리스탈 ${s.resources.crystals.toLocaleString()}`);
      this.sync();
    },
    toggleInfinite(){
      const s=this.s();
      if (!s.cheat) return;
      s.cheat.infiniteCrystals = !s.cheat.infiniteCrystals;
      UI.toast(s.cheat.infiniteCrystals ? '무한 크리스탈 ON' : '무한 크리스탈 OFF');
      this.sync();
    },
    toggleGod(){
      const s=this.s();
      if (!s.cheat) return;
      s.cheat.god = !s.cheat.god;
      UI.toast(s.cheat.god ? '무적 ON' : '무적 OFF');
      this.sync();
    },
    setSpeed(v){
      const s=this.s();
      s.game.speed = v;
      UI.toast(`게임 속도 ×${v}`);
      this.sync();
    },
    killAll(){
      const s=this.s();
      for (const e of s.entities.enemies){ e.hp=0; e.deathT = Math.max(e.deathT||0, 0.15); }
      UI.toast('적 전부 처치');
    },
    winWave(){
      const s=this.s();
      if (s.game.phase!=='wave'){ UI.toast('웨이브 중이 아닙니다'); return; }
      for (const e of s.entities.enemies){ e.hp=0; e.deathT = Math.max(e.deathT||0, 0.15); }
      if (!s._waveSpawn) s._waveSpawn={ remaining:0, timer:0, boss:false };
      s._waveSpawn.remaining = 0;
      s._waveSpawn.boss = false;
      UI.toast('현재 웨이브 강제 클리어');
    },
    gotoWave(){
      const s=this.s();
      if (!this.els || !this.els.wave) return;
      const raw = parseInt(this.els.wave.value||'30', 10);
      const n = clamp(raw, 1, 30);

      if (!s.game.running){
        Core.startRun();
      }

      // Jump: set to n-1 then start the wave (Space does the same).
      s.game.waveIndex = Math.max(0, n-1);
      s.game.phase = 'shop';
      // clear remaining enemies/projectiles so the next wave starts clean
      s.entities.enemies.length = 0;
      s.entities.projectiles.length = 0;
      s._waveSpawn = { remaining:0, timer:0, boss:false };

      Core.nextWaveOrStart();
      UI.toast(`웨이브 ${n}로 이동`);
    },

    spawnBoss(final){
      const s=this.s();
      if (!s.game.running){
        Core.startRun();
      }
      if (final) s.game.waveIndex = 30;
      else if (s.game.waveIndex < 5) s.game.waveIndex = 5;
      if (s.game.phase!=='wave') s.game.phase='wave';
      Sim.ensureWave(s);
      Sim.spawnEnemy(s, 'boss');
      UI.toast(final ? '최종보스 소환' : '보스 소환');
    },

    sync(){
      if (!this.els) return;
      const s=this.s();
      if (!s.cheat) return;
      this.applyVisibility();
      if (this.els.inf){
        this.els.inf.textContent = s.cheat.infiniteCrystals ? '무한: ON' : '무한: OFF';
        this.els.inf.classList.toggle('active', !!s.cheat.infiniteCrystals);
      }
      if (this.els.god){
        this.els.god.textContent = s.cheat.god ? '무적: ON' : '무적: OFF';
        this.els.god.classList.toggle('active', !!s.cheat.god);
      }
    }
  };
  const Core = {
    state: State.reset(),
    canvas:null,
    async boot(){
      Core.canvas=document.getElementById("game");
      Render.init(Core.canvas);
      UI.init();
      Cheat.init();
      Assets.load(); // non-blocking

      const onResize=()=>Render.resize(Core.canvas);
      window.addEventListener("resize", onResize);
      onResize();

      Input.init(Core.canvas, Render.view);

      UI.updatePassiveDesc();
      UI.syncPassiveButtons();
      UI.applyGameOverVisibility();
      UI.toast("부팅 완료. 메뉴에서 시작하세요.");

      Core.loop();
    },

    resetAll(){ AudioSys.stopEnergyCharge(); AudioSys.setBgmMode("idle"); Core.state = State.reset(); UI.updatePassiveDesc(); UI.syncPassiveButtons(); },

    startRun(){
      const s=Core.state;
      if (!s.passives.selected){ UI.toast("패시브를 먼저 선택해주세요."); return; }
      if (s.game.difficulty==="hard" && !(s.unlocks && s.unlocks.hard)) s.game.difficulty="normal";
      s.game.running=true; s.game.paused=false; s.game.phase="setup";
      AudioSys.setBgmMode("idle");
      s.passives.locked=true;
      s.game.waveIndex=0;
      s.game.badEnding=false;
      s.game.endingType=null;
      s.game.endingHint="";
      s.game.endingDur=0;
      s.game.endingT=0;
      s.game.stats = { leechStolen:0, meteorCalls:0, meteorImpacts:0 };
      s.game.rewindT = 0;
      s.game.rewindDur = 1.6;
      s.game.event={active:false, key:null, name:"", desc:"", mods:{}};
      s.game.lastEventKey=null;
      // reset core stats & upgrades
      s.core.destroyed=false;
      s.core.hpMax=CFG.core.hpMax; s.core.hp=s.core.hpMax;
      s.core.shMax=CFG.core.shMax; s.core.sh=s.core.shMax;
      s.core.shRegenLock=0; s.core.repairLock=0; s.core.rebirthInvulT=0;
      s.core.repairCd=0; s.core.emergencyCd=0;
      s.core.lastHitAt=-999;
      s.core.armorHpLv=0; s.core.armorShLv=0;
      s.entities.enemies.length=0; s.entities.turrets.length=0; s.entities.projectiles.length=0; s.entities.fx.length=0;
      s.entities.nextTurretId=1;
      s.ui.selectedTurretId=null;
      s._waveSpawn=null;
      s._waveHpDamaged=false;

      s.passives.resonance.gauge=0; s.passives.resonance.pulseIcd=0;
      s.passives.rebirthSelected = (s.passives.selected==="rebirth");
      s.passives.rebirthUsed = false;
      s.passives.fromRebirth = false;
      s.passives.fromRebirthMul = 0.8;
      s.passives.rebirthTw = !!s.passives.rebirthSelected;
      if (s.passives.rebuild){ s.passives.rebuild.emergencyT=0; s.passives.rebuild.emergencyCd=0; }
      s.passives.overload.cd=0; s.passives.overload.burst=0; s.passives.overload.lastHpPct=1.0; s.passives.overload.chainExtIcd=0; s.passives.overload.chainEmergencyIcd=0;
      s.passives.overdrive.shotCd=0;
      s.skill.energyCannon.cd=0; s.skill.energyCannon.charging=false; s.skill.energyCannon.charge=0;
      AudioSys.stopEnergyCharge();

      s.ui.status="설치 단계: 클릭/터치로 포탑 설치 (테스트용)";
      s.ui.status2="Space 또는 웨이브 버튼으로 전투 시작";
      UI.updatePassiveDesc();
      UI.toast("런 시작! (패시브 🔒 잠금)");
      if (UI.els["menupanel"]) UI.els["menupanel"].style.display="none";
      UI.update(0);
    },

    nextWaveOrStart(){

      const s=Core.state;
      if (s.game.phase==="rewind") return;
      if (!s.game.running){ UI.toast("먼저 시작 버튼을 누르세요."); return; }
      if (s.game.phase==="setup" || s.game.phase==="shop"){
        if (s.game.waveIndex>=30){ UI.toast("이미 최종 웨이브를 클리어했습니다."); return; }
        s.game.phase="wave";
        const nextWave = s.game.waveIndex + 1;
        s.game.waveIndex = nextWave;

        const isBossWave = (nextWave%5===0);
        const isFinalWave = (nextWave===30);

        // Use the pre-rolled preview event if available so the UI "next wave" stays accurate.
        let ev = null;
        if (s.game.nextEventPreview && s.game.nextEventPreview.waveIndex===nextWave){
          ev = s.game.nextEventPreview.event;
          s.game.event = ev;
          s.game.lastEventKey = ev.key;
          s.game.nextEventPreview = null;
        } else {
          ev = Sim.assignRandomEventForWave(s, nextWave);
        }
        const isEventWave = !!ev;

        AudioSys.setBgmMode(isFinalWave ? "final" : isBossWave ? "boss" : "battle");

        s._waveHpDamaged = false;
        s._waveSpawn={ remaining:0, timer:0, boss:false };

        const eTag = isEventWave ? ` [이벤트:${ev.name}]` : "";
        const tags = `${isBossWave?" [보스]":""}${eTag}`;
        s.ui.status=`웨이브 ${nextWave} 시작!${tags}`;
        s.ui.status2 = isFinalWave ? "최종전: 최종보스 등장!" : isBossWave ? "보스는 원거리 투사체를 발사합니다." : isEventWave ? `이벤트: ${ev.name} — ${ev.desc}` : "";
        UI.toast(`웨이브 ${nextWave} 시작${isBossWave?" (보스)":""}${isEventWave?` (이벤트:${ev.name})`:""}`);
        AudioSys.sfx("waveStart");
        Sim.ensureWave(s);
        UI.update(0);
      } else if (s.game.phase==="wave"){
        UI.toast("전투 중입니다.");
      } else if (s.game.phase==="ending"){
        UI.toast("엔딩 연출 중입니다.");
      } else if (s.game.phase==="clear"){
        UI.toast("클리어 상태입니다. 재시작하세요.");
      } else if (s.game.phase==="gameover"){
        if (s.game.badEnding && s.game.waveIndex===30) UI.toast("배드 엔딩: 최종전에서 패배했습니다. 재시작하세요.");
      else UI.toast("패배 상태입니다. 재시작하세요.");
      }
    },

    togglePause(){
      const s=Core.state;
      if (!s.game.running) return;
      s.game.paused=!s.game.paused;
      UI.toast(s.game.paused?"일시정지":"재개");
    },

    toggleSpeed(){
      const s=Core.state;
      if (!s.game.running) return;
      const next=(s.game.speed===1.0)?1.5:(s.game.speed===1.5)?2.0:1.0;
      s.game.speed=next;
      UI.toast("배속: "+next.toFixed(1)+"x");
    },

    buyCoreArmor(kind){
      const s=Core.state;
      if (!s.game.running) return;
      if (!(s.game.phase==="setup" || s.game.phase==="shop")){
        UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
        AudioSys.sfx("error");
        return;
      }
      const steps = (CFG.coreUpg && CFG.coreUpg.armorSteps) ? CFG.coreUpg.armorSteps : [CFG.core.armorHP||0];
      const costs = (CFG.coreUpg && CFG.coreUpg.armorCosts) ? CFG.coreUpg.armorCosts : [0,0,0];
      if (kind==="hp"){
        const lv = clamp((s.core.armorHpLv||0),0,3);
        if (lv>=3){ UI.toast("HP 방어 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
        const cost = costs[lv] ?? 0;
        if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
        s.resources.crystals -= cost;
        s.core.armorHpLv = lv+1;
        UI.toast(`코어 HP 방어 업그레이드: ${steps[lv]} → ${steps[lv+1]} (-${cost})`);
        AudioSys.sfx("buy");
      } else {
        const lv = clamp((s.core.armorShLv||0),0,3);
        if (lv>=3){ UI.toast("보호막 방어 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
        const cost = costs[lv] ?? 0;
        if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
        s.resources.crystals -= cost;
        s.core.armorShLv = lv+1;
        UI.toast(`코어 보호막방어 업그레이드: ${steps[lv]} → ${steps[lv+1]} (-${cost})`);
        AudioSys.sfx("buy");
      }

    },

buyCoreMax(kind){
  const s=Core.state;
  if (!s.game.running) return;
  if (!(s.game.phase==="setup" || s.game.phase==="shop")){
    UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
    AudioSys.sfx("error");
    return;
  }
  const M = CFG.coreMaxUpg || {};
  const baseHp = CFG.core.hpMax;
  const baseSh = CFG.core.shMax;

  if (kind==="hp"){
    const lv = clamp((s.core.hpMaxLv||0),0,3);
    if (lv>=3){ UI.toast("HP 최대 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
    const cost = (M.hpCosts?.[lv] ?? 0);
    if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
    s.resources.crystals -= cost;
    s.core.hpMaxLv = lv+1;
    const cur = baseHp + (M.hpAdd?.[lv] ?? 0);
    const next = baseHp + (M.hpAdd?.[lv+1] ?? 0);
    const delta = next - cur;
    s.core.hpMax = Math.round(next);
    s.core.hp = Math.min(s.core.hpMax, s.core.hp + delta); // keep current ratio feeling
    UI.toast(`HP 최대 업그레이드: ${Math.round(cur)} → ${Math.round(next)} (-${cost})`);
    AudioSys.sfx("buy");
  } else {
    const lv = clamp((s.core.shMaxLv||0),0,3);
    if (lv>=3){ UI.toast("보호막 최대 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
    const cost = (M.shCosts?.[lv] ?? 0);
    if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
    s.resources.crystals -= cost;
    s.core.shMaxLv = lv+1;
    const cur = baseSh + (M.shAdd?.[lv] ?? 0);
    const next = baseSh + (M.shAdd?.[lv+1] ?? 0);
    const delta = next - cur;
    s.core.shMax = Math.round(next);
    s.core.sh = Math.min(s.core.shMax, s.core.sh + delta);
    UI.toast(`보호막 최대 업그레이드: ${Math.round(cur)} → ${Math.round(next)} (-${cost})`);
    AudioSys.sfx("buy");
  }
},

buyCoreShRegen(){
  const s=Core.state;
  if (!s.game.running) return;
  if (!(s.game.phase==="setup" || s.game.phase==="shop")){
    UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
    AudioSys.sfx("error");
    return;
  }
  const RG = CFG.coreShRegenUpg || { addPerSec:[0], costs:[0,0,0] };
  const lv = clamp((s.core.shRegenLv||0),0,3);
  if (lv>=3){ UI.toast("보호막 재생 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
  const cost = (RG.costs?.[lv] ?? 0);
  if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
  s.resources.crystals -= cost;
  s.core.shRegenLv = lv+1;
  const cur = Math.round(CFG.core.shRegenPerSec + (RG.addPerSec?.[lv] ?? 0));
  const next = Math.round(CFG.core.shRegenPerSec + (RG.addPerSec?.[lv+1] ?? (RG.addPerSec?.[lv] ?? 0)));
  UI.toast(`보호막 재생 업그레이드: ${cur}/s → ${next}/s (-${cost})`);
  AudioSys.sfx("buy");
},


buyCoreRepair(){
  const s=Core.state;
  if (!s.game.running) return;
  if (!(s.game.phase==="setup" || s.game.phase==="shop")){
    UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
    AudioSys.sfx("error");
    return;
  }
  const RU = CFG.coreRepairUpg || { heal:[CFG.repair?.healHpFlat||75], cd:[CFG.repair?.cooldownSec||5.0], costs:[0,0,0] };
  const lv = clamp((s.core.repairUpgLv||0), 0, 3);
  if (lv>=3){ UI.toast("수리 강화는 MAX입니다."); AudioSys.sfx("error"); return; }
  const cost = (RU.costs?.[lv] ?? 0);
  if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
  s.resources.crystals -= cost;
  s.core.repairUpgLv = lv+1;
  const curHeal = (RU.heal?.[lv] ?? (CFG.repair?.healHpFlat||75));
  const nextHeal = (RU.heal?.[lv+1] ?? curHeal);
  const curCd = (RU.cd?.[lv] ?? (CFG.repair?.cooldownSec||5.0));
  const nextCd = (RU.cd?.[lv+1] ?? curCd);
  UI.toast(`수리 강화: HP +${Math.round(curHeal)} · 쿨 ${fmt1(curCd)}s → HP +${Math.round(nextHeal)} · 쿨 ${fmt1(nextCd)}s (-${cost})`);
  AudioSys.sfx("buy");
},

buyCoreEmergency(){
  const s=Core.state;
  if (!s.game.running) return;
  if (!(s.game.phase==="setup" || s.game.phase==="shop")){
    UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
    AudioSys.sfx("error");
    return;
  }
  const EU = CFG.coreEmergencyUpg || { restorePct:[CFG.emergencyShield?.restorePct||0.38], cd:[CFG.emergencyShield?.cooldownSec||15.0], costs:[0,0,0] };
  const lv = clamp((s.core.emergencyUpgLv||0), 0, 3);
  if (lv>=3){ UI.toast("긴급 보호막 강화는 MAX입니다."); AudioSys.sfx("error"); return; }
  const cost = (EU.costs?.[lv] ?? 0);
  if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }
  s.resources.crystals -= cost;
  s.core.emergencyUpgLv = lv+1;
  const curPct = (EU.restorePct?.[lv] ?? (CFG.emergencyShield?.restorePct||0.38));
  const nextPct = (EU.restorePct?.[lv+1] ?? curPct);
  const curCd = (EU.cd?.[lv] ?? (CFG.emergencyShield?.cooldownSec||15.0));
  const nextCd = (EU.cd?.[lv+1] ?? curCd);
  UI.toast(`긴급 보호막 강화: ${Math.round(curPct*100)}% · 쿨 ${Math.round(curCd)}s → ${Math.round(nextPct*100)}% · 쿨 ${Math.round(nextCd)}s (-${cost})`);
  AudioSys.sfx("buy");
},

buySkillUpg(kind){
  const s=Core.state;
  if (!s.game.running) return;
  if (!(s.game.phase==="setup" || s.game.phase==="shop")){
    UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다.");
    AudioSys.sfx("error");
    return;
  }
  const U = CFG.skillUpg || {};
  if (!s.skillUpg) s.skillUpg = {energyLv:0, wallLv:0, warpLv:0};

  const pay=(cost)=>{
    if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return false; }
    s.resources.crystals -= cost; return true;
  };

  if (kind==="energy"){
    const lv = clamp(s.skillUpg.energyLv||0,0,3);
    if (lv>=3){ UI.toast("에너지포 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
    const cost = U.energy?.costs?.[lv] ?? 0;
    if (!pay(cost)) return;
    s.skillUpg.energyLv = lv+1;
    const getDmg = (lvl)=>{
      const EU = U.energy||{};
      if (EU.damage && EU.damage[lvl]!=null) return Math.round(EU.damage[lvl]);
      const mul = (EU.dmgMul && EU.dmgMul[lvl]!=null) ? EU.dmgMul[lvl] : 1.0;
      return Math.round(CFG.energyCannon.damage * mul);
    };
    const d0 = getDmg(lv), d1 = getDmg(lv+1);
    const finalSh = Math.round(U.energy?.finalShRestore ?? 0);
    const extra = ((lv+1)>=3 && finalSh>0) ? ` · 최종효과 SH+${finalSh}` : "";
    UI.toast(`에너지포 업글: Lv${lv} → Lv${lv+1} (피해 ${d0}→${d1})${extra} (-${cost})`);
    AudioSys.sfx("buy");
  } else if (kind==="wall"){
    const lv = clamp(s.skillUpg.wallLv||0,0,3);
    if (lv>=3){ UI.toast("방벽 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
    const cost = U.wall?.costs?.[lv] ?? 0;
    if (!pay(cost)) return;
    s.skillUpg.wallLv = lv+1;
    UI.toast(`방벽 업글: Lv${lv} → Lv${lv+1} (-${cost})`);
    AudioSys.sfx("buy");
  } else {
    const lv = clamp(s.skillUpg.warpLv||0,0,3);
    if (lv>=3){ UI.toast("시간왜곡 업그레이드는 MAX입니다."); AudioSys.sfx("error"); return; }
    const cost = U.warp?.costs?.[lv] ?? 0;
    if (!pay(cost)) return;
    s.skillUpg.warpLv = lv+1;
    UI.toast(`시간왜곡 업글: Lv${lv} → Lv${lv+1} (-${cost})`);
    AudioSys.sfx("buy");
  }
},

    getSelectedTurret(){
      const s=Core.state;
      const id = (s.ui && s.ui.selectedTurretId!=null) ? s.ui.selectedTurretId : null;
      if (id==null) return null;
      const t = s.entities.turrets.find(tt=>tt.id===id);
      if (!t){ s.ui.selectedTurretId=null; return null; }
      return t;
    },

    selectTurret(t){
      const s=Core.state;
      s.ui.selectedTurretId = t ? t.id : null;
      UI.updateTurretUpgPanel();
    },

    upgradeSelectedTurret(choice){
      const s=Core.state;
      const t=Core.getSelectedTurret();
      if (!t){ UI.toast("선택한 포탑이 없습니다."); AudioSys.sfx("error"); return; }

      const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
      if (!inShop){ UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다."); AudioSys.sfx("error"); return; }

      const lv = t.lv||1;
      if (lv>=5){ UI.toast("이미 MAX 레벨입니다."); AudioSys.sfx("error"); return; }

      let toLv = lv+1;

      // branch selection at Lv3
      if (lv===2 && !t.path){
        if (choice!=="A" && choice!=="B"){ UI.toast("Lv3 분기(A/B)를 선택하세요."); AudioSys.sfx("error"); return; }
        t.path = choice;
        toLv = 3;
      }

      const cost = Sim.turretUpgCost(t.type, toLv);
      if (s.resources.crystals < cost){ UI.toast(`크리스탈 부족 (필요 ${cost})`); AudioSys.sfx("error"); return; }

      s.resources.crystals -= cost;
      t.spent = (t.spent||0) + cost;
      t.lv = toLv;

      Sim.applyTurretStats(t);

      UI.toast(`포탑 업그레이드: Lv${lv} → Lv${toLv} (-${cost})`);
      AudioSys.sfx("buy", 0.9);
      UI.updateTurretUpgPanel();
    },

    sellSelectedTurret(){
      const s=Core.state;
      const t=Core.getSelectedTurret();
      if (!t){ UI.toast("선택한 포탑이 없습니다."); AudioSys.sfx("error"); return; }

      const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
      if (!inShop){ UI.toast("대기시간(설치/상점)에서만 판매 가능합니다."); AudioSys.sfx("error"); return; }

      const refund = Math.floor((t.spent||0) * 0.70);
      s.resources.crystals += refund;

      const idx = s.entities.turrets.indexOf(t);
      if (idx>=0) s.entities.turrets.splice(idx, 1);

      s.ui.selectedTurretId = null;
      UI.updateTurretUpgPanel();
      UI.toast(`포탑 판매 +${refund} (70%)`);
      AudioSys.sfx("buy", 0.7);
    },

    upgradeAllTurrets(mode="lv"){
      const s=Core.state;
      const inShop = (s.game.running && (s.game.phase==="setup" || s.game.phase==="shop"));
      if (!inShop){ UI.toast("대기시간(설치/상점)에서만 업그레이드 가능합니다."); AudioSys.sfx("error"); return; }

      const res = Sim.bulkUpgradeTurrets(s, mode||"lv", {});
      if (!res || (res.upgraded||0)<=0){
        UI.toast(res && res.branchNeed ? `업그레이드 없음 (분기 선택 필요: ${res.branchNeed})` : "업그레이드할 포탑이 없습니다.");
        AudioSys.sfx("error");
        return;
      }

      const b = res.branchNeed?` · 분기필요 ${res.branchNeed}`:"";
      UI.toast(`포탑 전체 업글: +${res.upgraded}회 (-${res.spent})${b}`);
      AudioSys.sfx("buy", 0.9);
      UI.updateTurretUpgPanel();
    },



    repair(){
  const s=Core.state;
  if (s.game.phase==="rewind") return;
  if (!s.game.running) return;
  if (s.game.phase==="menu" || s.game.phase==="gameover" || s.game.phase==="clear") return;

  if ((s.core.repairLock||0)>0){
    UI.toast(`수리 차단: ${Math.ceil(s.core.repairLock)}s`);
    AudioSys.sfx("error");
    return;
  }
  if ((s.core.repairCd||0)>0){
    UI.toast(`수리 쿨다운: ${Math.ceil(s.core.repairCd)}s`);
    AudioSys.sfx("error");
    return;
  }

  const repCfg = Sim.getRepairCfg(s);
  const cost = repCfg.cost;
  if (s.resources.crystals < cost){
    UI.toast(`크리스탈 부족 (필요 ${cost})`);
    AudioSys.sfx("error");
    return;
  }
  if (s.core.hp >= s.core.hpMax-0.01){
    UI.toast("HP가 이미 최대입니다.");
    AudioSys.sfx("error");
    return;
  }

  const hpBefore = s.core.hp;
  s.resources.crystals -= cost;
  s.core.hp = Math.min(s.core.hpMax, s.core.hp + (repCfg.healHpFlat||75));
  s.core.repairCd = repCfg.cooldownSec;
  UI.toast(`수리 사용: HP +${Math.ceil(s.core.hp-hpBefore)} (-${cost})`);
  AudioSys.sfx("repair");

  // overload synergy: if repaired while low HP, add marks / extend burst (ICD 20s)
  if (s.passives.selected==="overload" && (hpBefore/s.core.hpMax)<0.40){
    const O=s.passives.overload;
    const target=Sim.bossElseHighestHp(s);
    if (target){
      target.mark=Math.min(CFG.overload.markMax, (target.mark||0)+2);
      target.markT=CFG.overload.markRefresh;
      UI.toast("과부화 연계: '표식' +2");
      AudioSys.sfx("resonance", 0.5);
    }
    if (O && (O.burst||0)>0 && (O.burst||0)<2 && (O.chainExtIcd||0)<=0){
      O.burst = Math.min((CFG.overload.burstSec||6.0) + 2.0, (O.burst||0) + 2.0);
      O.chainExtIcd = 20.0;
      UI.toast("과부화 연계: 버스트 +2s");
    }
  }
},

emergencyShield(){
  const s=Core.state;
  if (s.game.phase==="rewind") return;
  if (!s.game.running) return;
  if (s.game.phase==="menu" || s.game.phase==="gameover" || s.game.phase==="clear") return;

  if ((s.core.emergencyCd||0)>0){
    UI.toast(`긴급 보호막 쿨다운: ${Math.ceil(s.core.emergencyCd)}s`);
    AudioSys.sfx("error");
    return;
  }
  if (s.core.sh >= s.core.shMax-0.01){
    UI.toast("보호막이 이미 최대입니다.");
    AudioSys.sfx("error");
    return;
  }

  const emCfg = Sim.getEmergencyCfg(s);

  const add = s.core.shMax * (emCfg.restorePct||0.38);
  s.core.sh = Math.min(s.core.shMax, s.core.sh + add);
  s.core.emergencyCd = emCfg.cooldownSec;
  UI.toast(`긴급 보호막: +${Math.ceil(add)} (즉시)`);
  AudioSys.sfx("emergencyShield");

  // overload synergy: emergency shield reduces overload cooldown (ICD 20s)
  if (s.passives.selected==="overload"){
    const O=s.passives.overload;
    if (O && (O.chainEmergencyIcd||0)<=0){
      const before = O.cd||0;
      O.cd = Math.max(0, before - 6.0);
      O.chainEmergencyIcd = 20.0;
      if (before>0) UI.toast("과부화 연계: 다음 쿨 -6s");
    }
  }
},

useEnergyCannon(){
      const s=Core.state;
      if (s.game.phase==="rewind") return;
      if (!s.game.running){ UI.toast("런 시작 후 사용 가능합니다."); return; }
      const sk=s.skill.energyCannon;
      const eCfg = Sim.getEnergyCfg(s);
      if (sk.charging){ UI.toast("이미 충전 중입니다."); return; }
      if (sk.cd>0){ UI.toast("에너지포 쿨다운: "+Math.ceil(sk.cd)+"s"); return; }
      sk.charging=true; sk.charge=0;
      sk.target = Sim.energyCannonTarget(s);
      s.entities.fx.push({type:"energyChargeCast", x:s.core.x, y:s.core.y, t:0.55});
      AudioSys.startEnergyCharge(eCfg.chargeSec);
      UI.toast(`에너지포 충전 시작 (${fmt1(eCfg.chargeSec)}초)`);
    },

    useWall(){

      const s=Core.state;
      if (s.game.phase==="rewind") return;
      if (!s.game.running || s.game.phase!=="wave"){ UI.toast("전투 중에만 사용 가능합니다."); return; }
      const W=s.skill.wall;
      const wCfg = Sim.getWallCfg(s);
      if (W.active>0){ UI.toast("방벽이 이미 활성화 중입니다."); return; }
      if (W.cd>0){ UI.toast("방벽 쿨다운: "+Math.ceil(W.cd)+"s"); return; }
      const cost=wCfg.cost;
      if (s.resources.crystals < cost){ UI.toast("크리스탈이 부족합니다. (방벽 비용 "+cost+")"); AudioSys.sfx("error"); return; }
      s.resources.crystals -= cost;
      // reset final-upgrade trackers
      W.thornsSecKey = -1; W.thornsSpentBoss = 0; W.thornsSpentNormal = 0;
      W.active = wCfg.invulnSec;
      W.cd = wCfg.cooldownSec;
      s.entities.fx.push({type:"wallCast", x:s.core.x, y:s.core.y, t:0.45});
      AudioSys.sfx("wall");
      UI.toast(`방벽: ${fmt1(wCfg.invulnSec)}초 무적`);
    },

    useTimeWarp(){

      const s=Core.state;
      if (s.game.phase==="rewind") return;
      if (!s.game.running || s.game.phase!=="wave"){ UI.toast("전투 중에만 사용 가능합니다."); return; }
      const T=s.skill.timeWarp;
      const tCfg = Sim.getTimeWarpCfg(s);
      if (T.active>0){ UI.toast("시간왜곡이 이미 활성화 중입니다."); return; }
      if (T.cd>0){ UI.toast("시간왜곡 쿨다운: "+Math.ceil(T.cd)+"s"); return; }
      const cost=tCfg.cost;
      if (s.resources.crystals < cost){ UI.toast("크리스탈이 부족합니다. (시간왜곡 비용 "+cost+")"); AudioSys.sfx("error"); return; }
      s.resources.crystals -= cost;
      T.active = tCfg.durationSec;
      T.cd = tCfg.cooldownSec;
      s.entities.fx.push({type:"timeWarpCast", x:s.core.x, y:s.core.y, t:0.65});
      AudioSys.sfx("timeWarp");
      UI.toast(`시간왜곡: ${fmt1(tCfg.durationSec)}초 / 반경 ${tCfg.radius}`);
    },

    handleInput(){
      const s=Core.state;
      s.ui.hover.x=Input.lx; s.ui.hover.y=Input.ly; s.ui.hover.active=true;

      // During ending/clear/gameover we ignore all gameplay inputs (DOM restart button still works).
      if (s.game.phase==="ending" || s.game.phase==="clear" || s.game.phase==="gameover") return;
      if (s.game.phase==="rewind"){
        if (Input.consumeJustPressed() || Input.isKey(" ")){
          s.game.rewindT = s.game.rewindDur||1.6;
        }
        return;
      }

      if (Input.consumeJustPressed()){
        if (s.game.running && (s.game.phase==="setup"||s.game.phase==="shop"||s.game.phase==="wave")){
          // first: turret repair mode (single or area full repair)
          if (s.ui && s.ui.turretRepairMode){
            const cfgTR = CFG.turretRepair || {};
            const pickR = (cfgTR.pickR!=null) ? cfgTR.pickR : 28;
            const shift = Input.keys && Input.keys.has("shift");
            const picked = Sim.pickTurretAt(s, Input.lx, Input.ly, pickR);

            // Shift+click (or clicking empty space) = area repair
            const doArea = shift || !picked;
            if (doArea){
              const resA = Sim.tryRepairTurretsArea(s, Input.lx, Input.ly);
              if (resA.ok){
                UI.toast(`주변 포탑 ${resA.count}기 풀수리 (-${resA.spent}💠)`);
                AudioSys.sfx("repair", 0.85);
              } else {
                AudioSys.sfx("error");
                if (resA.reason==="none") UI.toast("주변에 수리할 포탑이 없습니다.");
                else if (resA.reason==="cost") UI.toast(`크리스탈 부족 (최소 필요: ${resA.cost})`);
                else if (resA.reason==="gcd") UI.toast(`수리 대기중 (${fmt1(resA.t)}s)`);
                else if (resA.reason==="tcd") UI.toast("주변 포탑이 전부 쿨타임입니다.");
                else UI.toast("수리할 수 없습니다.");
              }
            } else {
              const res = Sim.tryRepairTurret(s, picked);
              const nm = (CFG.turrets && CFG.turrets[picked.type]) ? CFG.turrets[picked.type].name : picked.type;
              if (res.ok){
                UI.toast(`${nm} 풀수리 (-${res.cost}💠)`);
                AudioSys.sfx("repair", 0.85);
              } else {
                AudioSys.sfx("error");
                if (res.reason==="full") UI.toast("이미 최대 내구도입니다.");
                else if (res.reason==="cost") UI.toast(`크리스탈 부족 (필요: ${res.cost})`);
                else if (res.reason==="gcd" || res.reason==="tcd") UI.toast(`수리 대기중 (${fmt1(res.t)}s)`);
                else UI.toast("수리할 수 없습니다.");
              }
            }
            return;
          }

          // first: turret selection (tap a turret)
          const picked = Sim.pickTurretAt(s, Input.lx, Input.ly, 28);
          if (picked){
            s.ui.selectedTurretId = picked.id;
            UI.updateTurretUpgPanel();
            const nm = (CFG.turrets && CFG.turrets[picked.type]) ? CFG.turrets[picked.type].name : picked.type;
            UI.toast(`${nm} 선택`);
            AudioSys.sfx("click", 0.8);
            return;
          } else {
            // tap empty: deselect
            if (s.ui.selectedTurretId!=null){
              s.ui.selectedTurretId = null;
              UI.updateTurretUpgPanel();
            }
          }

          if (s.ui.buildMode){
            const type = (s.build && s.build.turretType) ? s.build.turretType : "basic";
            const cfg = (CFG.turrets && CFG.turrets[type]) ? CFG.turrets[type] : (CFG.turrets ? CFG.turrets.basic : null);
            const ok = Sim.placeTurret(s, Input.lx, Input.ly, type);
            if (ok){
              AudioSys.sfx("place");
              UI.toast(`${cfg?cfg.name:type} 포탑 설치 (-${cfg?cfg.cost:0} 크리스탈)`);
            } else {
              AudioSys.sfx("error");
              const r = Sim._placeFail;
              if (r==="core") UI.toast("코어 근처에는 설치할 수 없습니다.");
              else if (r==="overlap") UI.toast("포탑이 겹칩니다. 조금 떨어진 곳에 설치하세요.");
              else if (r==="cost") UI.toast(`크리스탈 부족 (필요: ${cfg?cfg.cost:0})`);
              else UI.toast("설치할 수 없습니다.");
            }
          }
        }
      }

      if (Input.isKey(" ")){
        if (!Core._space){ Core._space=true; Core.nextWaveOrStart(); }
      } else Core._space=false;

      if (Input.isKey("p")){
        if (!Core._p){ Core._p=true; Core.togglePause(); }
      } else Core._p=false;

      // Upgrade Hub toggle
      if (Input.isKey("u")){
        if (!Core._u){
          Core._u=true;
          if (s.game && (s.game.phase==="ending" || s.game.phase==="clear" || s.game.phase==="gameover")){
            // ignore during end screens
          } else {
            if (typeof UpgHub !== "undefined" && UpgHub && UpgHub.toggle) UpgHub.toggle();
          }
        }
      } else Core._u=false;

      if (Input.isKey("e")){
        if (!Core._e){ Core._e=true; Core.useEnergyCannon(); }
      } else Core._e=false;

      if (Input.isKey("q")){
        if (!Core._q){ Core._q=true; Core.useWall(); }
      } else Core._q=false;

      if (Input.isKey("r")){
        if (!Core._r){ Core._r=true; Core.useTimeWarp(); }
      } else Core._r=false;

      if (Input.isKey("1")) s.game.speed=1.0;
      if (Input.isKey("2")) s.game.speed=1.5;
      if (Input.isKey("3")) s.game.speed=2.0;
    },

    loop(){
      let last=now(), acc=0;
      const STEP=1/60;
      const tick=()=>{
        try{
          const t=now();
          let dt=(t-last)/1000; last=t;
          dt=Math.min(dt, 0.05);
          acc += dt;

          Render.resize(Core.canvas);
          Core.handleInput();

          while (acc>=STEP){ Sim.step(Core.state, STEP); acc -= STEP; }
          Render.draw(Core.state);
          UI.update(dt);

        }catch(e){
          const box=document.getElementById("errbox");
          if (box){
            box.style.display="block";
            box.textContent = (`[RUNTIME ERROR]\n${e && e.message ? e.message : e}\n\n${e && e.stack ? e.stack : ""}`).trim();
          }
          if (Core && Core.state && Core.state.debug){
            Core.state.debug.lastErr = e && e.message ? e.message : String(e);
          }
        }finally{
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    },

    sim: Sim
  };

  window.Core=Core;

  // show runtime errors on screen (helps when opening via file/content://)
  window.addEventListener("error", (ev)=>{
    try{
      const msg = (ev && ev.message) ? ev.message : String(ev);
      const file = ev && ev.filename ? ev.filename : "";
      const line = ev && ev.lineno ? ev.lineno : "";
      const col  = ev && ev.colno ? ev.colno : "";
      const stack = ev && ev.error && ev.error.stack ? ev.error.stack : "";
      const box = document.getElementById("errbox");
      if (box){
        box.style.display="block";
        box.textContent = (`[RUNTIME ERROR]\n${msg}\n${file}:${line}:${col}\n\n${stack}`).trim();
      }
      if (Core && Core.state && Core.state.debug) Core.state.debug.lastErr = msg;
    }catch(_){}
  });

  window.addEventListener("DOMContentLoaded", ()=>Core.boot());
})();
