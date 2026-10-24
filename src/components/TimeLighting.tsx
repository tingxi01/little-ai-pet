
import type { TimeOfDay } from "../lib/pet";

type LightingPreset = {
  ambient: string;
  ambientPower: number;
  sun: string;
  sunPower: number;
  position: [number, number, number];
  fill: string;
  fillPower: number;
  ground: string;
};

const modes: Record<TimeOfDay, LightingPreset> = {
  // 🌅 MORNING — soft, buttery sunshine
  morning: {
    ambient: "#fff0dc",
    ambientPower: 0.85,
    sun: "#ffdda9",
    sunPower: 1.8,
    position: [-4, 5, 4],
    fill: "#fff4e8",
    fillPower: 0.35,
    ground: "#c9a68c",
  },

  // ☀️ AFTERNOON — cozy, natural daylight
  afternoon: {
    ambient: "#fff3e6",
    ambientPower: 0.85,
    sun: "#ffdfb4",
    sunPower: 1.65,
    position: [-3, 7, 5],
    fill: "#fff7ed",
    fillPower: 0.35,
    ground: "#d5b59b",
  },

  // 🌇 EVENING — warm golden-hour glow
  evening: {
    ambient: "#ffe7d2",
    ambientPower: 0.75,
    sun: "#ffbd83",
    sunPower: 1.7,
    position: [-5, 3.5, 3],
    fill: "#ffe5ca",
    fillPower: 0.3,
    ground: "#bd907d",
  },

  // 🌙 NIGHT — peaceful and softly illuminated
  night: {
    ambient: "#d9d5df",
    ambientPower: 0.5,
    sun: "#bfc9e2",
    sunPower: 0.25,
    position: [-3, 5, 4],
    fill: "#ffe5c5",
    fillPower: 0.35,
    ground: "#9b8793",
  },
};

export default function TimeLighting({
  timeOfDay,
}: {
  timeOfDay: TimeOfDay;
}) {
  const m = modes[timeOfDay];

  return (
    <>
      {/* Soft overall room illumination */}
      <ambientLight
        color={m.ambient}
        intensity={m.ambientPower}
      />

      {/* Main sunlight with soft shadows */}
      <directionalLight
        color={m.sun}
        intensity={m.sunPower}
        position={m.position}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />

      {/* Gentle bounced lighting */}
      <hemisphereLight
        args={[m.fill, m.ground, m.fillPower]}
      />
    </>
  );
}
