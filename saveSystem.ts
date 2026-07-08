/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameSettings, PlayerProfile, Mission, ShopItem } from '../types';

const STORAGE_KEYS = {
  PROFILE: '3d_br_profile',
  SETTINGS: '3d_br_settings',
};

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: 'medium',
  soundVolume: 0.7,
  musicVolume: 0.5,
  sensitivityX: 1.5,
  sensitivityY: 1.5,
  fov: 70,
  brightness: 1.0,
  showFPS: true,
  autoPickup: true,
  cameraMode: 'tps',
};

const DEFAULT_PROFILE: PlayerProfile = {
  username: 'Survivor_' + Math.floor(1000 + Math.random() * 9000),
  avatarId: '1',
  stats: {
    matchesPlayed: 0,
    wins: 0,
    kills: 0,
    headshots: 0,
    damageDealt: 0,
    rankPoints: 1000, // Bronze V starts at 1000
    xp: 0,
    level: 1,
    coins: 2000,
  },
  skins: {
    characters: ['recruit_male', 'recruit_female'],
    weapons: ['m4a1_standard', 'ak47_standard', 'awp_standard'],
    parachutes: ['para_standard'],
    backpacks: ['bag_standard'],
  },
  equippedCharacter: 'recruit_male',
  equippedWeaponSkin: {
    m4a1: 'm4a1_standard',
    ak47: 'ak47_standard',
    awp: 'awp_standard',
    mp5: 'mp5_standard',
    m1887: 'm1887_standard',
  },
  equippedParachute: 'para_standard',
  equippedBackpack: 'bag_standard',
  dailyRewardClaimedDate: '',
  battlePassTiersClaimed: [],
  completedMissions: [],
};

export const SAVE_SYSTEM = {
  loadSettings(): GameSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  loadProfile(): PlayerProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure robust structure
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          stats: { ...DEFAULT_PROFILE.stats, ...parsed.stats },
          skins: { ...DEFAULT_PROFILE.skins, ...parsed.skins },
          equippedWeaponSkin: { ...DEFAULT_PROFILE.equippedWeaponSkin, ...parsed.equippedWeaponSkin },
        };
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    }
    return DEFAULT_PROFILE;
  },

  saveProfile(profile: PlayerProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  },

  addMatchStats(kills: number, headshots: number, damage: number, position: number): { coinsEarned: number, xpEarned: number, rankPointsDiff: number, rankName: string } {
    const profile = this.loadProfile();
    const stats = profile.stats;

    // Calculators
    let coinsEarned = kills * 100 + (101 - position) * 15;
    if (position === 1) coinsEarned += 500; // Winner Bonus

    let xpEarned = kills * 50 + (101 - position) * 10;
    if (position === 1) xpEarned += 300;

    // Rank points adjustment based on matches
    let rankPointsDiff = kills * 15 + Math.floor((50 - position) * 1.5);
    if (position === 1) rankPointsDiff += 80;

    // Apply stats
    stats.matchesPlayed += 1;
    if (position === 1) stats.wins += 1;
    stats.kills += kills;
    stats.headshots += headshots;
    stats.damageDealt += damage;
    stats.coins += coinsEarned;
    stats.xp += xpEarned;
    stats.rankPoints = Math.max(0, stats.rankPoints + rankPointsDiff);

    // XP Level Up Check
    const xpNeededForNextLevel = stats.level * 1000;
    if (stats.xp >= xpNeededForNextLevel) {
      stats.xp -= xpNeededForNextLevel;
      stats.level += 1;
      stats.coins += 1000; // Level up reward
    }

    this.saveProfile(profile);

    return {
      coinsEarned,
      xpEarned,
      rankPointsDiff,
      rankName: this.getRankName(stats.rankPoints),
    };
  },

  getRankName(points: number): string {
    if (points < 1200) return 'Bronze V';
    if (points < 1400) return 'Bronze IV';
    if (points < 1600) return 'Silver I';
    if (points < 1800) return 'Silver III';
    if (points < 2000) return 'Gold I';
    if (points < 2200) return 'Gold IV';
    if (points < 2400) return 'Platinum I';
    if (points < 2600) return 'Platinum IV';
    if (points < 3000) return 'Diamond I';
    if (points < 3500) return 'Diamond IV';
    if (points < 4000) return 'Heroic';
    return 'Grandmaster';
  },

  getRankColor(points: number): string {
    if (points < 1200) return '#b07040'; // Bronze
    if (points < 1600) return '#9090a0'; // Silver
    if (points < 2000) return '#d0a020'; // Gold
    if (points < 2400) return '#00b0ff'; // Platinum
    if (points < 3500) return '#b000ff'; // Diamond
    return '#ff1050'; // Heroic/Grandmaster
  },

  claimDailyReward(): { success: boolean, rewardCoins: number } {
    const profile = this.loadProfile();
    const today = new Date().toISOString().split('T')[0];

    if (profile.dailyRewardClaimedDate === today) {
      return { success: false, rewardCoins: 0 };
    }

    const reward = 500;
    profile.dailyRewardClaimedDate = today;
    profile.stats.coins += reward;
    this.saveProfile(profile);

    return { success: true, rewardCoins: reward };
  },

  canClaimDailyReward(): boolean {
    const profile = this.loadProfile();
    const today = new Date().toISOString().split('T')[0];
    return profile.dailyRewardClaimedDate !== today;
  },
};

export const MISSIONS_LIST: Mission[] = [
  {
    id: 'daily_kill_3',
    title: 'Daily Hunter',
    description: 'Eliminate 3 opponents in Battle Royale mode.',
    target: 3,
    current: 0,
    rewardCoins: 200,
    rewardXp: 150,
    completed: false,
  },
  {
    id: 'daily_win',
    title: 'Victory Lap',
    description: 'Achieve Booyah! (Rank 1st in a match).',
    target: 1,
    current: 0,
    rewardCoins: 500,
    rewardXp: 400,
    completed: false,
  },
  {
    id: 'daily_damage_500',
    title: 'Warmonger',
    description: 'Deal 500 total damage to enemies.',
    target: 500,
    current: 0,
    rewardCoins: 150,
    rewardXp: 100,
    completed: false,
  },
  {
    id: 'daily_survival_10',
    title: 'Survivor Spirit',
    description: 'Survive in a match for more than 4 minutes.',
    target: 1,
    current: 0,
    rewardCoins: 250,
    rewardXp: 200,
    completed: false,
  },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Characters
  { id: 'character_kelly', name: 'Alok (Speed Booster)', category: 'character', price: 5000, currency: 'coins', rarity: 'legendary', previewColor: '#ff003c' },
  { id: 'character_maxim', name: 'Kelly (Glider)', category: 'character', price: 2500, currency: 'coins', rarity: 'epic', previewColor: '#ffaa00' },
  { id: 'character_hayato', name: 'Chrono (Shield)', category: 'character', price: 6000, currency: 'coins', rarity: 'legendary', previewColor: '#00ccff' },
  // Weapon Skins
  { id: 'skin_m4a1_golden', name: 'M4A1 - Golden Dragon', category: 'weapon', price: 3000, currency: 'coins', rarity: 'epic', previewColor: '#ffe600' },
  { id: 'skin_ak47_fire', name: 'AK47 - Crimson Fury', category: 'weapon', price: 5000, currency: 'coins', rarity: 'legendary', previewColor: '#ff1a00' },
  { id: 'skin_awp_cyber', name: 'AWP - Neon Cyber', category: 'weapon', price: 4000, currency: 'coins', rarity: 'epic', previewColor: '#d400ff' },
  // Parachutes
  { id: 'para_skull', name: 'Skull Fire Glider', category: 'parachute', price: 1500, currency: 'coins', rarity: 'rare', previewColor: '#ff3333' },
  { id: 'para_military', name: 'Digital Camo Glider', category: 'parachute', price: 1000, currency: 'coins', rarity: 'common', previewColor: '#3d611b' },
  // Backpacks
  { id: 'bag_cyber', name: 'Retro Cyberpack', category: 'backpack', price: 1800, currency: 'coins', rarity: 'rare', previewColor: '#00ffff' },
  { id: 'bag_gold', name: 'Championship Sack', category: 'backpack', price: 3500, currency: 'coins', rarity: 'legendary', previewColor: '#ffe552' },
];
