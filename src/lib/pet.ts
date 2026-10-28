
export type TimeOfDay =
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

export type TimeMode = "auto" | TimeOfDay;

export type Temperament =
  | "gentle"
  | "playful"
  | "sleepy";

export type PetAction =
  | "feed"
  | "pet"
  | "play"
  | "sleep";

export type PetStats = {
  hunger: number;
  happiness: number;
  energy: number;
  wellness: number;
};

export type PetState = {
  stats: PetStats;
  temperament: Temperament;
  message: string;
  lastUpdated: number;
};

export const clamp = (n: number) =>
  Math.min(100, Math.max(0, n));

// ==========================================
// WELLNESS
// ==========================================

// "hunger" represents Fullness in the UI.
// Wellness is derived from the other stats.

export function calculateWellness(
  stats: Pick<
    PetStats,
    "hunger" | "happiness" | "energy"
  >
): number {
  const fullness = clamp(stats.hunger);
  const energy = clamp(stats.energy);
  const happiness = clamp(stats.happiness);

  return clamp(
    fullness * 0.4 +
      energy * 0.35 +
      happiness * 0.25
  );
}

function withWellness(
  stats: PetStats
): PetStats {
  return {
    ...stats,
    wellness: calculateWellness(stats),
  };
}

// ==========================================
// INITIAL PET
// ==========================================

export const initialPet: PetState = {
  stats: withWellness({
    hunger: 80,
    happiness: 85,
    energy: 75,
    wellness: 0,
  }),
  temperament: "gentle",
  message: "Mochi is feeling cozy ♡",
  lastUpdated: Date.now(),
};

// ==========================================
// TIME OF DAY
// ==========================================

export function timeNow(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "evening";

  return "night";
}

// ==========================================
// CARE REFUSAL
// ==========================================

export function getCareRefusal(
  state: PetState,
  action: PetAction
): string | null {
  const { hunger, energy } = state.stats;

  const wellness = calculateWellness(
    state.stats
  );

  if (action === "feed" && hunger >= 95) {
    return "My tummy is already full! ♡";
  }

  if (action === "sleep" && energy >= 95) {
    return "I'm already wide awake! ♡";
  }

  if (action === "play") {
    if (wellness < 30) {
      return "I'm not feeling well enough to play... ♡";
    }

    if (energy < 40) {
      return "I'm too sleepy to play right now... ♡";
    }

    if (hunger < 40) {
      return "Can I have a little snack first?";
    }
  }

  return null;
}

// ==========================================
// USER ACTIONS
// ==========================================

export function applyAction(
  state: PetState,
  action: PetAction
): PetState {
  const refusal = getCareRefusal(
    state,
    action
  );

  if (refusal) {
    return {
      ...state,
      message: refusal,
    };
  }

  const stats = { ...state.stats };

  if (action === "feed") {
    stats.hunger = clamp(
      stats.hunger + 18
    );

    stats.happiness = clamp(
      stats.happiness + 3
    );
  }

  if (action === "pet") {
    stats.happiness = clamp(
      stats.happiness +
        (state.temperament === "gentle"
          ? 15
          : 10)
    );
  }

  if (action === "play") {
    stats.happiness = clamp(
      stats.happiness +
        (state.temperament === "playful"
          ? 20
          : 12)
    );

    stats.energy = clamp(
      stats.energy - 9
    );

    stats.hunger = clamp(
      stats.hunger - 5
    );
  }

  // Sleep has no instant energy gain.
  // Energy recovery occurs inside decay().

  let message: string;

  switch (action) {
    case "feed":
      message = "Yum! Thank you! ♡";
      break;

    case "pet":
      message = "Your cuddles make me happy ♡";
      break;

    case "play":
      message = "Whee!";
      break;

    case "sleep":
      message = "A little nap sounds nice… zzz";
      break;
  }

  return {
    ...state,
    stats: withWellness(stats),
    message,
    lastUpdated: Date.now(),
  };
}

// ==========================================
// STAT BALANCE
// ==========================================

// Fullness decreases by 1% every 5 minutes.
const FULLNESS_DECAY_PER_HOUR = 12;

// Awake Energy decreases by 1% every 5 minutes.
const AWAKE_ENERGY_DECAY_PER_HOUR = 12;

// Sleeping restores 5% Energy per second.
const SLEEP_ENERGY_PER_HOUR = 18_000;

// Happiness decreases according to condition.
//
// Comfortable: 1% every 5 minutes.
// Uncomfortable: 1% every 2 minutes.
// Critical: 1% every minute.

const HAPPINESS_COMFORTABLE_PER_HOUR = 12;
const HAPPINESS_UNCOMFORTABLE_PER_HOUR = 30;
const HAPPINESS_CRITICAL_PER_HOUR = 60;

// ==========================================
// HAPPINESS CONDITIONS
// ==========================================

function getHappinessDecayRate(
  fullness: number,
  energy: number
): number {
  // Very hungry or exhausted.
  if (fullness < 30 || energy < 30) {
    return HAPPINESS_CRITICAL_PER_HOUR;
  }

  // Moderately hungry or tired.
  if (fullness < 60 || energy < 60) {
    return HAPPINESS_UNCOMFORTABLE_PER_HOUR;
  }

  // Comfortable and well-rested.
  return HAPPINESS_COMFORTABLE_PER_HOUR;
}

// ==========================================
// TIME-BASED STAT CHANGES
// ==========================================

export function decay(
  state: PetState,
  sleeping = false
): PetState {
  const now = Date.now();

  const elapsedHours = Math.max(
    0,
    Math.min(
      24,
      (now - state.lastUpdated) / 3_600_000
    )
  );

  const stats = { ...state.stats };

  // Fullness decreases whether awake or asleep.
  stats.hunger = clamp(
    stats.hunger -
      elapsedHours *
        FULLNESS_DECAY_PER_HOUR
  );

  // Energy decreases while awake
  // and recovers while sleeping.
  if (sleeping) {
    stats.energy = clamp(
      stats.energy +
        elapsedHours *
          SLEEP_ENERGY_PER_HOUR
    );
  } else {
    stats.energy = clamp(
      stats.energy -
        elapsedHours *
          AWAKE_ENERGY_DECAY_PER_HOUR
    );
  }

  // Happiness decreases only while awake.
  // Hunger and tiredness affect its decay rate.
  if (!sleeping) {
    const happinessRate =
      getHappinessDecayRate(
        stats.hunger,
        stats.energy
      );

    stats.happiness = clamp(
      stats.happiness -
        elapsedHours * happinessRate
    );
  }

  // Wellness reflects all updated stats.
  return {
    ...state,
    stats: withWellness(stats),
    lastUpdated: now,
  };
}
