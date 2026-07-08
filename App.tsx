/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  Combatant, LootItem, BulletState, KillFeedEvent, GameSettings, PlayerProfile, WeaponConfig 
} from './types';
import { DEFAULT_SETTINGS, SAVE_SYSTEM, MISSIONS_LIST } from './game/saveSystem';
import { SOUND_SYSTEM } from './game/soundSystem';
import { MAP_LOCATIONS, MapGenerator, getTerrainHeight } from './game/mapGenerator';
import { generateInitialBots, updateBotAI } from './game/botAI';
import { WEAPON_PRESETS, getWeaponConfig } from './game/weapons';
import { PlayerController } from './game/playerController';
import MainMenu from './components/MainMenu';
import GameHUD from './components/GameHUD';

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 1024);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);
  const [matchMode, setMatchMode] = useState<'solo' | 'duo' | 'squad' | 'training'>('solo');
  const [profile, setProfile] = useState<PlayerProfile>(SAVE_SYSTEM.loadProfile());
  const [settings, setSettings] = useState<GameSettings>(SAVE_SYSTEM.loadSettings());

  // Active Match states
  const [playersAlive, setPlayersAlive] = useState(100);
  const [kills, setKills] = useState(0);
  const [damageDealt, setDamageDealt] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(120); // 2 minutes storm phases
  const [stormPhase, setStormPhase] = useState(1);
  const [killFeed, setKillFeed] = useState<KillFeedEvent[]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');

  // React overlays for damage popups
  interface DamagePopup {
    id: string;
    text: string;
    x: number; // screen space %
    y: number; // screen space %
    color: string;
  }
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);

  // Three.js Canvas References
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Gameplay logical states (Refs keep values synchronized during high-speed animation ticks)
  const playerRef = useRef<Combatant>({
    id: 'player',
    name: profile.username,
    isBot: false,
    health: 100,
    armor: 100,
    helmet: 100,
    inventory: {
      weapons: ['m4a1', 'mp5', 'katana'], // Primary, secondary, melee
      activeWeaponIndex: 0,
      ammo: { 'Assault Rifle': 90, 'SMG': 120, 'Shotgun': 8, 'Sniper': 10 },
      medkits: 3,
      shieldPotions: 2,
    },
    position: { x: 0, y: 0.5, z: 0 },
    rotationY: 0,
    pitch: 0,
    state: 'alive',
    action: 'idle',
    targetEnemyId: null,
  });

  const botsRef = useRef<Combatant[]>([]);
  const lootRef = useRef<LootItem[]>([]);
  const bulletsRef = useRef<BulletState[]>([]);
  const mapGeneratorRef = useRef<MapGenerator | null>(null);
  const controllerRef = useRef<PlayerController | null>(null);

  // Storm Zone coordinates
  const stormCenterRef = useRef({ x: 0, z: 0 });
  const stormRadiusRef = useRef(250);
  const nextStormCenterRef = useRef({ x: 0, z: 0 });
  const nextStormRadiusRef = useRef(150);

  // Three.js Mesh tracking maps (renders physical models based on states)
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const botMeshMap = useRef<Map<string, THREE.Group>>(new Map());
  const lootMeshMap = useRef<Map<string, THREE.Group>>(new Map());
  const bulletMeshMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const stormZoneVisualRef = useRef<THREE.Mesh | null>(null);

  // Weapon firing variables
  const lastTimeShot = useRef<number>(0);
  const isReloading = useRef<boolean>(false);

  // Synchronize player name if changed in lobby
  useEffect(() => {
    playerRef.current.name = profile.username;
  }, [profile.username]);

  // Handle Match Initialization
  const handleStartMatch = (mode: 'solo' | 'duo' | 'squad' | 'training') => {
    setMatchMode(mode);
    setGameState('playing');
    setGameStatus('playing');
    setKills(0);
    setDamageDealt(0);
    setTimerRemaining(mode === 'training' ? 9999 : 120);
    setStormPhase(1);
    setKillFeed([]);
    setDamagePopups([]);

    // Reset Player Vitals
    const equippedPrimary = profile.equippedWeaponSkin.m4a1 ? 'm4a1' : 'm4a1';
    const equippedSecondary = profile.equippedWeaponSkin.mp5 ? 'mp5' : 'mp5';

    playerRef.current = {
      id: 'player',
      name: profile.username,
      isBot: false,
      health: 100,
      armor: 100,
      helmet: 100,
      inventory: {
        weapons: [equippedPrimary, equippedSecondary, 'katana'],
        activeWeaponIndex: 0,
        ammo: { 'Assault Rifle': 120, 'SMG': 150, 'Shotgun': 12, 'Sniper': 15 },
        medkits: 4,
        shieldPotions: 3,
      },
      position: { x: 0, y: 0.5, z: 0 },
      rotationY: 0,
      pitch: 0,
      state: 'alive',
      action: 'idle',
      targetEnemyId: null,
    };

    // Reset storm states
    stormCenterRef.current = { x: 0, z: 0 };
    stormRadiusRef.current = 240;
    nextStormCenterRef.current = { x: (Math.random() * 40) - 20, z: (Math.random() * 40) - 20 };
    nextStormRadiusRef.current = 140;

    // Generate bots (99 bots for solo)
    const botCount = mode === 'training' ? 5 : 99;
    botsRef.current = generateInitialBots(botCount);
    setPlayersAlive(botCount + 1);

    // Generate random ground loot scatters (weapons, shield, medkits)
    generateGroundLoot(60);

    // Initial sound triggers
    SOUND_SYSTEM.setVolume(settings.soundVolume);
    SOUND_SYSTEM.playExplosion();
  };

  const handleExitMatch = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    // Clean up Three.js scene fully
    disposeThreeResources();
    setGameState('menu');
  };

  const generateGroundLoot = (count: number) => {
    const loots: LootItem[] = [];
    const lootTypes: ('weapon' | 'med' | 'armor')[] = ['weapon', 'med', 'armor'];
    const weapons = ['m4a1', 'ak47', 'mp5', 'm1887', 'awp', 'rpg'];

    for (let i = 0; i < count; i++) {
      const type = lootTypes[Math.floor(Math.random() * lootTypes.length)];
      const lx = (Math.random() * 380) - 190;
      const lz = (Math.random() * 380) - 190;
      const lh = getTerrainHeight(lx, lz);

      let name = 'Airdrop Kit';
      let refId = '';
      let qty = 1;

      if (type === 'weapon') {
        refId = weapons[Math.floor(Math.random() * weapons.length)];
        const cfg = getWeaponConfig(refId);
        name = cfg.name;
        qty = 1;
      } else if (type === 'med') {
        refId = Math.random() > 0.5 ? 'med_kit' : 'shield_potion';
        name = refId === 'med_kit' ? 'Military Medkit' : 'Shield Potion';
        qty = 1;
      } else {
        refId = 'armor_lvl2';
        name = 'Kevlar Vest Lvl 2';
        qty = 1;
      }

      loots.push({
        id: `loot_${i}`,
        name,
        type,
        refId,
        count: qty,
        position: { x: lx, y: lh + 0.3, z: lz },
      });
    }

    lootRef.current = loots;
  };

  const disposeThreeResources = () => {
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    // Clear mesh mapping references
    botMeshMap.current.clear();
    lootMeshMap.current.clear();
    bulletMeshMap.current.clear();
    sceneRef.current = null;
    cameraRef.current = null;
    rendererRef.current = null;
  };

  // 3D Canvas Mounting Lifecycle
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current) return;

    // 1. Scene & Camera standard initialization
    const width = canvasRef.current.clientWidth || window.innerWidth;
    const height = canvasRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#121214');
    scene.fog = new THREE.FogExp2('#121214', 0.008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(settings.fov, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting setup
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#ffe8d6', 1.0);
    sunLight.position.set(100, 150, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 3. Map Generation
    const mapGen = new MapGenerator(scene);
    mapGen.generateMap(settings.graphics);
    mapGeneratorRef.current = mapGen;

    // 4. Create Player visual helper capsule (invisible in FPS, visible in TPS)
    const playerGeo = new THREE.CapsuleGeometry(0.5, 1.2, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 });
    const playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.set(0, 0, 0);
    scene.add(playerMesh);
    playerMeshRef.current = playerMesh;

    // Create safe zone glowing visual border
    stormZoneVisualRef.current = mapGen.createStormZoneVisual();

    // 5. Initialize Controller
    const controller = new PlayerController(playerRef.current, settings);
    controllerRef.current = controller;

    // 6. Handle resizing
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      const updateCanvasSize = () => {
        if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
        const w = canvasRef.current.clientWidth || window.innerWidth;
        const h = canvasRef.current.clientHeight || window.innerHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      };
      updateCanvasSize();
      setTimeout(updateCanvasSize, 200);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // 7. Core frame ticking logic
    let lastTime = performance.now();

    const gameTick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000); // Caps deltaTime on tab unfocus
      lastTime = now;

      if (gameStatus === 'playing') {
        updateMatchSimulation(dt);
      }

      // Render loop update
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameId.current = requestAnimationFrame(gameTick);
    };

    // Begin Animation Loop
    animationFrameId.current = requestAnimationFrame(gameTick);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      disposeThreeResources();
    };
  }, [gameState]);

  // Main Match Tick Loop Execution
  const updateMatchSimulation = (deltaTime: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Timer & Storm shrink physics
    if (matchMode !== 'training') {
      setTimerRemaining(prev => {
        const next = prev - deltaTime;
        if (next <= 0) {
          // Advance Storm Phase!
          SOUND_SYSTEM.playStormWarning();
          const nextPhase = stormPhase + 1;
          setStormPhase(nextPhase);

          // Calculate new shrinking boundaries
          stormRadiusRef.current = nextStormRadiusRef.current;
          nextStormRadiusRef.current = Math.max(15, nextStormRadiusRef.current - 40);
          nextStormCenterRef.current = {
            x: stormCenterRef.current.x + (Math.random() * 30 - 15),
            z: stormCenterRef.current.z + (Math.random() * 30 - 15),
          };

          // Apply damage tick if player outside safe zone
          return 120; // 2 more mins
        }
        return next;
      });

      // Slowly shrink current storm boundary towards target storm center
      const shrinkSpeed = 1.8 * deltaTime;
      const sc = stormCenterRef.current;
      const nsc = nextStormCenterRef.current;
      sc.x = THREE.MathUtils.lerp(sc.x, nsc.x, 0.01);
      sc.z = THREE.MathUtils.lerp(sc.z, nsc.z, 0.01);

      // Animate Safe Zone glowing visual
      if (stormZoneVisualRef.current) {
        stormZoneVisualRef.current.position.set(sc.x, 30, sc.z);
        // Scale cylinder circumference matches current radius
        stormZoneVisualRef.current.scale.set(stormRadiusRef.current, 1, stormRadiusRef.current);
      }
    }

    // Apply storm damage every second
    const pPos = playerRef.current.position;
    const distToStorm = Math.sqrt(Math.pow(pPos.x - stormCenterRef.current.x, 2) + Math.pow(pPos.z - stormCenterRef.current.z, 2));
    if (distToStorm > stormRadiusRef.current && matchMode !== 'training' && Math.random() < 0.2) {
      // Deal direct health damage
      playerRef.current.health = Math.max(0, playerRef.current.health - 2);
      if (playerRef.current.health <= 0) {
        handlePlayerElimination('The Storm');
      }
    }

    // 2. Update player controller positions
    if (controllerRef.current && cameraRef.current && mapGeneratorRef.current && playerRef.current.state === 'alive') {
      controllerRef.current.update(deltaTime, cameraRef.current, mapGeneratorRef.current.colliders);

      // Align Player 3D Mesh
      if (playerMeshRef.current) {
        playerMeshRef.current.position.set(pPos.x, pPos.y + 0.6, pPos.z);
        playerMeshRef.current.rotation.y = playerRef.current.rotationY;
        
        // Hide player body mesh if first person to avoid visual clipping, show in TPS
        playerMeshRef.current.visible = settings.cameraMode === 'tps';
      }

      // Check auto pickup triggers
      lootRef.current.forEach((loot, idx) => {
        const d = Math.sqrt(Math.pow(pPos.x - loot.position.x, 2) + Math.pow(pPos.z - loot.position.z, 2));
        if (d < 3.0 && settings.autoPickup) {
          triggerLootPickup(loot, idx);
        }
      });
    }

    // 3. Update Bots state AI
    const aliveBots = botsRef.current.filter(b => b.state === 'alive');
    botsRef.current.forEach(bot => {
      if (bot.state !== 'alive') return;

      updateBotAI(
        bot,
        playerRef.current,
        botsRef.current,
        lootRef.current,
        stormCenterRef.current,
        stormRadiusRef.current,
        deltaTime,
        (firingBot, targetCombatant) => {
          // Bot fires shot!
          triggerCombatantShot(firingBot, targetCombatant);
        }
      );

      // Render Bot Visuals
      let bGroup = botMeshMap.current.get(bot.id);
      if (!bGroup) {
        // Create capsule group
        bGroup = new THREE.Group();
        const botGeo = new THREE.CapsuleGeometry(0.5, 1.2, 4, 8);
        const botMat = new THREE.MeshStandardMaterial({ color: bot.colorHex || '#f43f5e', roughness: 0.7 });
        const botMesh = new THREE.Mesh(botGeo, botMat);
        botMesh.castShadow = true;
        bGroup.add(botMesh);

        // Held Gun representation
        const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 1.0);
        const gunMat = new THREE.MeshStandardMaterial({ color: '#27272a' });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.position.set(0.4, 0.2, 0.4);
        bGroup.add(gunMesh);

        scene.add(bGroup);
        botMeshMap.current.set(bot.id, bGroup);
      }

      bGroup.position.set(bot.position.x, bot.position.y + 0.6, bot.position.z);
      bGroup.rotation.y = bot.rotationY;
    });

    // Clean up dead bots mesh representation
    botMeshMap.current.forEach((mesh, botId) => {
      const found = botsRef.current.find(b => b.id === botId);
      if (!found || found.state !== 'alive') {
        scene.remove(mesh);
        botMeshMap.current.delete(botId);
      }
    });

    // 4. Update Bullets Flight vectors and hit registration
    const remainingBullets: BulletState[] = [];
    bulletsRef.current.forEach(b => {
      // Advance coordinates
      b.position.x += b.velocity.x * deltaTime;
      b.position.y += b.velocity.y * deltaTime;
      b.position.z += b.velocity.z * deltaTime;
      b.rangeRemaining -= deltaTime * 150; // diminish range index

      // Bullet mesh tracking
      let bulletMesh = bulletMeshMap.current.get(b.id);
      if (!bulletMesh) {
        const bGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const bMat = new THREE.MeshBasicMaterial({ color: b.color || '#fbbf24' });
        bulletMesh = new THREE.Mesh(bGeo, bMat);
        scene.add(bulletMesh);
        bulletMeshMap.current.set(b.id, bulletMesh);
      }
      bulletMesh.position.set(b.position.x, b.position.y, b.position.z);

      // Hit registration sweeps
      let hitRegistered = false;

      if (b.ownerId !== 'player' && playerRef.current.state === 'alive') {
        const d = Math.sqrt(
          Math.pow(b.position.x - playerRef.current.position.x, 2) +
          Math.pow(b.position.z - playerRef.current.position.z, 2)
        );
        if (d < 1.0 && Math.abs(b.position.y - playerRef.current.position.y - 0.8) < 1.2) {
          // Direct hit onto Player!
          hitRegistered = true;
          applyCombatDamage(playerRef.current, b.damage, b.ownerId);
        }
      }

      if (b.ownerId === 'player') {
        botsRef.current.forEach(bot => {
          if (bot.state !== 'alive' || hitRegistered) return;
          const d = Math.sqrt(
            Math.pow(b.position.x - bot.position.x, 2) +
            Math.pow(b.position.z - bot.position.z, 2)
          );
          if (d < 1.0 && Math.abs(b.position.y - bot.position.y - 0.8) < 1.2) {
            // Player hit a Bot!
            hitRegistered = true;
            applyCombatDamage(bot, b.damage, 'player');
          }
        });
      }

      // Check height ground impact
      const terrainHeightAtBullet = getTerrainHeight(b.position.x, b.position.z);
      if (b.position.y <= terrainHeightAtBullet) {
        hitRegistered = true;
      }

      if (b.rangeRemaining > 0 && !hitRegistered) {
        remainingBullets.push(b);
      } else {
        // Dispose mesh
        scene.remove(bulletMesh);
        bulletMeshMap.current.delete(b.id);
      }
    });
    bulletsRef.current = remainingBullets;

    // 5. Update loot box visual meshes
    lootRef.current.forEach(loot => {
      let lMesh = lootMeshMap.current.get(loot.id);
      if (!lMesh) {
        const group = new THREE.Group();
        const chestGeo = new THREE.BoxGeometry(1.0, 0.8, 1.0);
        const chestMat = new THREE.MeshStandardMaterial({
          color: loot.type === 'weapon' ? '#fbbf24' : '#ef4444',
          roughness: 0.3,
          metalness: 0.8,
        });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        group.add(chest);

        // Add soft ambient point light to make ground items highly visible!
        const glow = new THREE.PointLight(loot.type === 'weapon' ? '#fbbf24' : '#ef4444', 0.5, 3);
        group.add(glow);

        scene.add(group);
        lootMeshMap.current.set(loot.id, group);
        lMesh = group;
      }
      lMesh.position.set(loot.position.x, loot.position.y, loot.position.z);
      // Soft hovering rotation
      lMesh.rotation.y += deltaTime * 0.8;
    });

    // Clean up missing loot chests
    lootMeshMap.current.forEach((mesh, id) => {
      const found = lootRef.current.find(l => l.id === id);
      if (!found) {
        scene.remove(mesh);
        lootMeshMap.current.delete(id);
      }
    });

    // Sync Alive Ticker
    const currentAlive = botsRef.current.filter(b => b.state === 'alive').length + (playerRef.current.state === 'alive' ? 1 : 0);
    setPlayersAlive(currentAlive);

    // Bot victory trigger
    if (currentAlive === 1 && playerRef.current.state === 'alive' && gameStatus === 'playing') {
      setGameStatus('won');
      SAVE_SYSTEM.addMatchStats(kills, Math.round(kills * 0.2), damageDealt, 1);
    }
  };

  // Loot items pickup logic
  const triggerLootPickup = (loot: LootItem, idx: number) => {
    SOUND_SYSTEM.playReload();
    const inv = playerRef.current.inventory;

    if (loot.type === 'weapon') {
      // Find empty slot or replace active
      const currentActiveWepIdx = inv.activeWeaponIndex;
      inv.weapons[currentActiveWepIdx] = loot.refId;
    } else if (loot.refId === 'med_kit') {
      inv.medkits++;
    } else if (loot.refId === 'shield_potion') {
      inv.shieldPotions++;
    } else if (loot.type === 'armor') {
      playerRef.current.armor = 100;
    }

    // Remove from world array
    lootRef.current.splice(idx, 1);
  };

  // Player Trigger Shoot
  const handlePlayerShoot = () => {
    if (playerRef.current.state !== 'alive' || gameStatus !== 'playing') return;

    const now = performance.now();
    const activeWepId = playerRef.current.inventory.weapons[playerRef.current.inventory.activeWeaponIndex];
    if (!activeWepId) return;

    const cfg = getWeaponConfig(activeWepId);
    if (now - lastTimeShot.current < cfg.fireRate) return; // Fire rate gate

    // Ammo checks
    if (cfg.id !== 'katana') {
      const currentAmmo = playerRef.current.inventory.ammo[cfg.type] || 0;
      if (currentAmmo <= 0) {
        SOUND_SYSTEM.playReload();
        handlePlayerReload();
        return;
      }
      playerRef.current.inventory.ammo[cfg.type]--;
    }

    lastTimeShot.current = now;

    // Trigger procedural sound
    SOUND_SYSTEM.playShot(cfg.type);

    // Camera recoil kick
    if (controllerRef.current) {
      controllerRef.current.pitch += cfg.recoil;
    }

    // Find shooting vectors
    const yaw = playerRef.current.rotationY;
    const pitch = playerRef.current.pitch;

    const velocity = {
      x: Math.cos(yaw) * Math.cos(pitch) * cfg.bulletSpeed,
      y: Math.sin(pitch) * cfg.bulletSpeed,
      z: Math.sin(yaw) * Math.cos(pitch) * cfg.bulletSpeed,
    };

    const bulletId = `bullet_player_${now}_${Math.random()}`;
    const initialPos = {
      x: playerRef.current.position.x,
      y: playerRef.current.position.y + 1.4, // shoot from head eye line
      z: playerRef.current.position.z,
    };

    bulletsRef.current.push({
      id: bulletId,
      ownerId: 'player',
      position: initialPos,
      velocity,
      damage: cfg.damage,
      rangeRemaining: cfg.range,
      color: cfg.color,
    });
  };

  // Combatant Shot AI bridge
  const triggerCombatantShot = (firingBot: Combatant, target: Combatant) => {
    const activeWepId = firingBot.inventory.weapons[firingBot.inventory.activeWeaponIndex] || 'm4a1';
    const cfg = getWeaponConfig(activeWepId);

    SOUND_SYSTEM.playShot(cfg.type);

    const bPos = firingBot.position;
    const tPos = target.position;

    // Calculate angle directly to target
    const dx = tPos.x - bPos.x;
    const dy = (tPos.y + 0.8) - (bPos.y + 0.8);
    const dz = tPos.z - bPos.z;
    const length = Math.sqrt(dx*dx + dy*dy + dz*dz);

    const velocity = {
      x: (dx / length) * cfg.bulletSpeed,
      y: (dy / length) * cfg.bulletSpeed,
      z: (dz / length) * cfg.bulletSpeed,
    };

    const bulletId = `bullet_${firingBot.id}_${performance.now()}`;
    bulletsRef.current.push({
      id: bulletId,
      ownerId: firingBot.id,
      position: { x: bPos.x, y: bPos.y + 1.2, z: bPos.z },
      velocity,
      damage: cfg.damage * 0.75, // Bots deal slightly scaled down damage for balance
      rangeRemaining: cfg.range,
      color: '#ef4444',
    });
  };

  // Damage processing logic
  const applyCombatDamage = (victim: Combatant, damage: number, attackerId: string) => {
    let finalDamage = damage;
    const isHeadshot = Math.random() < 0.22; // simulate random headshot chances

    if (isHeadshot) {
      finalDamage *= 2.0;
    }

    if (victim.armor > 0) {
      // Armor absorbs 50% damage
      victim.armor = Math.max(0, victim.armor - finalDamage * 0.4);
      victim.health = Math.max(0, victim.health - finalDamage * 0.6);
    } else {
      victim.health = Math.max(0, victim.health - finalDamage);
    }

    // Rounding
    finalDamage = Math.round(finalDamage);

    // Render floating popups on screen space
    if (attackerId === 'player') {
      SOUND_SYSTEM.playHitMarker(isHeadshot);
      setDamageDealt(prev => prev + finalDamage);

      // Procedural screen positioning
      const popupId = `popup_${performance.now()}_${Math.random()}`;
      const px = 50 + (Math.random() * 10 - 5);
      const py = 45 - (Math.random() * 10);
      
      setDamagePopups(prev => [
        ...prev,
        {
          id: popupId,
          text: isHeadshot ? `CRITICAL ${finalDamage}!` : `${finalDamage}`,
          x: px,
          y: py,
          color: isHeadshot ? 'text-yellow-400 font-extrabold text-lg' : 'text-zinc-100 font-bold',
        }
      ]);

      // Remove after duration
      setTimeout(() => {
        setDamagePopups(prev => prev.filter(p => p.id !== popupId));
      }, 800);
    }

    // Death Registration
    if (victim.health <= 0 && victim.state === 'alive') {
      victim.state = 'dead';

      // Log death Event
      const activeWepId = attackerId === 'player' 
        ? playerRef.current.inventory.weapons[playerRef.current.inventory.activeWeaponIndex] || 'm4a1'
        : 'Assault Rifle';
      
      const weaponName = getWeaponConfig(activeWepId).name;

      const killerName = attackerId === 'player' ? playerRef.current.name : (botsRef.current.find(b => b.id === attackerId)?.name || 'An AI Bot');

      const newFeed: KillFeedEvent = {
        id: `feed_${performance.now()}`,
        killerName,
        killerIsPlayer: attackerId === 'player',
        victimName: victim.name,
        victimIsPlayer: victim.id === 'player',
        weaponName,
        isHeadshot,
        timestamp: Date.now(),
      };

      setKillFeed(prev => [...prev, newFeed]);

      if (attackerId === 'player') {
        setKills(prev => prev + 1);
      }

      if (victim.id === 'player') {
        handlePlayerElimination(killerName);
      } else {
        // Drop dead loot crate at coordinates!
        lootRef.current.push({
          id: `loot_drop_${performance.now()}`,
          name: `${victim.name}'s Death Crate`,
          type: 'weapon',
          refId: victim.inventory.weapons[0] || 'm4a1',
          count: 1,
          position: { ...victim.position, y: victim.position.y + 0.3 },
        });
      }
    }
  };

  const handlePlayerElimination = (killer: string) => {
    SOUND_SYSTEM.playExplosion();
    playerRef.current.state = 'dead';
    setGameStatus('lost');
    
    // Save points
    const currentBotsAliveCount = botsRef.current.filter(b => b.state === 'alive').length;
    const finalPlacement = currentBotsAliveCount + 1;
    SAVE_SYSTEM.addMatchStats(kills, Math.round(kills * 0.1), damageDealt, finalPlacement);
  };

  // Reloading Trigger
  const handlePlayerReload = () => {
    if (isReloading.current || playerRef.current.state !== 'alive') return;
    SOUND_SYSTEM.playReload();
    isReloading.current = true;
    playerRef.current.action = 'reloading';

    // Reload takes 1.8 seconds standard
    setTimeout(() => {
      const activeWepId = playerRef.current.inventory.weapons[playerRef.current.inventory.activeWeaponIndex];
      if (activeWepId) {
        const cfg = getWeaponConfig(activeWepId);
        // Fill ammo
        const ammoType = cfg.type;
        playerRef.current.inventory.ammo[ammoType] = Math.max(0, playerRef.current.inventory.ammo[ammoType] + cfg.magSize);
      }
      isReloading.current = false;
      playerRef.current.action = 'idle';
    }, 1800);
  };

  const handleUseHealItem = (type: 'med' | 'shield') => {
    const inv = playerRef.current.inventory;
    if (playerRef.current.state !== 'alive') return;

    if (type === 'med' && inv.medkits > 0) {
      if (playerRef.current.health >= 100) return;
      inv.medkits--;
      playerRef.current.action = 'healing';
      SOUND_SYSTEM.playHeal();
      setTimeout(() => {
        playerRef.current.health = Math.min(100, playerRef.current.health + 40);
        playerRef.current.action = 'idle';
      }, 500);
    } else if (type === 'shield' && inv.shieldPotions > 0) {
      if (playerRef.current.armor >= 100) return;
      inv.shieldPotions--;
      playerRef.current.action = 'healing';
      SOUND_SYSTEM.playHeal();
      setTimeout(() => {
        playerRef.current.armor = Math.min(100, playerRef.current.armor + 50);
        playerRef.current.action = 'idle';
      }, 500);
    }
  };

  const handleWeaponSwitchIdx = (idx: number) => {
    playerRef.current.inventory.activeWeaponIndex = idx;
    SOUND_SYSTEM.playReload();
  };

  // Keyboard shortcut listener bridge to fire weapon
  useEffect(() => {
    if (gameState !== 'playing') return;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.button === 0) {
        // Left Click: Shoot!
        handlePlayerShoot();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        handlePlayerReload();
      }
      if (e.key === '1') handleWeaponSwitchIdx(0);
      if (e.key === '2') handleWeaponSwitchIdx(1);
      if (e.key === '3') handleWeaponSwitchIdx(2);
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gameState]);

  return (
    <div className="w-full h-screen bg-zinc-950 overflow-hidden relative select-none">
      {/* PORTRAIT ORIENTATION BLOCKER */}
      {isPortrait && (
        <div className="fixed inset-0 bg-zinc-950 z-[9999] flex flex-col items-center justify-center text-white p-6 text-center select-none animate-[fadeIn_0.3s_ease-out]">
          <div className="flex flex-col items-center max-w-sm">
            {/* Animated rotating phone icon */}
            <div className="w-24 h-24 mb-6 flex items-center justify-center relative">
              <div className="w-12 h-20 border-4 border-zinc-400 rounded-2xl animate-rotate-phone origin-center flex flex-col justify-between py-1.5">
                {/* Speaker bar */}
                <div className="w-4 h-[3px] bg-zinc-400 rounded-full mx-auto"></div>
                {/* Home button dot */}
                <div className="w-2.5 h-2.5 bg-zinc-400 rounded-full mx-auto"></div>
              </div>
              {/* Rotate Arrow overlay */}
              <div className="absolute inset-0 flex items-center justify-center text-amber-500 font-bold text-3xl animate-pulse">
                🔄
              </div>
            </div>
            
            <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase">ROTATE YOUR DEVICE</h2>
            <p className="text-zinc-300 text-sm mt-3 leading-relaxed">
              This 3D Battle Arena is optimized to run in **Landscape (Horizontal) mode** for the best layout and controls.
            </p>
            <p className="text-zinc-500 text-xs mt-6 border border-zinc-800/80 rounded-xl px-4 py-2.5 bg-zinc-900/40 font-mono">
              Please unlock your system auto-rotate setting and turn your phone horizontally to start playing!
            </p>
          </div>
        </div>
      )}

      {gameState === 'menu' ? (
        <MainMenu 
          profile={profile} 
          onUpdateProfile={(prof) => setProfile(prof)} 
          onStartMatch={handleStartMatch} 
        />
      ) : (
        <div className="w-full h-full relative">
          
          {/* THREEJS CANVAS MOUNT POINT */}
          <div ref={canvasRef} className="w-full h-full absolute inset-0 cursor-crosshair"></div>

          {/* FLOATING DAMAGE POPUPS RENDER */}
          {damagePopups.map((popup) => (
            <div 
              key={popup.id}
              className={`absolute pointer-events-none select-none font-sans text-shadow-lg ${popup.color} tracking-wider transition-all duration-700`}
              style={{
                left: `${popup.x}%`,
                top: `${popup.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {popup.text}
            </div>
          ))}

          {/* ACTIVE HUD INTERACTIVE INTERFACE */}
          <GameHUD
            player={playerRef.current}
            bots={botsRef.current}
            lootItems={lootRef.current}
            stormCenter={stormCenterRef.current}
            stormRadius={stormRadiusRef.current}
            nextStormCenter={nextStormCenterRef.current}
            nextStormRadius={nextStormRadiusRef.current}
            playersAlive={playersAlive}
            kills={kills}
            damageDealt={damageDealt}
            killFeed={killFeed}
            timerRemaining={timerRemaining}
            stormPhase={stormPhase}
            gameStatus={gameStatus}
            onUseHeal={handleUseHealItem}
            onReload={handlePlayerReload}
            onWeaponSwitch={handleWeaponSwitchIdx}
            onExitMatch={handleExitMatch}
            onMobileLook={(dx, dy) => {
              if (controllerRef.current) {
                controllerRef.current.applyLookDelta(dx, dy);
              }
            }}
            onMobileMove={(mx, mz) => {
              // Direct movement vector injection for joystick inputs
              if (controllerRef.current) {
                // Synthesize key moves based on analog vectors
                controllerRef.current.keys['w'] = mz < -0.2;
                controllerRef.current.keys['s'] = mz > 0.2;
                controllerRef.current.keys['a'] = mx < -0.2;
                controllerRef.current.keys['d'] = mx > 0.2;
              }
            }}
            onMobileAction={(action) => {
              if (action === 'shoot') handlePlayerShoot();
              if (action === 'reload') handlePlayerReload();
              if (action === 'jump' && controllerRef.current && controllerRef.current.isGrounded) {
                controllerRef.current.velocityY = 12.0;
                controllerRef.current.isGrounded = false;
              }
              if (action === 'crouch' && controllerRef.current) {
                controllerRef.current.toggleCrouch();
              }
              if (action === 'prone' && controllerRef.current) {
                controllerRef.current.toggleProne();
              }
              if (action === 'aim') {
                // ADS zoom toggling
                setSettings(prev => {
                  const newFov = prev.fov === 70 ? 35 : 70; // 2x Scope!
                  if (controllerRef.current) {
                    controllerRef.current.targetFov = newFov;
                  }
                  return { ...prev, fov: newFov };
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
