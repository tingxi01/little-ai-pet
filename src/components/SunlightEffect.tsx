
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { TimeOfDay } from "../lib/pet";

type Props = {
  timeOfDay: TimeOfDay;
  blindsOpen: boolean;
};

export default function SunlightEffect({
  timeOfDay,
  blindsOpen,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const slatPositions = useMemo(
    () =>
      Array.from(
        { length: 9 },
        (_, i) => 0.45 + i * 0.23
      ),
    []
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetScale = blindsOpen ? 0.08 : 1;

    groupRef.current.scale.y = THREE.MathUtils.damp(
      groupRef.current.scale.y,
      targetScale,
      3.5,
      delta
    );
  });

  if (timeOfDay === "night") return null;

  return (
    <group
      ref={groupRef}
      position={[0, 0, -2.65]}
    >
      {slatPositions.map((y, i) => (
        <mesh
          key={i}
          position={[0, y, 0]}
          castShadow
          visible
        >
          <boxGeometry args={[3.6, 0.105, 0.04]} />

          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            colorWrite={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
