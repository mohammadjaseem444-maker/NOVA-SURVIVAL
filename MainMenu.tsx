/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, Shield, ShoppingBag, Award, Settings, User, 
  RotateCw, RefreshCw, Trophy, Bell, Mail, Compass, HelpCircle, LogOut,
  Download, Smartphone
} from 'lucide-react';
import { PlayerProfile, ShopItem, Mission } from '../types';
import { DEFAULT_SETTINGS, SAVE_SYSTEM, SHOP_ITEMS, MISSIONS_LIST } from '../game/saveSystem';
import { SOUND_SYSTEM } from '../game/soundSystem';
import { SKIN_DESCRIPTIONS } from '../game/weapons';

interface MainMenuProps {
  profile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
  onStartMatch: (mode: 'solo' | 'duo' | 'squad' | 'training') => void;
}

export default function MainMenu({ profile, onUpdateProfile, onStartMatch }: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<'lobby' | 'inventory' | 'shop' | 'pass' | 'leaderboard' | 'spin' | 'settings'>('lobby');
  const [selectedMode, setSelectedMode] = useState<'solo' | 'duo' | 'squad' | 'training'>('solo');
  const [settings, setSettings] = useState(SAVE_SYSTEM.loadSettings());
  const [dailyClaimed, setDailyClaimed] = useState(!SAVE_SYSTEM.canClaimDailyReward());
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeCharacterIndex, setActiveCharacterIndex] = useState(0);

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running as PWA standalone
    const runningStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(!!runningStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent;
    const ipad = !!ua.match(/iPad/i);
    const iphone = !!ua.match(/iPhone/i);
    setIsIOS(ipad || iphone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    SOUND_SYSTEM.playClick();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installed decision: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Sync profile values
  const claimDaily = () => {
    const res = SAVE_SYSTEM.claimDailyReward();
    if (res.success) {
      SOUND_SYSTEM.playHeal();
      setDailyClaimed(true);
      onUpdateProfile(SAVE_SYSTEM.loadProfile());
      alert(`Claimed daily reward! You earned +${res.rewardCoins} Gold!`);
    }
  };

  const handleBuyItem = (item: ShopItem) => {
    SOUND_SYSTEM.playClick();
    if (profile.stats.coins < item.price) {
      alert('Insufficient Gold! Play more matches to earn coins.');
      return;
    }

    const currentSkins = { ...profile.skins };
    const categoryKey = item.category === 'character' ? 'characters' : (item.category === 'weapon' ? 'weapons' : (item.category === 'parachute' ? 'parachutes' : 'backpacks'));
    
    if (currentSkins[categoryKey].includes(item.id)) {
      alert('You already own this item!');
      return;
    }

    // Process Purchase
    const updatedProfile: PlayerProfile = {
      ...profile,
      stats: {
        ...profile.stats,
        coins: profile.stats.coins - item.price,
      },
      skins: {
        ...currentSkins,
        [categoryKey]: [...currentSkins[categoryKey], item.id],
      }
    };

    onUpdateProfile(updatedProfile);
    SAVE_SYSTEM.saveProfile(updatedProfile);
    SOUND_SYSTEM.playExplosion();
    alert(`Successfully unlocked: ${item.name}! Check your Vault.`);
  };

  const handleEquipSkin = (category: 'character' | 'weapon', itemId: string, weaponType?: string) => {
    SOUND_SYSTEM.playClick();
    const updated = { ...profile };
    if (category === 'character') {
      updated.equippedCharacter = itemId;
    } else if (category === 'weapon' && weaponType) {
      updated.equippedWeaponSkin = {
        ...updated.equippedWeaponSkin,
        [weaponType]: itemId,
      };
    }
    onUpdateProfile(updated);
    SAVE_SYSTEM.saveProfile(updated);
  };

  const triggerLuckySpin = () => {
    if (profile.stats.coins < 250) {
      alert('Lucky Spin costs 250 Gold. Participate in more battles to earn enough!');
      return;
    }

    SOUND_SYSTEM.playClick();
    setIsSpinning(true);
    setSpinResult(null);

    setTimeout(() => {
      // Procedural pick
      const spinPrizes = [
        { name: '100 Gold Coins', type: 'coins', val: 100 },
        { name: '500 Gold Coins', type: 'coins', val: 500 },
        { name: 'M4A1 - Golden Dragon Skin', type: 'skin', id: 'skin_m4a1_golden', category: 'weapon' },
        { name: 'AK47 - Crimson Fury Skin', type: 'skin', id: 'skin_ak47_fire', category: 'weapon' },
        { name: 'Alok Character Unlock', type: 'skin', id: 'character_kelly', category: 'character' },
        { name: '1000 Gold Coins Mega Jackpot', type: 'coins', val: 1000 },
      ];

      const won = spinPrizes[Math.floor(Math.random() * spinPrizes.length)];
      const updated = { ...profile };
      updated.stats.coins -= 250; // Deduct cost

      if (won.type === 'coins' && won.val) {
        updated.stats.coins += won.val;
        setSpinResult(`You won: +${won.val} Gold Coins!`);
      } else if (won.type === 'skin' && won.id && won.category) {
        const catKey = won.category === 'character' ? 'characters' : 'weapons';
        if (!updated.skins[catKey].includes(won.id)) {
          updated.skins[catKey].push(won.id);
        }
        setSpinResult(`JACKPOT! You unlocked: ${won.name}!`);
      }

      setIsSpinning(false);
      onUpdateProfile(updated);
      SAVE_SYSTEM.saveProfile(updated);
      SOUND_SYSTEM.playExplosion();
    }, 1500);
  };

  const handleSaveSettings = (key: keyof typeof settings, val: any) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    SAVE_SYSTEM.saveSettings(updated);
    if (key === 'soundVolume') {
      SOUND_SYSTEM.setVolume(val);
    }
  };

  // Fun background characters list
  const avatars = [
    { id: 'recruit_male', name: 'Andrew (Tactical)', title: 'Armor Specialist', desc: 'Increases base shield durability by 15% during combat.' },
    { id: 'recruit_female', name: 'Olivia (Medic)', title: 'First Aid Expert', desc: 'Heals 20% faster when using standard medical kits.' },
    { id: 'character_kelly', name: 'Alok', title: 'Speed Force DJ', desc: 'Active skill: Speeds up movement rate by 12%.' },
    { id: 'character_hayato', name: 'Chrono', title: 'Shield Dome Sentinel', desc: 'Blocks incoming bullet damages with a temporary energy field.' }
  ];

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between select-none relative overflow-x-hidden">
      
      {/* GLOWING AMBIENT BACKGROUND */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-amber-500/10 via-zinc-950/20 to-transparent pointer-events-none"></div>
      
      {/* UPPER BRANDING HEADER BAR */}
      <header className="w-full flex justify-between items-center px-6 py-4 bg-zinc-900/60 border-b border-zinc-800/80 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center font-black text-xl text-zinc-950 shadow-lg shadow-amber-500/20">
            🔥
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
              3D BR SIMULATOR
            </h1>
            <p className="text-[10px] text-amber-500/80 tracking-widest uppercase font-bold">Offline Battlegrounds</p>
          </div>
        </div>

        {/* Currency & Level info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl font-mono text-sm">
            <span className="text-yellow-400">🪙</span>
            <span className="font-extrabold text-yellow-500">{profile.stats.coins}</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-xl">
            <div className="w-6 h-6 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">
              {profile.stats.level}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Level</span>
              <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-amber-500" style={{ width: `${(profile.stats.xp / (profile.stats.level * 1000)) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Quick Mail box alert */}
          <button className="w-9 h-9 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center justify-center hover:bg-zinc-900 text-zinc-400 relative">
            <Mail size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </button>
        </div>
      </header>

      {/* CORE DISPLAY WINDOW */}
      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-6 landscape:gap-4 p-6 landscape:p-3 items-stretch relative z-10">
        
        {/* LEFTSIDE COLUMN: Dynamic Vault/Character Preview (Interactive 3D model lookalike) */}
        <section className="landscape:col-span-5 lg:col-span-5 bg-gradient-to-b from-zinc-900 to-zinc-950/40 border border-zinc-800/80 rounded-3xl p-6 landscape:p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
          {/* Cyber grid overlays */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px] opacity-[0.02]"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest font-mono">Combat Outfit</span>
              <h2 className="text-2xl font-black text-white mt-0.5">
                {avatars.find(a => a.id === profile.equippedCharacter)?.name || 'Andrew'}
              </h2>
              <p className="text-xs text-zinc-400 italic mt-0.5">
                "{avatars.find(a => a.id === profile.equippedCharacter)?.title}"
              </p>
            </div>
            
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 font-mono font-bold">CURRENT RANK</span>
              <div 
                className="text-sm font-extrabold uppercase tracking-wide mt-1"
                style={{ color: SAVE_SYSTEM.getRankColor(profile.stats.rankPoints) }}
              >
                🏆 {SAVE_SYSTEM.getRankName(profile.stats.rankPoints)}
              </div>
            </div>
          </div>

          {/* CHARACTER PREVIEW SCREEN (Rendered nicely using clean vector styles & action indicators) */}
          <div className="flex-1 min-h-64 landscape:min-h-32 flex flex-col justify-center items-center relative py-6 landscape:py-2">
            <div className="absolute w-44 h-44 bg-amber-500/5 rounded-full blur-3xl animate-pulse"></div>
            
            {/* Minimalistic Stylized Low Poly Model Drawing */}
            <div className="flex flex-col items-center relative group-hover:scale-105 transition-all duration-300">
              <span className="text-8xl landscape:text-5xl lg:text-8xl animate-bounce mb-2">🧑‍🚀</span>
              {/* Stand floor circle */}
              <div className="w-24 h-4 bg-amber-500/20 rounded-full blur-[2px] border border-amber-500/40 transform rotate-12"></div>
            </div>

            <div className="mt-4 landscape:mt-1 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 landscape:p-1.5 text-center max-w-xs backdrop-blur-sm relative z-10 shadow-xl">
              <span className="text-[9px] text-amber-400 font-mono font-bold tracking-widest uppercase">Passive Ability</span>
              <p className="text-[11px] text-zinc-300 mt-1">
                {avatars.find(a => a.id === profile.equippedCharacter)?.desc}
              </p>
            </div>
          </div>

          {/* Quick Daily Claim reward bar */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 landscape:p-2.5 flex justify-between items-center relative z-10 shadow-lg mt-2 landscape:mt-1 lg:mt-0">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Daily Attendance</span>
              <p className="text-[11px] text-zinc-500 mt-0.5">Claim +500 Gold Coins daily!</p>
            </div>
            <button
              onClick={claimDaily}
              disabled={dailyClaimed}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                dailyClaimed 
                  ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800' 
                  : 'bg-amber-500 text-zinc-950 hover:brightness-110 shadow-lg shadow-amber-500/10'
              }`}
            >
              {dailyClaimed ? 'Claimed ✓' : 'Claim Now'}
            </button>
          </div>
        </section>

        {/* RIGHTSIDE COLUMN: Multi-tab content engine */}
        <section className="landscape:col-span-7 lg:col-span-7 flex flex-col justify-between">
          
          {/* TAB HEADERS NAVIGATION BAR */}
          <div className="grid grid-cols-4 landscape:grid-cols-7 sm:grid-cols-7 gap-1.5 p-1 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl mb-4 landscape:mb-2 backdrop-blur-md">
            {[
              { id: 'lobby', icon: Play, label: 'Lobby' },
              { id: 'inventory', icon: Shield, label: 'Vault' },
              { id: 'shop', icon: ShoppingBag, label: 'Shop' },
              { id: 'pass', icon: Award, label: 'Pass' },
              { id: 'leaderboard', icon: Trophy, label: 'Ranks' },
              { id: 'spin', icon: RotateCw, label: 'Spin' },
              { id: 'settings', icon: Settings, label: 'Config' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  SOUND_SYSTEM.playClick();
                  setActiveTab(tab.id as any);
                }}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md' 
                    : 'text-zinc-400 hover:bg-zinc-850 hover:text-white'
                }`}
              >
                <tab.icon size={16} />
                <span className="text-[10px] mt-1 hidden landscape:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB VIEW PORT */}
          <div className="flex-1 bg-gradient-to-b from-zinc-900 to-zinc-950/60 border border-zinc-800/80 rounded-3xl p-6 landscape:p-4 min-h-[440px] landscape:min-h-0 lg:min-h-[440px] flex flex-col justify-between shadow-2xl overflow-y-auto">
            
            {/* 1. LOBBY TAB */}
            {activeTab === 'lobby' && (
              <div className="flex flex-col justify-between h-full gap-4">
                <div className="flex flex-col text-left">
                  <span className="text-amber-500 text-[10px] tracking-wider uppercase font-extrabold font-mono">Matchmaking Arena</span>
                  <h3 className="text-2xl font-black text-white mt-1">Select Combat Rules</h3>
                  <p className="text-xs text-zinc-400 mt-1">Ready up to drop onto Sentinel Island with 99 other simulation bots.</p>
                </div>

                {/* PWA INSTALLATION HELPER BANNER */}
                {!isStandalone && (
                  <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/5 to-zinc-950/40 border border-amber-500/30 rounded-2xl p-3.5 landscape:p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-start gap-2.5 text-left">
                      <span className="text-xl mt-0.5">📲</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">INSTALL FOR FULLSCREEN PLAY</span>
                        {isIOS ? (
                          <p className="text-[10px] text-zinc-300 mt-0.5 leading-relaxed">
                            Tap Safari's **Share** button <span className="inline-block px-1 bg-zinc-800 rounded">📤</span> and choose **Add to Home Screen** <span className="inline-block px-1 bg-zinc-800 rounded">➕</span> to hide browser bars!
                          </p>
                        ) : (
                          <p className="text-[10px] text-zinc-300 mt-0.5 leading-relaxed">
                            Install the app on your home screen to run in native fullscreen, fitting your device perfectly!
                          </p>
                        )}
                      </div>
                    </div>
                    {showInstallBtn && !isIOS && (
                      <button
                        onClick={handleInstallClick}
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black tracking-wider px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start md:self-auto"
                      >
                        <Download size={13} strokeWidth={3} />
                        INSTALL APP
                      </button>
                    )}
                  </div>
                )}

                {/* Game Mode Pickers */}
                <div className="grid grid-cols-2 gap-3 landscape:gap-2 my-2 landscape:my-1">
                  {[
                    { id: 'solo', name: 'Battle Royale Solo', icon: '👤', desc: '1v99 free-for-all drop survival.' },
                    { id: 'duo', name: 'Duo Simulator', icon: '👥', desc: 'Slightly slower tactical bots.' },
                    { id: 'squad', name: 'Squad Firefight', icon: '🛡️', desc: 'Fight hard against advanced AI.' },
                    { id: 'training', name: 'Practice Targets', icon: '🔭', desc: 'Test weapon fire rate & bullet spreads.' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        SOUND_SYSTEM.playClick();
                        setSelectedMode(mode.id as any);
                      }}
                      className={`p-4 landscape:p-2.5 rounded-2xl border text-left flex gap-3 landscape:gap-2 transition-all cursor-pointer ${
                        selectedMode === mode.id 
                          ? 'bg-amber-500/10 border-amber-500' 
                          : 'bg-zinc-950/80 border-zinc-800/80 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="text-2xl landscape:text-xl mt-1">{mode.icon}</span>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-white uppercase">{mode.name}</span>
                        <span className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed landscape:hidden sm:landscape:block">{mode.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Profile Performance stats strip */}
                <div className="bg-zinc-950/85 border border-zinc-800 rounded-2xl p-4 landscape:p-2 flex justify-around text-center my-2 landscape:my-1 shadow-inner">
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Played</div>
                    <div className="text-lg landscape:text-sm font-extrabold mt-0.5 text-zinc-100">{profile.stats.matchesPlayed}</div>
                  </div>
                  <div className="border-l border-zinc-800"></div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Booyah Wins</div>
                    <div className="text-lg landscape:text-sm font-extrabold mt-0.5 text-emerald-400">{profile.stats.wins}</div>
                  </div>
                  <div className="border-l border-zinc-800"></div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Kills</div>
                    <div className="text-lg landscape:text-sm font-extrabold mt-0.5 text-rose-500">{profile.stats.kills}</div>
                  </div>
                </div>

                {/* READY UP ACTION BUTTON */}
                <button
                  onClick={() => {
                    SOUND_SYSTEM.playExplosion();
                    onStartMatch(selectedMode);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 py-4 landscape:py-2.5 px-6 rounded-2xl font-black tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play size={18} fill="currentColor" />
                  ENTER GAME ARENA
                </button>
              </div>
            )}

            {/* 2. VAULT / INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="flex flex-col justify-between h-full gap-4">
                <div className="text-left">
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Private Vault</span>
                  <h3 className="text-xl font-bold mt-0.5">Custom Cosmetics</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Equip your unlocked survivor classes and weapon skins wrappers.</p>
                </div>

                {/* Characters Collection */}
                <div className="flex flex-col gap-2 my-2 text-left">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Equipped Character Skins</span>
                  <div className="grid grid-cols-2 gap-2">
                    {avatars.map((av) => {
                      const isUnlocked = profile.skins.characters.includes(av.id);
                      const isEquipped = profile.equippedCharacter === av.id;

                      return (
                        <button
                          key={av.id}
                          disabled={!isUnlocked}
                          onClick={() => handleEquipSkin('character', av.id)}
                          className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${
                            isEquipped 
                              ? 'bg-amber-500/10 border-amber-500' 
                              : (isUnlocked ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850' : 'bg-zinc-950/60 border-zinc-900 opacity-45 cursor-not-allowed')
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{av.name}</span>
                            <span className="text-[9px] text-zinc-400 mt-0.5">{av.title}</span>
                          </div>
                          <span className="text-xs font-mono font-bold">
                            {isEquipped ? 'EQUIPPED ✓' : (isUnlocked ? 'SELECT' : 'LOCKED 🔒')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weapon Wraps Collection */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Active Weapon Skin Selectors</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'm4a1', name: 'M4A1 Assault' },
                      { type: 'ak47', name: 'AK47 Redline' },
                      { type: 'awp', name: 'AWP Sniper' },
                    ].map((wepSlot) => {
                      // Find skin variations unlocked for this weapon
                      const unlockedSkinsForWep = Object.keys(SKIN_DESCRIPTIONS).filter(skinId => 
                        skinId.startsWith(wepSlot.type) && profile.skins.weapons.includes(skinId)
                      );
                      
                      // Also add custom shop weapon skins if bought
                      SHOP_ITEMS.filter(it => it.category === 'weapon' && it.id.includes(wepSlot.type) && profile.skins.weapons.includes(it.id))
                                .forEach(it => unlockedSkinsForWep.push(it.id));

                      const activeSkinId = profile.equippedWeaponSkin[wepSlot.type] || `${wepSlot.type}_standard`;

                      return (
                        <div key={wepSlot.type} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono">{wepSlot.name}</span>
                          <div className="flex flex-col gap-1">
                            {unlockedSkinsForWep.map((skinId) => {
                              const desc = SKIN_DESCRIPTIONS[skinId] || { name: 'Carbon Black' };
                              const isEquipped = activeSkinId === skinId;

                              return (
                                <button
                                  key={skinId}
                                  onClick={() => handleEquipSkin('weapon', skinId, wepSlot.type)}
                                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex justify-between items-center border ${
                                    isEquipped 
                                      ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-300'
                                  }`}
                                >
                                  <span>{desc.name}</span>
                                  <span>{isEquipped ? 'EQUIPPED ✓' : 'EQUIP'}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. COIN SHOP */}
            {activeTab === 'shop' && (
              <div className="flex flex-col justify-between h-full gap-4">
                <div className="text-left">
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Tactical Supplies</span>
                  <h3 className="text-xl font-bold mt-0.5">Gold Coin Store</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Invest your earned match gold to acquire rare and epic cosmetic wraps.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-72 landscape:max-h-40 lg:max-h-72 my-2 text-left">
                  {SHOP_ITEMS.map((item) => {
                    const ownedKey = item.category === 'character' ? 'characters' : 'weapons';
                    const isAlreadyOwned = profile.skins[ownedKey].includes(item.id);

                    return (
                      <div key={item.id} className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-md relative overflow-hidden">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white truncate max-w-[130px]">{item.name}</span>
                            <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.category}</span>
                          </div>
                          <span 
                            className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold text-zinc-950"
                            style={{ backgroundColor: item.previewColor }}
                          >
                            {item.rarity.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-t border-zinc-900 pt-2 mt-2">
                          <span className="text-xs font-extrabold font-mono text-yellow-500">🪙 {item.price} Gold</span>
                          <button
                            onClick={() => handleBuyItem(item)}
                            disabled={isAlreadyOwned}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                              isAlreadyOwned 
                                ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed' 
                                : 'bg-amber-500 text-zinc-950 hover:brightness-110 shadow-md'
                            }`}
                          >
                            {isAlreadyOwned ? 'OWNED ✓' : 'BUY'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. BATTLE PASS / MISSIONS */}
            {activeTab === 'pass' && (
              <div className="flex flex-col justify-between h-full gap-4">
                <div className="text-left">
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Rewards Progress</span>
                  <h3 className="text-xl font-bold mt-0.5">Battle Pass & Missions</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Solve daily survivor missions to score experience keys and levels.</p>
                </div>

                {/* Passive assignments tracker */}
                <div className="flex flex-col gap-2 overflow-y-auto max-h-72 landscape:max-h-40 lg:max-h-72 my-2 text-left">
                  {MISSIONS_LIST.map((m) => (
                    <div key={m.id} className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl flex justify-between items-center gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-xs font-bold text-zinc-100">{m.title}</span>
                        <p className="text-[10px] text-zinc-400">{m.description}</p>
                        <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full bg-amber-500" style={{ width: `${(m.current / m.target) * 100}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
                        <span className="text-[9px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">🪙 +{m.rewardCoins}</span>
                        <span className="text-[10px] font-mono text-zinc-500 font-bold">{m.current}/{m.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. LEADERBOARD / RANKS */}
            {activeTab === 'leaderboard' && (
              <div className="flex flex-col justify-between h-full gap-4">
                <div className="text-left">
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Global Ranks</span>
                  <h3 className="text-xl font-bold mt-0.5">Survivor Rankings</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Climb the leaderboards by accumulating Rank Points (RP) from survival achievements.</p>
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-72 landscape:max-h-40 lg:max-h-72 my-2 text-left">
                  {[
                    { rank: 1, name: 'SavageChrono_99', league: 'Grandmaster', rp: 4520, isPlayer: false },
                    { rank: 2, name: 'AlphaAlok_Pro', league: 'Heroic', rp: 4120, isPlayer: false },
                    { rank: 3, name: 'TombRider_01', league: 'Diamond IV', rp: 3480, isPlayer: false },
                    { rank: 4, name: profile.username + ' (YOU)', league: SAVE_SYSTEM.getRankName(profile.stats.rankPoints), rp: profile.stats.rankPoints, isPlayer: true },
                    { rank: 5, name: 'SilentKill_88', league: 'Gold IV', rp: 2150, isPlayer: false },
                    { rank: 6, name: 'BulletProof_7', league: 'Silver III', rp: 1780, isPlayer: false },
                    { rank: 7, name: 'NoobRunner_BR', league: 'Bronze I', rp: 1120, isPlayer: false }
                  ]
                  .sort((a, b) => b.rp - a.rp)
                  .map((player, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-xl flex justify-between items-center border ${
                        player.isPlayer 
                          ? 'bg-amber-500/10 border-amber-500/50' 
                          : 'bg-zinc-950/70 border-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono font-black ${player.rank === 1 ? 'text-yellow-400' : (player.rank === 2 ? 'text-zinc-400' : 'text-zinc-500')}`}>
                          #{idx + 1}
                        </span>
                        <span className={`text-xs font-bold ${player.isPlayer ? 'text-amber-400' : 'text-zinc-200'}`}>{player.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">{player.league}</span>
                        <span className="text-xs font-mono font-extrabold text-amber-500">{player.rp} RP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. LUCKY SPIN TAB */}
            {activeTab === 'spin' && (
              <div className="flex flex-col justify-between h-full gap-4 text-center items-center">
                <div className="text-left w-full">
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Gacha Station</span>
                  <h3 className="text-xl font-bold mt-0.5">Lucky Skin Spin</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Spend 250 Gold Coins to test your luck and roll for legendary skin wraps!</p>
                </div>

                <div className="my-4 flex flex-col items-center justify-center relative">
                  <div className={`w-32 h-32 rounded-full border-4 border-amber-500/50 flex items-center justify-center relative ${isSpinning ? 'animate-spin' : ''}`}>
                    <span className="text-4xl">🎰</span>
                    {/* Circle ticks */}
                    <div className="absolute inset-0 border-t-4 border-amber-500 rounded-full"></div>
                  </div>

                  {spinResult && (
                    <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs font-bold text-amber-400 animate-bounce">
                      {spinResult}
                    </div>
                  )}
                </div>

                <button
                  onClick={triggerLuckySpin}
                  disabled={isSpinning || profile.stats.coins < 250}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 py-3 rounded-2xl font-black text-xs hover:brightness-110 active:scale-95 transition-all disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800"
                >
                  {isSpinning ? 'Rolling prizes...' : 'SPIN FOR 250 GOLD'}
                </button>
              </div>
            )}

            {/* 7. SETTINGS MENU */}
            {activeTab === 'settings' && (
              <div className="flex flex-col justify-between h-full gap-4 text-left">
                <div>
                  <span className="text-amber-500 text-[10px] font-mono font-bold tracking-widest uppercase">Global Setup</span>
                  <h3 className="text-xl font-bold mt-0.5">Game Adjustments</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Tune graphics rendering quality, sound decibels, look sensitivities, and perspective styles.</p>
                </div>

                <div className="flex flex-col gap-3 my-2 overflow-y-auto max-h-72">
                  {/* Camera Mode Toggle */}
                  <div className="flex justify-between items-center bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white uppercase">Default Camera Angle</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">Switch between Third Person (TPS) or First Person (FPS).</span>
                    </div>
                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                      <button 
                        onClick={() => handleSaveSettings('cameraMode', 'tps')}
                        className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${settings.cameraMode === 'tps' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
                      >
                        TPS
                      </button>
                      <button 
                        onClick={() => handleSaveSettings('cameraMode', 'fps')}
                        className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all ${settings.cameraMode === 'fps' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
                      >
                        FPS
                      </button>
                    </div>
                  </div>

                  {/* Graphics preset */}
                  <div className="flex justify-between items-center bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white uppercase">Graphics Preset</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">Lowering graphics quality gains frames on older models.</span>
                    </div>
                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                      {['low', 'medium', 'high'].map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSaveSettings('graphics', q as any)}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase transition-all ${settings.graphics === q ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* sensitivity Slider */}
                  <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white uppercase">Look Sensitivity</span>
                      <span className="text-xs font-mono text-amber-500 font-bold">{settings.sensitivityX.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="4.0" 
                      step="0.1"
                      value={settings.sensitivityX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleSaveSettings('sensitivityX', val);
                        handleSaveSettings('sensitivityY', val);
                      }}
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Master volume slider */}
                  <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white uppercase">Master Sound Volume</span>
                      <span className="text-xs font-mono text-amber-500 font-bold">{Math.round(settings.soundVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={settings.soundVolume}
                      onChange={(e) => handleSaveSettings('soundVolume', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* LOWER STATUS FOOTER BAR */}
      <footer className="w-full text-center py-4 bg-zinc-950 text-[10px] text-zinc-600 font-mono tracking-widest uppercase border-t border-zinc-900 relative z-10">
        ENVIRONMENT: STANDALONE CONTAINER • STABLE 60 FPS BIND
      </footer>
    </div>
  );
}
