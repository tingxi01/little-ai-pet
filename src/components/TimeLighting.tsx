
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
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
  frontPower: number;
  frontColor: string;
};

const modes: Record<TimeOfDay, LightingPreset> = {
  // ☀️ MORNING — Bright, creamy, cozy
  morning: {
    ambient: "#fff0dc",
    ambientPower: 0.95,
    sun: "#ffdda9",
    sunPower: 2.6,
    position: [-2.5, 5.5, -6],
    fill: "#fff4e8",
    fillPower: 0.45,
    ground: "#c9a68c",
    frontPower: 1.15,
    frontColor: "#fff1dc",
  },

  // 🌤️ AFTERNOON — Bright, cheerful daylight
  afternoon: {
    ambient: "#fff3e6",
    ambientPower: 1.05,
    sun: "#ffdfb4",
    sunPower: 2.4,
    position: [-1.5, 7, -6],
    fill: "#fff7ed",
    fillPower: 0.5,
    ground: "#d5b59b",
    frontPower: 1.2,
    frontColor: "#fff5e8",
  },

  // 🌅 EVENING — Soft golden-hour warmth
  evening: {
    ambient: "#ffe7d2",
    ambientPower: 0.85,
    sun: "#ffbd83",
    sunPower: 2.3,
    position: [-4, 3.5, -6],
    fill: "#ffe5ca",
    fillPower: 0.4,
    ground: "#bd907d",
    frontPower: 0.95,
    frontColor: "#ffd9b0",
  },

  // 🌙 NIGHT — Original lighting, unchanged
  night: {
    ambient: "#d9d5df",
    ambientPower: 0.5,
    sun: "#bfc9e2",
    sunPower: 0.25,
    position: [-3, 5, 4],
    fill: "#ffe5c5",
    fillPower: 0.35,
    ground: "#9b8793",
    frontPower: 0,
    frontColor: "#ffffff",
  },
};

export default function TimeLighting({
  timeOfDay,
  blindsOpen,
}: {
  timeOfDay: TimeOfDay;
  blindsOpen: boolean;
}) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const frontRef = useRef<THREE.DirectionalLight>(null);

  const preset = modes[timeOfDay];

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const smoothing = 1 - Math.exp(-delta * 1.5);

    // Main sunlight: creates your existing window shadows
    if (sunRef.current) {
      const driftX = Math.sin(t * 0.025) * 0.5;
      const driftY = Math.sin(t * 0.018) * 0.18;

      const target = new THREE.Vector3(
        preset.position[0] + driftX,
        preset.position[1] + driftY,
        preset.position[2]
      );

      sunRef.current.position.lerp(target, smoothing);

      const multiplier =
        timeOfDay === "night"
          ? 1
          : blindsOpen
          ? 1
          : 0.85;

      sunRef.current.intensity = THREE.MathUtils.damp(
        sunRef.current.intensity,
        preset.sunPower * multiplier,
        2,
        delta
      );

      sunRef.current.color.lerp(
        new THREE.Color(preset.sun),
        smoothing
      );
    }

    // Warm front lighting: brightens Mochi and furniture
    // WITHOUT casting additional shadows
    if (frontRef.current) {
      frontRef.current.intensity = THREE.MathUtils.damp(
        frontRef.current.intensity,
        preset.frontPower,
        2,
        delta
      );

      frontRef.current.color.lerp(
        new THREE.Color(preset.frontColor),
        smoothing
      );
    }
  });

  return (
    <>
      {/* Soft room brightness */}
      <ambientLight
        color={preset.ambient}
        intensity={preset.ambientPower}
      />

      {/* MAIN SUNLIGHT — keeps your beautiful shadows */}
      <directionalLight
        ref={sunRef}
        color={preset.sun}
        intensity={preset.sunPower}
        position={preset.position}
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
        shadow-radius={4}
      />

      {/* WARM FRONT LIGHT — brightens the room */}
      <directionalLight
        ref={frontRef}
        color={preset.frontColor}
        intensity={preset.frontPower}
        position={[3, 5, 7]}
        castShadow={false}
      />

      {/* Gentle fill for darker corners */}
      <hemisphereLight
        args={[
          preset.fill,
          preset.ground,
          preset.fillPower,
        ]}
      />
    </>
  );
}
