
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

const WIND_STRENGTH = 0.015;
const WIND_SPEED = 0.55;

// The lower part of the plant stays stationary.
// Adjust these if the movement starts too low or high.
const WIND_START = 0.28;
const WIND_FULL = 0.65;

type AnimatedMesh = {
  geometry: THREE.BufferGeometry;
  original: Float32Array;
  weights: Float32Array;
};

export default function Plant() {
  const { scene } = useGLTF("/models/plant.glb");

  const { model, animatedMeshes } = useMemo(() => {
    const cloned = scene.clone(true);

    const animatedMeshes: AnimatedMesh[] = [];

    // Calculate the original model's bounds.
    const bounds = new THREE.Box3().setFromObject(cloned);

    const height = Math.max(
      bounds.max.y - bounds.min.y,
      0.001
    );

    cloned.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.castShadow = true;
      object.receiveShadow = true;

      // Clone geometry so other uses of the GLB aren't affected.
      const geometry = object.geometry.clone();
      object.geometry = geometry;

      const position = geometry.getAttribute("position");

      if (!position) return;

      const original = new Float32Array(
        position.array as ArrayLike<number>
      );

      const weights = new Float32Array(position.count);

      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);

        // Height relative to the original plant model.
        const normalizedHeight =
          (y - bounds.min.y) / height;

        weights[i] = THREE.MathUtils.smoothstep(
          normalizedHeight,
          WIND_START,
          WIND_FULL
        );
      }

      animatedMeshes.push({
        geometry,
        original,
        weights,
      });
    });

    return {
      model: cloned,
      animatedMeshes,
    };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    for (const {
      geometry,
      original,
      weights,
    } of animatedMeshes) {
      const position = geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;

      for (let i = 0; i < position.count; i++) {
        const offset = i * 3;

        const x = original[offset];
        const y = original[offset + 1];
        const z = original[offset + 2];

        const weight = weights[i];

        if (weight <= 0) continue;

        const sway =
          Math.sin(t * WIND_SPEED + x * 0.7) *
          WIND_STRENGTH;

        const secondary =
          Math.sin(t * 1.8 + z * 0.9) *
          WIND_STRENGTH *
          0.3;

        position.setXYZ(
          i,
          x + (sway + secondary) * weight,
          y,
          z + sway * weight * 0.25
        );
      }

      position.needsUpdate = true;
    }
  });

  return (
    <group
      position={[4.2, -0.22, -1.4]}
      rotation={[0, -0.15, 0]}
      scale={1.3}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/plant.glb");
