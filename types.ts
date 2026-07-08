/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GameSettings {
  graphics: 'low' | 'medium' | 'high';
  soundVolume: number;
  musicVolume: number;
  sensitivityX: number;
  sensitivityY: number;
  fov: number;
  brightness: number;
  showFPS: boolean;
  autoPickup: boolean;
  cameraMode: 'tps' | 'fps';
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  rankPoints: number; // For bronze, silver, gold, platinum, etc.
  xp: number;
  level: number;
  coins: number;
}

export interface UnlockedSkins {
  characters: string[];
  weapons: string[];
  parachutes: string[];
  backpacks: string[];
}

export interface PlayerProfile {
  username: string;
  avatarId: string;
  stats: PlayerStats;
  skins: UnlockedSkins;
  equippedCharacter: string;
  equippedWeaponSkin: { [weaponId: string]: string };
  equippedParachute: string;
  equippedBackpack: string;
  dailyRewardClaimedDate: string; // YYYY-MM-DD
  battlePassTiersClaimed: number[];
  completedMissions: string[];
}

export enum WeaponType {
  PISTOL = 'Pistol',
  SMG = 'SMG',
  AR = 'Assault Rifle',
  SHOTGUN = 'Shotgun',
  SNIPER = 'Sniper',
  RPG = 'RPG',
  MELEE = 'Melee',
}

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // millisecond delay
  range: number;
  accuracy: number; // 0 to 1
  recoil: number; // camera kick
  magSize: number;
  reloadTime: number; // ms
  bulletSpeed: number;
  color: string;
  icon: string;
}

export interface LootItem {
  id: string;
  name: string;
  type: 'weapon' | 'ammo' | 'med' | 'armor' | 'helmet';
  refId: string; // weaponId or item subtype (e.g., 'med_kit', 'armor_lvl2')
  count: number;
  position: { x: number; y: number; z: number };
}

export interface BulletState {
  id: string;
  ownerId: string; // 'player' or bot ID
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  damage: number;
  rangeRemaining: number;
  color: string;
}

export interface Combatant {
  id: string;
  name: string;
  isBot: boolean;
  health: number;
  armor: number; // 0-100
  helmet: number; // 0-100
  inventory: {
    weapons: (string | null)[]; // Max 3 slots: Primary, Secondary, Melee/Special
    activeWeaponIndex: number;
    ammo: { [type: string]: number };
    medkits: number;
    shieldPotions: number;
  };
  position: { x: number; y: number; z: number };
  rotationY: number;
  pitch: number; // for vertical aim
  state: 'alive' | 'knocked' | 'dead';
  action: 'idle' | 'walking' | 'running' | 'sprinting' | 'shooting' | 'reloading' | 'healing';
  targetEnemyId: string | null;
  botLevel?: 'easy' | 'medium' | 'hard';
  rank?: string;
  colorHex?: string;
}

export interface KillFeedEvent {
  id: string;
  killerName: string;
  killerIsPlayer: boolean;
  victimName: string;
  victimIsPlayer: boolean;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  rewardCoins: number;
  rewardXp: number;
  completed: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  category: 'character' | 'weapon' | 'parachute' | 'backpack';
  price: number;
  currency: 'coins' | 'diamonds';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  previewColor: string;
}
