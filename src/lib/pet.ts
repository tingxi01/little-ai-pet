export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type TimeMode = 'auto' | TimeOfDay;
export type Temperament = 'gentle' | 'playful' | 'sleepy';
export type PetAction = 'feed' | 'pet' | 'play' | 'sleep';
export type PetStats = { hunger: number; happiness: number; energy: number; wellness: number };
export type PetState = { stats: PetStats; temperament: Temperament; message: string; lastUpdated: number };
export const initialPet: PetState = { stats: { hunger: 80, happiness: 85, energy: 75, wellness: 95 }, temperament: 'gentle', message: 'Mochi is feeling cozy ♡', lastUpdated: Date.now() };
export const clamp = (n: number) => Math.min(100, Math.max(0, n));
export function timeNow(): TimeOfDay { const h = new Date().getHours(); return h >= 6 && h < 11 ? 'morning' : h < 11 || h >= 19 ? 'night' : h < 17 ? 'afternoon' : 'evening'; }
export function applyAction(state: PetState, action: PetAction): PetState {
  const s = { ...state.stats };
  if (action === 'feed') { s.hunger = clamp(s.hunger + 18); s.happiness = clamp(s.happiness + 3); }
  if (action === 'pet') s.happiness = clamp(s.happiness + (state.temperament === 'gentle' ? 15 : 10));
  if (action === 'play') { s.happiness = clamp(s.happiness + (state.temperament === 'playful' ? 20 : 12)); s.energy = clamp(s.energy - 9); s.hunger = clamp(s.hunger - 5); }
  if (action === 'sleep') { s.energy = clamp(s.energy + (state.temperament === 'sleepy' ? 30 : 22)); s.wellness = clamp(s.wellness + 3); }
  const messages: Record<PetAction,string> = { feed: 'Yum! Thank you! ♡', pet: 'Mochi loves that! ♡', play: 'Wheee! Again!', sleep: 'A little nap sounds nice… zzz' };
  return { ...state, stats: s, message: messages[action], lastUpdated: Date.now() };
}
export function decay(state: PetState): PetState {
  const elapsed = Math.max(0, Math.min(24, (Date.now() - state.lastUpdated) / 3600000));
  return { ...state, stats: { ...state.stats, hunger: clamp(state.stats.hunger - elapsed * 1.5), energy: clamp(state.stats.energy - elapsed * 0.6), happiness: clamp(state.stats.happiness - elapsed * 0.4) }, lastUpdated: Date.now() };
}
