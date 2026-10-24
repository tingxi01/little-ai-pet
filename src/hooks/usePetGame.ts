import { useEffect, useState } from 'react';
import { applyAction, decay, initialPet, type PetAction, type PetState, type Temperament } from '../lib/pet';
const KEY = 'little-ai-pet-v1';
function load(): PetState {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PetState;
      if (parsed.stats && ['gentle','playful','sleepy'].includes(parsed.temperament)) return decay(parsed);
    }
  } catch { /* ignore invalid saved state */ }
  return initialPet;
}
export function usePetGame() {
  const [pet, setPet] = useState<PetState>(load);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(pet)); }, [pet]);
  useEffect(() => { const id = window.setInterval(() => setPet(p => decay(p)), 60000); return () => clearInterval(id); }, []);
  return {
    pet,
    act: (action: PetAction) => setPet(p => applyAction(p, action)),
    setTemperament: (temperament: Temperament) => setPet(p => ({ ...p, temperament, message: `Mochi feels ${temperament} today ♡` }))
  };
}
