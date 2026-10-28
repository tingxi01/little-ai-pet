
import { useGLTF, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Props = {
  isOn: boolean;
  onToggle: () => void;
};

export default function Lamp({ isOn, onToggle }: Props) {
  const { scene } = useGLTF("/models/bear-lamp.glb");

  const mainLight = useRef<THREE.PointLight>(null);
  const secondaryLight = useRef<THREE.PointLight>(null);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const model = useMemo(() => {
    const clone = scene.clone(true);

    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());

    clone.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  useFrame((_, delta) => {
    const fadeSpeed = 5;

    if (mainLight.current) {
      mainLight.current.intensity = THREE.MathUtils.damp(
        mainLight.current.intensity,
        isOn ? 2.5 : 0,
        fadeSpeed,
        delta
      );
    }

    if (secondaryLight.current) {
      secondaryLight.current.intensity = THREE.MathUtils.damp(
        secondaryLight.current.intensity,
        isOn ? 0.8 : 0,
        fadeSpeed,
        delta
      );
    }
  });

  return (
    <group
      position={[2.75, -1.5, -1.65]}
      rotation={[0, 0, 0]}
      scale={2.25}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
    >
      {/* Original bear lamp */}
      <primitive object={model} />

      {/* Smooth main lamp light */}
      <pointLight
        ref={mainLight}
        position={[-0.15, 1.15, 0.15]}
        color="#FFD6A0"
        intensity={0}
        distance={3.5}
        decay={2}
        castShadow={false}
      />

      {/* Soft surrounding glow */}
      <pointLight
        ref={secondaryLight}
        position={[-0.35, 0.85, 0.5]}
        color="#FFE5C5"
        intensity={0}
        distance={3}
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

useGLTF.preload("/models/bear-lamp.glb");
