
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
  actionId: number;
  active: boolean;
};

const HEART_COUNT = 4;
const ANIMATION_DURATION = 2.2;

// Create a rounded, puffy 3D heart
function createHeartGeometry() {
  const shape = new THREE.Shape();

  shape.moveTo(0, 0.28);

  shape.bezierCurveTo(
    -0.35, 0.65,
    -0.85, 0.25,
    0, -0.5
  );

  shape.bezierCurveTo(
    0.85, 0.25,
    0.35, 0.65,
    0, 0.28
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.13,
    bevelSegments: 8,
    steps: 1,
    curveSegments: 24,
  });

  geometry.center();

  return geometry;
}

export default function PettingHearts({
  actionId,
  active,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(-100);
  const previousActionId = useRef(actionId);

  const heartGeometry = useMemo(
    () => createHeartGeometry(),
    []
  );

  const hearts = useMemo(
    () =>
      Array.from({ length: HEART_COUNT }, (_, i) => ({
        delay: i * 0.18,
        side: i % 2 === 0 ? -1 : 1,
        offsetX:
          (i % 2 === 0 ? -0.55 : 0.55) +
          (i - 1.5) * 0.045,
        offsetZ: 0.12,
        size: 0.20 + (i % 2) * 0.04,
        sway: i * 1.7,
      })),
    []
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;

    // Restart when Mochi is petted again
    if (previousActionId.current !== actionId) {
      previousActionId.current = actionId;

      if (active) {
        startTime.current = time;
      }
    }

    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, i) => {
      const heart = hearts[i];

      const elapsed =
        time - startTime.current - heart.delay;

      if (
        elapsed < 0 ||
        elapsed > ANIMATION_DURATION
      ) {
        child.visible = false;
        return;
      }

      child.visible = true;

      const progress =
        elapsed / ANIMATION_DURATION;

      // Float upward and slightly outward
      child.position.set(
        heart.offsetX +
          heart.side * progress * 0.25 +
          Math.sin(elapsed * 2.5 + heart.sway) * 0.035,

        progress * 1.25,

        heart.offsetZ
      );

      // Cute little pop-in animation
      const popIn = Math.min(1, elapsed / 0.22);
      const fadeOut = Math.min(
        1,
        (ANIMATION_DURATION - elapsed) / 0.5
      );

      const scale =
        heart.size *
        (0.85 + Math.sin(progress * Math.PI) * 0.15) *
        popIn;

      child.scale.setScalar(scale);

      child.rotation.z =
        Math.sin(elapsed * 2 + heart.sway) * 0.12;

      child.rotation.y =
        Math.sin(elapsed * 1.4 + heart.sway) * 0.18;

      const mesh = child as THREE.Mesh;
      const material =
        mesh.material as THREE.MeshStandardMaterial;

      material.opacity =
        Math.max(0, Math.min(1, fadeOut)) * 0.95;
    });
  });

  return (
    <group
      ref={groupRef}
      position={[0, 1.5, -1]}
    >
      {hearts.map((heart, i) => (
        <mesh
          key={i}
          geometry={heartGeometry}
          visible={false}
        >
          <meshStandardMaterial
            color={
              i % 2 === 0
                ? "#f6aebd"
                : "#ffc6d2"
            }
            roughness={0.55}
            metalness={0}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
