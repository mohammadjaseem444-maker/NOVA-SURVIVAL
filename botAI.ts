/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Combatant, LootItem, WeaponConfig } from '../types';
import { getTerrainHeight } from './mapGenerator';
import { WEAPON_PRESETS } from './weapons';

const BOT_NAMES = [
  'AWM_Sniper', 'BulletProof', 'ShadowKiller', 'TombRider', 'HeadHunter',
  'AlphaSurvivor', 'GhostWalk', 'ApexPredator', 'CobraCommander', 'NinjaBlade',
  'DoomBringer', 'ZeroFear', 'Speedy_G', 'VortexMax', 'Rampage_Pro',
  'SkyGlider', 'CrimsonLord', 'SilentDeath', 'DarkWolf', 'StormRider',
  'PhoenixUp', 'Calamity', 'Rogue_One', 'SlayerBoy', 'ValkyrieX',
  'WildFire', 'Thunder_OP', 'RogueBlade', 'ViperFangs', 'SkullSmasher',
  'Wanderer', 'Phantom_BR', 'SavageGamer', 'TitanForce', 'BlazeOut',
  'IceShield', 'WarMachine', 'ApexHero', 'ToxicCobra', 'Reaper99',
  'RangerPro', 'SledgeHammer', 'VenomDart', 'DeadShot', 'GhostRider',
  'IronClad', 'SteelBlade', 'OverLord', 'FrostByte', 'ChronoShield',
];

export function generateInitialBots(count: number): Combatant[] {
  const bots: Combatant[] = [];
  const levels: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

  for (let i = 0; i < count; i++) {
    // Distribute randomly across the 500x500 map (excluding exact dead boundaries)
    const bx = (Math.random() * 400) - 200;
    const bz = (Math.random() * 400) - 200;
    const by = getTerrainHeight(bx, bz);

    const name = BOT_NAMES[i % BOT_NAMES.length] + '_' + Math.floor(10 + Math.random() * 90);
    const level = levels[Math.floor(Math.random() * levels.length)];

    // Give bots random initial weapons
    const weaponIds = ['m4a1', 'ak47', 'mp5', 'm1887', 'awp'];
    const primaryWeapon = weaponIds[Math.floor(Math.random() * weaponIds.length)];

    bots.push({
      id: `bot_${i}`,
      name,
      isBot: true,
      health: 100,
      armor: Math.random() > 0.4 ? (Math.random() > 0.5 ? 100 : 50) : 0,
      helmet: Math.random() > 0.4 ? (Math.random() > 0.5 ? 100 : 50) : 0,
      inventory: {
        weapons: [primaryWeapon, 'm4a1', null], // primary, secondary, melee
        activeWeaponIndex: 0,
        ammo: {
          'Assault Rifle': 120,
          'SMG': 150,
          'Shotgun': 16,
          'Sniper': 15,
        },
        medkits: Math.floor(Math.random() * 3),
        shieldPotions: Math.floor(Math.random() * 2),
      },
      position: { x: bx, y: by, z: bz },
      rotationY: Math.random() * Math.PI * 2,
      pitch: 0,
      state: 'alive',
      action: 'idle',
      targetEnemyId: null,
      botLevel: level,
      rank: level === 'hard' ? 'Heroic' : (level === 'medium' ? 'Gold' : 'Bronze'),
      colorHex: '#' + Math.floor(Math.random()*16777215).toString(16),
    });
  }

  return bots;
}

export function updateBotAI(
  bot: Combatant,
  player: Combatant,
  otherBots: Combatant[],
  lootItems: LootItem[],
  stormCenter: { x: number; z: number },
  stormRadius: number,
  deltaTime: number,
  onShoot: (bot: Combatant, target: Combatant) => void
): void {
  if (bot.state !== 'alive') return;

  const bPos = bot.position;

  // 1. Storm warning check: Am I outside the storm? Run to safety!
  const distToStormCenter = Math.sqrt(Math.pow(bPos.x - stormCenter.x, 2) + Math.pow(bPos.z - stormCenter.z, 2));
  const isOutsideStorm = distToStormCenter > (stormRadius - 10); // Run early

  // 2. Scan for nearest targets (Player or other Bots)
  let nearestTarget: Combatant | null = null;
  let minDist = 80; // Detection range

  // Easy/Medium/Hard variations of range
  if (bot.botLevel === 'hard') minDist = 120;
  if (bot.botLevel === 'easy') minDist = 50;

  // Check player distance
  if (player.state === 'alive') {
    const dPlayer = Math.sqrt(Math.pow(bPos.x - player.position.x, 2) + Math.pow(bPos.z - player.position.z, 2));
    if (dPlayer < minDist) {
      nearestTarget = player;
      minDist = dPlayer;
    }
  }

  // Check other bots
  otherBots.forEach(other => {
    if (other.id !== bot.id && other.state === 'alive') {
      const dOther = Math.sqrt(Math.pow(bPos.x - other.position.x, 2) + Math.pow(bPos.z - other.position.z, 2));
      if (dOther < minDist) {
        nearestTarget = other;
        minDist = dOther;
      }
    }
  });

  // Action decisions
  if (bot.health < 40 && bot.inventory.medkits > 0 && !isOutsideStorm && Math.random() < 0.05) {
    // Wounded, try to heal
    bot.action = 'healing';
    bot.health = Math.min(100, bot.health + 30);
    bot.inventory.medkits--;
    return;
  }

  if (isOutsideStorm) {
    // Prioritize running directly towards storm center
    bot.action = 'running';
    bot.targetEnemyId = null;

    const angle = Math.atan2(stormCenter.z - bPos.z, stormCenter.x - bPos.x);
    bot.rotationY = angle;

    const speed = bot.botLevel === 'hard' ? 7.0 : 5.5; // Hard bots run faster
    bPos.x += Math.cos(angle) * speed * deltaTime;
    bPos.z += Math.sin(angle) * speed * deltaTime;
    bPos.y = getTerrainHeight(bPos.x, bPos.z);
    return;
  }

  if (nearestTarget) {
    bot.targetEnemyId = nearestTarget.id;
    const tPos = nearestTarget.position;
    const dist = minDist;

    // Point rotation to target
    const angleToTarget = Math.atan2(tPos.z - bPos.z, tPos.x - bPos.x);
    bot.rotationY = angleToTarget;

    const activeWepId = bot.inventory.weapons[bot.inventory.activeWeaponIndex] || 'm4a1';
    const wepConfig = WEAPON_PRESETS[activeWepId] || WEAPON_PRESETS.m4a1;

    if (dist > wepConfig.range * 0.8) {
      // Move closer (Rushing)
      bot.action = 'running';
      bPos.x += Math.cos(angleToTarget) * 4.5 * deltaTime;
      bPos.z += Math.sin(angleToTarget) * 4.5 * deltaTime;
    } else {
      // Shooting stance or circling target
      bot.action = 'shooting';

      // Circle movement simulation
      const circleAngle = angleToTarget + Math.PI / 2;
      bPos.x += Math.cos(circleAngle) * 1.5 * deltaTime * (Math.random() > 0.5 ? 1 : -1);
      bPos.z += Math.sin(circleAngle) * 1.5 * deltaTime * (Math.random() > 0.5 ? 1 : -1);

      // Roll chance to fire a shot
      const shootChance = bot.botLevel === 'hard' ? 0.08 : (bot.botLevel === 'medium' ? 0.04 : 0.015);
      if (Math.random() < shootChance) {
        onShoot(bot, nearestTarget);
      }
    }

    bPos.y = getTerrainHeight(bPos.x, bPos.z);
  } else {
    // Wander around procedurally looking for fights or loot
    bot.targetEnemyId = null;
    bot.action = 'walking';

    // Soft rotation changes
    if (Math.random() < 0.02) {
      bot.rotationY += (Math.random() * Math.PI) - (Math.PI / 2);
    }

    const speed = 2.5;
    bPos.x += Math.cos(bot.rotationY) * speed * deltaTime;
    bPos.z += Math.sin(bot.rotationY) * speed * deltaTime;

    // Boundaries bounce back
    if (Math.abs(bPos.x) > 230) {
      bot.rotationY += Math.PI;
      bPos.x = Math.max(-230, Math.min(230, bPos.x));
    }
    if (Math.abs(bPos.z) > 230) {
      bot.rotationY += Math.PI;
      bPos.z = Math.max(-230, Math.min(230, bPos.z));
    }

    bPos.y = getTerrainHeight(bPos.x, bPos.z);

    // Pick up nearby ground loot if extremely close
    lootItems.forEach((loot, idx) => {
      const dLoot = Math.sqrt(Math.pow(bPos.x - loot.position.x, 2) + Math.pow(bPos.z - loot.position.z, 2));
      if (dLoot < 3.0 && Math.random() < 0.1) {
        // Simple auto pickup logic for bots
        if (loot.type === 'med' && bot.inventory.medkits < 4) {
          bot.inventory.medkits++;
          lootItems.splice(idx, 1);
        } else if (loot.type === 'armor' && bot.armor < 100) {
          bot.armor = 100;
          lootItems.splice(idx, 1);
        }
      }
    });
  }
}
