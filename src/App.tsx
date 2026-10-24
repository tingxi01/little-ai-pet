
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";

import Room from "./components/Room";
import PetHUD from "./components/PetHUD";

import { usePetGame } from "./hooks/usePetGame";
import { useAmbientMusic } from "./hooks/useAmbientMusic";

import {
  timeNow,
  type PetAction,
  type TimeMode,
} from "./lib/pet";

import "./App.css";

export default function App() {
  const { pet, act, setTemperament } = usePetGame();

  const {
    muted,
    toggle: toggleMusic,
  } = useAmbientMusic();

  const [timeMode, setTimeMode] =
    useState<TimeMode>("auto");

  const [now, setNow] = useState(new Date());

  const [lampOn, setLampOn] = useState(false);
  const [stoolLampOn, setStoolLampOn] = useState(false);
  const [blindsOpen, setBlindsOpen] = useState(false);

  const [lastAction, setLastAction] =
    useState<PetAction | null>(null);

  // Changes on EVERY button press
  const [actionId, setActionId] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(id);
  }, []);

  const onAction = (action: PetAction) => {
    act(action);
    setLastAction(action);
    setActionId((previous) => previous + 1);
  };

  const currentTime =
    timeMode === "auto"
      ? timeNow()
      : timeMode;

  return (
    <div className="app">
      <Canvas
        camera={{
          position: [0, 1.5, 8],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        shadows
        gl={{ antialias: true }}
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
            lampOn={lampOn}
            onLamp={() =>
              setLampOn((previous) => !previous)
            }
            stoolLampOn={stoolLampOn}
            onStoolLamp={() =>
              setStoolLampOn((previous) => !previous)
            }
            blindsOpen={blindsOpen}
            onBlinds={() =>
              setBlindsOpen((previous) => !previous)
            }
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
        onTemperament={setTemperament}
        timeMode={timeMode}
        onTimeMode={setTimeMode}
        actualTime={now.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
        muted={muted}
        onMute={toggleMusic}
        lampOn={lampOn}
        onLamp={() =>
          setLampOn((previous) => !previous)
        }
        stoolLampOn={stoolLampOn}
        onStoolLamp={() =>
          setStoolLampOn((previous) => !previous)
        }
        blindsOpen={blindsOpen}
        onBlinds={() =>
          setBlindsOpen((previous) => !previous)
        }
      />
    </div>
  );
}
