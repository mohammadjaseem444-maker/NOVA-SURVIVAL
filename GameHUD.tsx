/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Combatant, LootItem, KillFeedEvent, WeaponConfig } from '../types';
import { getWeaponConfig } from '../game/weapons';
import { SOUND_SYSTEM } from '../game/soundSystem';

interface GameHUDProps {
  player: Combatant;
  bots: Combatant[];
  lootItems: LootItem[];
  stormCenter: { x: number; z: number };
  stormRadius: number;
  nextStormCenter: { x: number; z: number };
  nextStormRadius: number;
  playersAlive: number;
  kills: number;
  damageDealt: number;
  killFeed: KillFeedEvent[];
  timerRemaining: number;
  stormPhase: number;
  gameStatus: 'playing' | 'won' | 'lost';
  onUseHeal: (type: 'med' | 'shield') => void;
  onReload: () => void;
  onWeaponSwitch: (idx: number) => void;
  onExitMatch: () => void;
  onMobileLook: (dx: number, dy: number) => void;
  onMobileMove: (moveX: number, moveZ: number) => void;
  onMobileAction: (action: string) => void;
}

export default function GameHUD({
  player,
  bots,
  lootItems,
  stormCenter,
  stormRadius,
  nextStormCenter,
  nextStormRadius,
  playersAlive,
  kills,
  damageDealt,
  killFeed,
  timerRemaining,
  stormPhase,
  gameStatus,
  onUseHeal,
  onReload,
  onWeaponSwitch,
  onExitMatch,
  onMobileLook,
  onMobileMove,
  onMobileAction,
}: GameHUDProps) {
  const [showMobileControls, setShowMobileControls] = useState(true);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  // Compass degrees calculator
  const degrees = Math.round((player.rotationY * (180 / Math.PI)) % 360);
  const positiveDegrees = degrees < 0 ? degrees + 360 : degrees;

  const getCompassDirection = (deg: number): string => {
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    if (deg >= 292.5 && deg < 337.5) return 'NW';
    return 'N';
  };

  const activeWepId = player.inventory.weapons[player.inventory.activeWeaponIndex];
  const activeWep: WeaponConfig | null = activeWepId ? getWeaponConfig(activeWepId) : null;

  // Custom styles for compass indicator
  const compassOffset = -(positiveDegrees * 2);

  // Render ground items nearby (loot feed list)
  const nearbyLoot = lootItems.filter(item => {
    const dist = Math.sqrt(
      Math.pow(player.position.x - item.position.x, 2) +
      Math.pow(player.position.z - item.position.z, 2)
    );
    return dist < 4.5;
  });

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between font-sans select-none text-white overflow-hidden">
      {/* TOP HEADER: Compass & Stats & Minimap */}
      <div className="w-full flex justify-between p-4 items-start relative z-10">
        
        {/* LEFTSIDE: Match stats & Player vitals feedback */}
        <div className="flex flex-col gap-1 pointer-events-auto bg-black/50 backdrop-blur-md p-3 rounded-xl border border-zinc-700/50">
          <div className="flex gap-4 text-xs font-mono font-medium">
            <div className="text-zinc-400">ALIVE: <span className="text-emerald-400 font-bold text-sm">{playersAlive}</span></div>
            <div className="text-zinc-400">KILLS: <span className="text-rose-400 font-bold text-sm">{kills}</span></div>
            <div className="text-zinc-400">DAMAGE: <span className="text-amber-400 font-bold text-sm">{damageDealt}</span></div>
          </div>
          
          {/* Storm shrink indicator */}
          <div className="text-[11px] font-mono text-amber-500 mt-1 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Storm Phase {stormPhase} • Shrinking in: {Math.max(0, Math.round(timerRemaining))}s
          </div>
        </div>

        {/* CENTER COMPASS */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 w-64 backdrop-blur-sm shadow-2xl">
          <div className="text-xs font-mono font-extrabold tracking-widest text-amber-400 flex items-center gap-1.5">
            <span>{positiveDegrees}°</span>
            <span className="text-white px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">{getCompassDirection(positiveDegrees)}</span>
          </div>
          <div className="w-full h-5 mt-1 overflow-hidden relative border-t border-zinc-800">
            <div 
              className="flex justify-center text-[10px] font-mono absolute transition-all duration-75"
              style={{ 
                width: '720px', 
                left: `calc(50% - 360px + ${compassOffset}px)`,
                display: 'flex',
                gap: '40px'
              }}
            >
              <span>N</span><span>45</span><span>E</span><span>135</span><span>S</span><span>225</span><span>W</span><span>315</span>
              <span>N</span><span>45</span><span>E</span><span>135</span><span>S</span><span>225</span><span>W</span><span>315</span>
            </div>
            {/* Center tick indicator */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500"></div>
          </div>
        </div>

        {/* RIGHTSIDE: Mini Map (Interactive Canvas-style render using standard HTML canvas!) */}
        <div className="flex flex-col gap-2 pointer-events-auto items-end">
          <div className="w-32 h-32 bg-zinc-950/85 border-2 border-zinc-800 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-xl">
            {/* Simple Grid and safe zones relative */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:10px_10px]"></div>
            
            {/* Procedural landmarks representation */}
            <div className="absolute text-[7px] font-mono font-bold text-zinc-500 select-none pointer-events-none text-center">
              <div className="absolute -top-12 -left-12 text-blue-400/50">MILITARY</div>
              <div className="absolute top-10 left-10 text-amber-400/50">VILLAGE</div>
              <div className="absolute -top-2 left-10 text-emerald-400/50">FACTORY</div>
              <div className="absolute top-12 -left-10 text-purple-400/50">POWER</div>
            </div>

            {/* Dynamic Map Canvas dots */}
            <div className="absolute w-full h-full">
              {/* Map Bounds center calculation */}
              {/* Map coordinates go from -250 to 250. Convert to 0% - 100% */}
              {/* Player dot */}
              <div 
                className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white shadow-lg flex items-center justify-center"
                style={{
                  left: `${((player.position.x + 250) / 500) * 100}%`,
                  top: `${((player.position.z + 250) / 500) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div 
                  className="w-1.5 h-1.5 border-t-2 border-l-2 border-white rotate-45 mt-0.5"
                  style={{ transform: `rotate(${positiveDegrees + 45}deg)` }}
                ></div>
              </div>

              {/* Bots dots (if within range or active match) */}
              {bots.map((bot, i) => {
                if (bot.state !== 'alive') return null;
                const distToPlayer = Math.sqrt(Math.pow(player.position.x - bot.position.x, 2) + Math.pow(player.position.z - bot.position.z, 2));
                // Only show bots if they are shooting or within 100m sensor sweep
                if (distToPlayer > 120) return null;

                return (
                  <div 
                    key={i}
                    className={`absolute w-1.5 h-1.5 rounded-full border border-black shadow-md ${bot.action === 'shooting' ? 'bg-red-500 animate-ping' : 'bg-rose-500'}`}
                    style={{
                      left: `${((bot.position.x + 250) / 500) * 100}%`,
                      top: `${((bot.position.z + 250) / 500) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}

              {/* Storm Outer Area Cylinder representation */}
              <div 
                className="absolute rounded-full border border-purple-500/50 bg-purple-500/10 pointer-events-none transition-all duration-300"
                style={{
                  left: `${((stormCenter.x + 250) / 500) * 100}%`,
                  top: `${((stormCenter.z + 250) / 500) * 100}%`,
                  width: `${(stormRadius / 500) * 200}%`,
                  height: `${(stormRadius / 500) * 200}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />

              {/* Safe zone target inner circle */}
              <div 
                className="absolute rounded-full border border-white/60 pointer-events-none transition-all duration-300"
                style={{
                  left: `${((nextStormCenter.x + 250) / 500) * 100}%`,
                  top: `${((nextStormCenter.z + 250) / 500) * 100}%`,
                  width: `${(nextStormRadius / 500) * 200}%`,
                  height: `${(nextStormRadius / 500) * 200}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
            
            {/* Safe zone label indicator */}
            <div className="absolute bottom-1 w-full text-center text-[8px] text-zinc-400 font-mono">
              MAP RANGE: 500M
            </div>
          </div>
          
          <button 
            onClick={() => setShowMobileControls(!showMobileControls)}
            className="text-[10px] bg-zinc-800 border border-zinc-700 px-2 py-1 rounded hover:bg-zinc-700"
          >
            {showMobileControls ? 'Hide Touch HUD' : 'Show Touch HUD'}
          </button>
        </div>
      </div>

      {/* MID-SCREEN: Crosshair & Kill Feed */}
      <div className="flex-1 w-full relative flex items-center justify-center">
        {/* Dynamic Target Crosshair */}
        <div className="absolute pointer-events-none flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
          <div className="absolute w-6 h-[1.5px] bg-emerald-400/60 left-4"></div>
          <div className="absolute w-6 h-[1.5px] bg-emerald-400/60 -left-4"></div>
          <div className="absolute w-[1.5px] h-6 bg-emerald-400/60 top-4"></div>
          <div className="absolute w-[1.5px] h-6 bg-emerald-400/60 -top-4"></div>
        </div>

        {/* KILL FEED TICKER - Elegant overlay on top right */}
        <div className="absolute right-4 top-4 flex flex-col gap-1 max-h-36 overflow-hidden pointer-events-none select-none">
          {killFeed.slice(-4).map((feed) => (
            <div 
              key={feed.id} 
              className="flex items-center gap-1.5 text-[11px] font-mono bg-black/60 px-3 py-1.5 rounded-lg border border-zinc-800/60 text-zinc-300 animate-[fadeIn_0.2s_ease-out]"
            >
              <span className={feed.killerIsPlayer ? 'text-emerald-400 font-bold' : 'text-zinc-200'}>
                {feed.killerName}
              </span>
              <span className="text-zinc-500">eliminated</span>
              <span className={feed.victimIsPlayer ? 'text-rose-500 font-bold' : 'text-zinc-300'}>
                {feed.victimName}
              </span>
              <span className="text-zinc-500">with</span>
              <span className="text-amber-400 font-medium px-1 bg-amber-500/10 rounded border border-amber-500/20">
                {feed.weaponName}
              </span>
              {feed.isHeadshot && <span className="text-red-500 font-extrabold animate-bounce">💀 HS</span>}
            </div>
          ))}
        </div>

        {/* GROUND LOOT QUICK PICKUP BOX */}
        {nearbyLoot.length > 0 && (
          <div className="absolute bottom-28 bg-zinc-950/90 border border-zinc-800 p-3 rounded-2xl w-60 pointer-events-auto flex flex-col gap-2 backdrop-blur-md shadow-2xl animate-bounce">
            <div className="text-[10px] font-bold text-zinc-500 tracking-wider">GROUND LOOT (PRESS 'F')</div>
            <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto">
              {nearbyLoot.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-zinc-900 px-2 py-1.5 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-base">📦</span>
                    <span className="font-semibold">{item.name}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Qty: {item.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CONSOLE: Health, Weapons, Action Trigger Overlays */}
      <div className="w-full flex justify-between p-4 items-end gap-4 relative z-10">
        
        {/* MOBILE CONTROLS: Left Side movement joystick */}
        {showMobileControls && (
          <div 
            className="w-36 h-36 bg-black/25 rounded-full border border-white/10 flex items-center justify-center pointer-events-auto relative cursor-grab active:cursor-grabbing"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              setTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const dx = touch.clientX - touchStart.x;
              const dy = touch.clientY - touchStart.y;
              // Normalize coordinate offsets to force a movement factor
              const factorX = Math.max(-1, Math.min(1, dx / 40));
              const factorZ = Math.max(-1, Math.min(1, dy / 40));
              onMobileMove(factorX, factorZ);
            }}
            onTouchEnd={() => {
              onMobileMove(0, 0);
            }}
          >
            <div className="w-12 h-12 bg-white/20 border border-white/40 rounded-full shadow-inner flex items-center justify-center">
              <div className="w-4 h-4 bg-white/60 rounded-full"></div>
            </div>
            <span className="absolute bottom-1 text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-extrabold">Joystick</span>
          </div>
        )}

        {/* CENTER COLUMN: Vitals Gauges, Weapons, Heals */}
        <div className="flex-1 max-w-xl flex flex-col gap-3">
          
          {/* Health & Shield Gauges */}
          <div className="bg-zinc-950/85 border border-zinc-800/80 rounded-2xl p-3 landscape:p-2 backdrop-blur-md shadow-2xl flex flex-col landscape:flex-row landscape:items-center landscape:gap-4 gap-2.5 pointer-events-auto">
            {/* Shield / Armor slot */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-sky-400 font-bold font-mono">ARMOR: {player.armor}%</span>
              <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-300" 
                  style={{ width: `${player.armor}%` }}
                />
              </div>
            </div>

            {/* Health segment */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-rose-500 font-bold font-mono font-extrabold">HP: {player.health}</span>
              <div className="flex-1 h-3.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-500 transition-all duration-150 flex items-center justify-end px-1" 
                  style={{ width: `${player.health}%` }}
                >
                  <span className="text-[8px] text-white/50 font-mono font-bold">100m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weapons Tray & Quick Heal Selector */}
          <div className="flex gap-2 w-full pointer-events-auto">
            {/* Quick Healing utilities */}
            <div className="flex flex-col gap-1 bg-zinc-950/85 border border-zinc-800 p-2 rounded-2xl justify-center items-center backdrop-blur-sm shadow-xl">
              <button 
                onClick={() => {
                  SOUND_SYSTEM.playClick();
                  onUseHeal('med');
                }}
                className="w-11 h-11 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-sm active:scale-95 transition-all text-rose-400"
              >
                <span>➕</span>
                <span className="text-[9px] font-mono font-bold text-white mt-0.5">{player.inventory.medkits}</span>
              </button>
              <button 
                onClick={() => {
                  SOUND_SYSTEM.playClick();
                  onUseHeal('shield');
                }}
                className="w-11 h-11 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-sm active:scale-95 transition-all text-sky-400"
              >
                <span>🧪</span>
                <span className="text-[9px] font-mono font-bold text-white mt-0.5">{player.inventory.shieldPotions}</span>
              </button>
            </div>

            {/* 3 Hotkey weapon items */}
            <div className="flex-1 grid grid-cols-3 gap-2 bg-zinc-950/85 border border-zinc-800 p-2 rounded-2xl backdrop-blur-sm shadow-xl">
              {[0, 1, 2].map((idx) => {
                const wepId = player.inventory.weapons[idx];
                const cfg = wepId ? getWeaponConfig(wepId) : null;
                const isActive = player.inventory.activeWeaponIndex === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      SOUND_SYSTEM.playClick();
                      onWeaponSwitch(idx);
                    }}
                    className={`h-24 rounded-xl border flex flex-col justify-between p-2.5 transition-all active:scale-95 text-left relative overflow-hidden ${
                      isActive 
                        ? 'bg-gradient-to-br from-amber-500/20 to-zinc-900 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Hotkey tag */}
                    <span className="absolute top-1 right-2 text-[8px] font-mono text-zinc-500 font-extrabold uppercase">SLOT {idx + 1}</span>

                    {cfg ? (
                      <>
                        <span className="text-xl">{cfg.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-extrabold text-white truncate max-w-full">{cfg.name}</span>
                          <span className="text-[8px] text-zinc-400 font-mono tracking-widest">{cfg.type}</span>
                        </div>
                        {/* Ammo Counter */}
                        {cfg.id !== 'katana' ? (
                          <div className="text-[11px] font-mono font-bold text-amber-400 self-end mt-1">
                            {cfg.magSize} <span className="text-zinc-500 text-[9px]">/ {player.inventory.ammo[cfg.type] || 0}</span>
                          </div>
                        ) : (
                          <div className="text-[9px] font-mono text-emerald-400 self-end mt-1 font-extrabold">READY</div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px] font-mono italic">
                        Empty
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MOBILE CONTROLS: Right Side fire & tactical trigger buttons */}
        {showMobileControls && (
          <div className="flex flex-col gap-2 items-end pointer-events-auto">
            {/* Aim Swipe Screen emulator box to look around easily */}
            <div 
              className="w-48 h-24 bg-black/30 border border-zinc-800 rounded-2xl flex items-center justify-center relative cursor-move"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                setTouchStart({ x: touch.clientX, y: touch.clientY });
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const dx = touch.clientX - touchStart.x;
                const dy = touch.clientY - touchStart.y;
                onMobileLook(dx, dy);
                setTouchStart({ x: touch.clientX, y: touch.clientY });
              }}
            >
              <span className="text-[9px] font-mono text-zinc-500 tracking-wider text-center animate-pulse">SWIPE TO AIM</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => onMobileAction('crouch')}
                className="w-12 h-12 bg-zinc-950/90 border border-zinc-700/80 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-zinc-800 active:scale-90 shadow-xl"
              >
                🛋️
              </button>
              <button 
                onClick={() => onMobileAction('prone')}
                className="w-12 h-12 bg-zinc-950/90 border border-zinc-700/80 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-zinc-800 active:scale-90 shadow-xl"
              >
                🛏️
              </button>
              <button 
                onClick={() => onMobileAction('jump')}
                className="w-12 h-12 bg-zinc-950/90 border border-zinc-700/80 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-zinc-800 active:scale-90 shadow-xl"
              >
                🦘
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={onReload}
                className="w-12 h-12 bg-zinc-950/90 border border-zinc-700/80 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-zinc-800 active:scale-90 shadow-xl"
              >
                🔄
              </button>
              <button 
                onClick={() => onMobileAction('aim')}
                className="w-12 h-12 bg-zinc-950/90 border border-zinc-700/80 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-zinc-800 active:scale-90 shadow-xl"
              >
                🔭
              </button>
              <button 
                onClick={() => onMobileAction('shoot')}
                className="w-16 h-16 bg-red-600 border border-red-500 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-red-700 active:scale-90 shadow-2xl animate-pulse"
              >
                🔥
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MATCH OVER OVERLAY (BOOYAH / ELIMINATED) */}
      {gameStatus !== 'playing' && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center z-50 pointer-events-auto">
          <div className="max-w-md w-full p-8 bg-zinc-950/60 border border-zinc-800 rounded-3xl text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
            
            {gameStatus === 'won' ? (
              <div className="flex flex-col items-center">
                <span className="text-6xl animate-bounce">🏆</span>
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 mt-4 tracking-wider animate-pulse">BOOYAH!</h1>
                <p className="text-zinc-400 text-sm mt-1 uppercase tracking-widest font-extrabold font-mono">Champion Survivor</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-6xl opacity-75">💀</span>
                <h1 className="text-4xl font-extrabold text-zinc-400 mt-4 tracking-wider">ELIMINATED</h1>
                <p className="text-rose-500 text-xs mt-1 font-mono uppercase tracking-widest font-bold">Better Luck Next Time</p>
              </div>
            )}

            {/* Match Stats Summary card */}
            <div className="grid grid-cols-3 gap-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 my-6">
              <div className="flex flex-col">
                <span className="text-zinc-500 text-[10px] font-mono tracking-wider uppercase font-bold">Placement</span>
                <span className="text-white text-lg font-extrabold mt-0.5">#{gameStatus === 'won' ? '1' : Math.floor(2 + Math.random() * 45)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-500 text-[10px] font-mono tracking-wider uppercase font-bold">Kills</span>
                <span className="text-emerald-400 text-lg font-extrabold mt-0.5">{kills}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-500 text-[10px] font-mono tracking-wider uppercase font-bold">Damage</span>
                <span className="text-amber-400 text-lg font-extrabold mt-0.5">{damageDealt}</span>
              </div>
            </div>

            {/* XP & Rewards panel */}
            <div className="flex flex-col gap-2.5 bg-zinc-900/40 border border-zinc-800 p-4 rounded-2xl text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-semibold">Coins Earned</span>
                <span className="text-yellow-400 font-bold font-mono">+{kills * 100 + 150} Gold</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-semibold">Battle Pass Points</span>
                <span className="text-purple-400 font-bold font-mono">+{kills * 40 + 80} XP</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-800/80 pt-2">
                <span className="text-zinc-400 font-semibold">Rank Points</span>
                <span className="text-emerald-400 font-bold font-mono">+{kills * 15 + 40} RP</span>
              </div>
            </div>

            <button 
              onClick={onExitMatch}
              className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold py-3.5 px-6 rounded-2xl hover:brightness-110 shadow-lg active:scale-[0.98] transition-all"
            >
              Claim Rewards & Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
