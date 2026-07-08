/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeaponConfig, WeaponType } from '../types';

export const WEAPON_PRESETS: { [id: string]: WeaponConfig } = {
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 Assault',
    type: WeaponType.AR,
    damage: 32,
    fireRate: 140, // ms between shots
    range: 120,
    accuracy: 0.85,
    recoil: 0.015,
    magSize: 30,
    reloadTime: 1800, // ms
    bulletSpeed: 300,
    color: '#34d399', // Greenish-cyan trail
    icon: '⚔️',
  },
  ak47: {
    id: 'ak47',
    name: 'AK47 Redline',
    type: WeaponType.AR,
    damage: 42,
    fireRate: 180,
    range: 110,
    accuracy: 0.72,
    recoil: 0.028,
    magSize: 30,
    reloadTime: 2200,
    bulletSpeed: 280,
    color: '#ef4444', // Red trail
    icon: '🔫',
  },
  mp5: {
    id: 'mp5',
    name: 'MP5 Cobra',
    type: WeaponType.SMG,
    damage: 22,
    fireRate: 90,
    range: 60,
    accuracy: 0.78,
    recoil: 0.01,
    magSize: 40,
    reloadTime: 1500,
    bulletSpeed: 240,
    color: '#38bdf8', // Light blue trail
    icon: '⚡',
  },
  m1887: {
    id: 'm1887',
    name: 'M1887 Shotgun',
    type: WeaponType.SHOTGUN,
    damage: 96, // High damage but multi-pellet spread simulation
    fireRate: 850,
    range: 30,
    accuracy: 0.45,
    recoil: 0.08,
    magSize: 2,
    reloadTime: 2500,
    bulletSpeed: 180,
    color: '#fbbf24', // Yellow trail
    icon: '💥',
  },
  awp: {
    id: 'awp',
    name: 'AWP Sniper',
    type: WeaponType.SNIPER,
    damage: 150, // Massive damage
    fireRate: 1800,
    range: 300,
    accuracy: 0.98,
    recoil: 0.12,
    magSize: 5,
    reloadTime: 3200,
    bulletSpeed: 450,
    color: '#a855f7', // Purple trail
    icon: '🔭',
  },
  rpg: {
    id: 'rpg',
    name: 'RPG Launcher',
    type: WeaponType.RPG,
    damage: 180, // Area of effect damage
    fireRate: 2500,
    range: 150,
    accuracy: 0.9,
    recoil: 0.15,
    magSize: 1,
    reloadTime: 4000,
    bulletSpeed: 120,
    color: '#f97316', // Orange trail
    icon: '🚀',
  },
  katana: {
    id: 'katana',
    name: 'Dragon Blade',
    type: WeaponType.MELEE,
    damage: 55,
    fireRate: 400,
    range: 4,
    accuracy: 1.0,
    recoil: 0,
    magSize: 999, // Infinite
    reloadTime: 0,
    bulletSpeed: 0,
    color: '#ff007f', // Pink trail
    icon: '🗡️',
  },
};

export function getWeaponConfig(id: string): WeaponConfig {
  return WEAPON_PRESETS[id] || WEAPON_PRESETS.m4a1;
}

export const SKIN_DESCRIPTIONS: { [skinId: string]: { name: string, bg: string, color: string } } = {
  m4a1_standard: { name: 'Carbon Black', bg: 'bg-zinc-800', color: '#1e293b' },
  skin_m4a1_golden: { name: 'Golden Dragon', bg: 'bg-gradient-to-r from-yellow-500 to-amber-600', color: '#d97706' },
  ak47_standard: { name: 'Military Camo', bg: 'bg-emerald-800', color: '#115e59' },
  skin_ak47_fire: { name: 'Crimson Fury', bg: 'bg-gradient-to-r from-red-600 to-orange-600', color: '#dc2626' },
  awp_standard: { name: 'Arctic Camo', bg: 'bg-sky-700', color: '#0369a1' },
  skin_awp_cyber: { name: 'Neon Cyber', bg: 'bg-gradient-to-r from-purple-600 to-fuchsia-600', color: '#9333ea' },
  mp5_standard: { name: 'Shadow Black', bg: 'bg-zinc-700', color: '#374151' },
  m1887_standard: { name: 'Woodland Hunter', bg: 'bg-amber-900', color: '#78350f' },
};
