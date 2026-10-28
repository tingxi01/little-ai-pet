
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";

import Room from "./components/Room";
import PetHUD from "./components/PetHUD";
import BackgroundMusic from "./components/BackgroundMusic";

import { usePetGame } from "./hooks/usePetGame";

import { useSoundEffects } from "./hooks/useSoundEffects";

import type {
  PetAction,
  TimeMode,
  TimeOfDay,
} from "./lib/pet";

import "./App.css";

function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "evening";

  return "night";
}

export default function App() {
  const [petSleeping, setPetSleeping] =
    useState(false);

  const {
    pet,
    act,
    autonomousEvent,
  } = usePetGame({
    sleeping: petSleeping,
  });

  const { playSound, stopSound } =
    useSoundEffects();

  const [muted, setMuted] = useState(false);

  const toggleMusic = () => {
    setMuted((previous) => !previous);
  };

  const [timeMode, setTimeMode] =
    useState<TimeMode>("auto");

  const [now, setNow] = useState(
    () => new Date()
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () =>
      window.clearInterval(interval);
  }, []);

  const currentTime: TimeOfDay =
    timeMode === "auto"
      ? getTimeOfDay(now)
      : timeMode;

  const [lampOn, setLampOn] =
    useState(false);

  const [stoolLampOn, setStoolLampOn] =
    useState(false);

  const [blindsOpen, setBlindsOpen] =
    useState(false);

  const toggleLamp = () => {
    playSound("lamp");
    setLampOn((previous) => !previous);
  };

  const toggleStoolLamp = () => {
    playSound("lamp");
    setStoolLampOn((previous) => !previous);
  };

  const toggleBlinds = () => {
    playSound("blinds");
    setBlindsOpen((previous) => !previous);
  };

  const [lastAction, setLastAction] =
    useState<PetAction | null>(null);

  const [actionId, setActionId] =
    useState(0);

  // ==========================================
  // USER INTERACTIONS
  // ==========================================

  const onAction = (action: PetAction) => {
    // Repeated Sleep clicks should not restart
    // sleep or give additional energy.
    if (
      action === "sleep" &&
      petSleeping
    ) {
      return;
    }

    // Check all care rules before triggering
    // animations, sounds, or state changes.
    const accepted = act(action);

    if (!accepted) {
      return;
    }

    setLastAction(action);
    setActionId(
      (previous) => previous + 1
    );

    if (action === "sleep") {
      playSound("sleep");
      setPetSleeping(true);
      return;
    }

    // Any accepted non-Sleep action wakes Mochi.
    if (petSleeping) {
      stopSound("sleep");
      setPetSleeping(false);
    }

    switch (action) {
      case "pet":
        playSound("pet");
        break;

      case "feed":
        playSound("feed");
        break;

      case "play":
        playSound("play");
        break;

      default:
        break;
    }
  };

  return (
    <div className="app">
      <BackgroundMusic muted={muted} />

      <Canvas
        camera={{
          position: [0, 1.5, 8],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        shadows
        gl={{
          antialias: true,
        }}
      >
        <color
          attach="background"
          args={["#f7e7d5"]}
        />

        <Suspense fallback={null}>
          <Room
            timeOfDay={currentTime}
            onPet={() => onAction("pet")}
            lastAction={lastAction}
            actionId={actionId}
            autonomousEvent={autonomousEvent}
            lampOn={lampOn}
            onLamp={toggleLamp}
            stoolLampOn={stoolLampOn}
            onStoolLamp={toggleStoolLamp}
            blindsOpen={blindsOpen}
            onBlinds={toggleBlinds}
          />
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 0.1, -1]}
          enablePan={false}
          enableDamping
          dampingFactor={0.07}
          minDistance={5.4}
          maxDistance={9}
          minPolarAngle={0.8}
          maxPolarAngle={1.55}
          minAzimuthAngle={-0.55}
          maxAzimuthAngle={0.55}
          rotateSpeed={0.45}
          zoomSpeed={0.65}
        />
      </Canvas>

      <PetHUD
        pet={pet}
        onAction={onAction}
        timeMode={timeMode}
        onTimeMode={setTimeMode}
        actualTime={now.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
        muted={muted}
        onMute={toggleMusic}
        lampOn={lampOn}
        onLamp={toggleLamp}
        stoolLampOn={stoolLampOn}
        onStoolLamp={toggleStoolLamp}
        blindsOpen={blindsOpen}
        onBlinds={toggleBlinds}
      />
    </div>
  );
}
