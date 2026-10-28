
import { useEffect, useRef, useState } from "react";

import {
  applyAction,
  decay,
  initialPet,
  type PetAction,
  type PetState,
  type Temperament,
} from "../lib/pet";

const KEY = "little-ai-pet-v1";
const API = "http://127.0.0.1:8000";

const AUTONOMOUS_INTERVAL = 3 * 60_000;
const INTERACTION_COOLDOWN = 2 * 60_000;

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
    // Ignore invalid local storage.
  }

  return initialPet;
}

export function usePetGame() {
  const [pet, setPet] = useState<PetState>(load);
  const [thinking, setThinking] = useState(false);
  const [speechVisible, setSpeechVisible] =
    useState(false);

  const petRef = useRef(pet);
  const requestId = useRef(0);

  const lastInteraction = useRef(Date.now());
  const lastAutonomous = useRef(Date.now());

  const busy = useRef(false);

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  function updatePet(next: PetState) {
    petRef.current = next;
    setPet(next);
  }

  useEffect(() => {
    petRef.current = pet;

    localStorage.setItem(
      KEY,
      JSON.stringify(pet),
    );
  }, [pet]);

  // ==========================================
  // STAT DECAY
  // ==========================================

  useEffect(() => {
    const timer = window.setInterval(() => {
      updatePet(decay(petRef.current));
    }, 60_000);

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

    // Don't display old dialogue while thinking.
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
        throw new Error(`HTTP ${response.status}`);
      }

      const data: { message: string } =
        await response.json();

      // Ignore outdated AI responses.
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
  // USER ACTIONS
  // ==========================================

  function act(action: PetAction) {
    const id = ++requestId.current;

    lastInteraction.current = Date.now();

    const next = applyAction(
      petRef.current,
      action
    );

    updatePet(next);

    void requestDialogue(action, next, id);
  }

  // ==========================================
  // TEMPERAMENT
  // ==========================================

  function setTemperament(
    temperament: Temperament
  ) {
    ++requestId.current;

    busy.current = false;
    lastInteraction.current = Date.now();

    setThinking(false);
    setSpeechVisible(false);

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
          action:
            | "ask_food"
            | "rest"
            | "seek_attention"
            | "play"
            | "idle";
          message: string;
        } = await response.json();

        if (id !== requestId.current) return;

        // Autonomous decisions express intentions.
        // They don't simulate a user action or
        // change stats or trigger animations.
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
    setTemperament,
    thinking,
    speechVisible,
  };
}
