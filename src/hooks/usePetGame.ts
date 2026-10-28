
import { useEffect, useRef, useState } from "react";

import {
  applyAction,
  decay,
  getCareRefusal,
  initialPet,
  type PetAction,
  type PetState,
  type Temperament,
} from "../lib/pet";

const KEY = "little-ai-pet-v1";
const API = "http://127.0.0.1:8000";

const AUTONOMOUS_INTERVAL = 3 * 60_000;
const INTERACTION_COOLDOWN = 2 * 60_000;

const STATS_INTERVAL = 1_000;
const SAVE_INTERVAL = 15_000;

export type AutonomousAction =
  | "ask_food"
  | "rest"
  | "seek_attention"
  | "play"
  | "idle";

export type AutonomousEvent = {
  action: AutonomousAction;
  id: number;
};

type UsePetGameOptions = {
  sleeping?: boolean;
};

export function getPlayRefusal(
  state: PetState
): string | null {
  return getCareRefusal(state, "play");
}

function load(): PetState {
  try {
    const saved = localStorage.getItem(KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as PetState;

      if (
        parsed.stats &&
        ["gentle", "playful", "sleepy"].includes(
          parsed.temperament
        )
      ) {
        return decay(parsed);
      }
    }
  } catch {
    // Ignore invalid saved data.
  }

  return initialPet;
}

function visibleStatsChanged(
  previous: PetState,
  next: PetState
): boolean {
  const a = previous.stats;
  const b = next.stats;

  return (
    Math.round(a.hunger) !== Math.round(b.hunger) ||
    Math.round(a.happiness) !==
      Math.round(b.happiness) ||
    Math.round(a.energy) !== Math.round(b.energy) ||
    Math.round(a.wellness) !==
      Math.round(b.wellness)
  );
}

export function usePetGame(
  options: UsePetGameOptions = {}
) {
  const { sleeping = false } = options;

  const [pet, setPet] = useState<PetState>(load);

  const [thinking, setThinking] = useState(false);

  const [speechVisible, setSpeechVisible] =
    useState(false);

  const [autonomousEvent, setAutonomousEvent] =
    useState<AutonomousEvent | null>(null);

  const petRef = useRef(pet);
  const requestId = useRef(0);

  const lastInteraction = useRef(Date.now());
  const lastAutonomous = useRef(Date.now());

  const busy = useRef(false);
  const sleepingRef = useRef(sleeping);

  const autonomousRequestId =
    useRef<number | null>(null);

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  function updatePet(next: PetState) {
    petRef.current = next;
    setPet(next);
  }

  function savePet() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(petRef.current)
      );
    } catch (error) {
      console.warn(
        "Could not save Mochi:",
        error
      );
    }
  }

  // Save periodically and when the page
  // becomes hidden or the component unmounts.
  useEffect(() => {
    const timer = window.setInterval(
      savePet,
      SAVE_INTERVAL
    );

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        savePet();
      }
    };

    const onPageHide = () => {
      savePet();
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    window.addEventListener(
      "pagehide",
      onPageHide
    );

    return () => {
      window.clearInterval(timer);

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      window.removeEventListener(
        "pagehide",
        onPageHide
      );

      savePet();
    };
  }, []);

  // ==========================================
  // MANUAL SLEEP STATE
  // ==========================================

  useEffect(() => {
    const wasSleeping = sleepingRef.current;

    if (sleeping === wasSleeping) {
      return;
    }

    // Apply elapsed time under the previous
    // state before switching modes.
    const next = decay(
      petRef.current,
      wasSleeping
    );

    petRef.current = next;

    if (visibleStatsChanged(pet, next)) {
      setPet(next);
    }

    sleepingRef.current = sleeping;

    if (sleeping) {
      if (
        autonomousRequestId.current !== null &&
        autonomousRequestId.current ===
          requestId.current
      ) {
        ++requestId.current;
        busy.current = false;
        setThinking(false);
      }

      autonomousRequestId.current = null;

      setAutonomousEvent(null);
      lastInteraction.current = Date.now();
    } else {
      lastInteraction.current = Date.now();
      lastAutonomous.current = Date.now();
    }
  }, [sleeping]);

  // ==========================================
  // OPTIMIZED STAT UPDATES
  // ==========================================

  useEffect(() => {
    const timer = window.setInterval(() => {
      const previous = petRef.current;

      const next = decay(
        previous,
        sleepingRef.current
      );

      // Always advance the internal clock,
      // even if the HUD does not need updating.
      petRef.current = next;

      // Only re-render when the displayed
      // values have actually changed.
      if (visibleStatsChanged(previous, next)) {
        setPet(next);
      }
    }, STATS_INTERVAL);

    return () => window.clearInterval(timer);
  }, []);

  // ==========================================
  // AI DIALOGUE
  // ==========================================

  async function requestDialogue(
    action: PetAction,
    snapshot: PetState,
    id: number
  ) {
    busy.current = true;
    setThinking(true);
    setSpeechVisible(false);

    try {
      const response = await fetch(
        `${API}/mochi/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            temperament: snapshot.temperament,
            stats: snapshot.stats,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data: { message: string } =
        await response.json();

      if (id !== requestId.current) return;

      if (data.message?.trim()) {
        updatePet({
          ...petRef.current,
          message: data.message.trim(),
        });

        setSpeechVisible(true);
      }
    } catch (error) {
      console.warn(
        "Mochi dialogue unavailable:",
        error
      );

      if (id === requestId.current) {
        setSpeechVisible(false);
      }
    } finally {
      if (id === requestId.current) {
        busy.current = false;
        setThinking(false);
      }
    }
  }

  // ==========================================
  // CARE REFUSAL
  // ==========================================

  function refuseAction(
    action: PetAction
  ): boolean {
    const message = getCareRefusal(
      petRef.current,
      action
    );

    if (!message) return false;

    ++requestId.current;

    autonomousRequestId.current = null;
    busy.current = false;

    lastInteraction.current = Date.now();

    setThinking(false);
    setAutonomousEvent(null);

    updatePet({
      ...petRef.current,
      message,
    });

    setSpeechVisible(true);

    return true;
  }

  function refusePlay(): boolean {
    return refuseAction("play");
  }

  // ==========================================
  // USER ACTIONS
  // ==========================================

  function act(action: PetAction): boolean {
    const next = decay(
      petRef.current,
      sleepingRef.current
    );

    petRef.current = next;

    if (refuseAction(action)) {
      return false;
    }

    const id = ++requestId.current;

    autonomousRequestId.current = null;
    lastInteraction.current = Date.now();

    setAutonomousEvent(null);

    const updated = applyAction(
      petRef.current,
      action
    );

    updatePet(updated);

    void requestDialogue(
      action,
      updated,
      id
    );

    return true;
  }

  // ==========================================
  // TEMPERAMENT
  // ==========================================

  function setTemperament(
    temperament: Temperament
  ) {
    ++requestId.current;

    autonomousRequestId.current = null;
    busy.current = false;

    lastInteraction.current = Date.now();

    setThinking(false);
    setSpeechVisible(false);
    setAutonomousEvent(null);

    updatePet({
      ...petRef.current,
      temperament,
      message: `Mochi feels ${temperament} today ♡`,
    });
  }

  // ==========================================
  // AUTONOMOUS AI DECISIONS
  // ==========================================

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const now = Date.now();

      if (
        sleepingRef.current ||
        busy.current ||
        now - lastInteraction.current <
          INTERACTION_COOLDOWN ||
        now - lastAutonomous.current <
          AUTONOMOUS_INTERVAL
      ) {
        return;
      }

      lastAutonomous.current = now;

      const id = ++requestId.current;

      autonomousRequestId.current = id;

      busy.current = true;
      setThinking(true);
      setSpeechVisible(false);

      try {
        const snapshot = petRef.current;

        const response = await fetch(
          `${API}/mochi/decide`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              temperament: snapshot.temperament,
              stats: snapshot.stats,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data: {
          action: AutonomousAction;
          message: string;
        } = await response.json();

        if (
          id !== requestId.current ||
          sleepingRef.current
        ) {
          return;
        }

        if (data.action !== "idle") {
          setAutonomousEvent({
            action: data.action,
            id,
          });
        } else {
          setAutonomousEvent(null);
        }

        if (
          data.action !== "idle" &&
          data.message?.trim()
        ) {
          updatePet({
            ...petRef.current,
            message: data.message.trim(),
          });

          setSpeechVisible(true);
        }
      } catch (error) {
        console.warn(
          "Mochi autonomous decision unavailable:",
        error
        );
      } finally {
        if (
          autonomousRequestId.current === id
        ) {
          autonomousRequestId.current = null;
        }

        if (id === requestId.current) {
          busy.current = false;
          setThinking(false);
        }
      }
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  return {
    pet,
    act,
    refuseAction,
    refusePlay,
    setTemperament,
    thinking,
    speechVisible,
    autonomousEvent,
  };
}
