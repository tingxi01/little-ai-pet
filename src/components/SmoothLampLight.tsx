
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

type Props = {
  enabled: boolean;
  position: [number, number, number];
  intensity?: number;
  color?: string;
  distance?: number;
  decay?: number;
};

export default function SmoothLampLight({
  enabled,
  position,
  intensity = 2,
  color = "#ffcf91",
  distance = 4,
  decay = 2,
}: Props) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    if (!lightRef.current) return;

    const targetIntensity = enabled ? intensity : 0;

    lightRef.current.intensity = THREE.MathUtils.damp(
      lightRef.current.intensity,
      targetIntensity,
      5,
      delta
    );
  });

  return (
    <pointLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={0}
      distance={distance}
      decay={decay}
      castShadow={false}
    />
  );
}
