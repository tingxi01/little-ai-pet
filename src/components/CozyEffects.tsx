
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { PetAction, TimeOfDay } from "../lib/pet";

type Props = {
  timeOfDay: TimeOfDay;
  lastAction: PetAction | null;
  actionId: number;
};

// ==========================================
// SOFT COFFEE STEAM
// ==========================================

function Steam() {
  const steamRef = useRef<THREE.Group>(null);

  const smokeTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    const gradient = ctx.createRadialGradient(
      64, 64, 0,
      64, 64, 64
    );

    gradient.addColorStop(
      0,
      "rgba(255,250,240,0.38)"
    );

    gradient.addColorStop(
      0.25,
      "rgba(255,250,240,0.22)"
    );

    gradient.addColorStop(
      0.55,
      "rgba(255,250,240,0.08)"
    );

    gradient.addColorStop(
      1,
      "rgba(255,250,240,0)"
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        offset: i / 18,
        seed: i * 2.39996,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!steamRef.current) return;

    const t = clock.elapsedTime;

    steamRef.current.children.forEach(
      (child, i) => {
        const particle = particles[i];

        const progress =
          (t * 0.17 + particle.offset) % 1;

        const curl =
          Math.sin(
            progress * 7 +
              t * 0.65 +
              particle.seed
          ) *
          (0.025 + progress * 0.09);

        const drift =
          Math.sin(
            progress * 4 +
              t * 0.35
          ) *
          progress *
          0.045;

        child.position.set(
          curl + drift,
          progress * 0.62,
          Math.cos(
            progress * 5 +
              particle.seed
          ) * 0.025
        );

        const width =
          0.10 + progress * 0.20;

        const height =
          0.14 + progress * 0.16;

        child.scale.set(
          width,
          height,
          1
        );

        const mesh = child as THREE.Mesh;

        const material =
          mesh.material as THREE.MeshBasicMaterial;

        const fade = Math.sin(
          progress * Math.PI
        );

        material.opacity =
          fade * 0.47;

        child.rotation.z =
          Math.sin(
            t * 0.5 +
              particle.seed
          ) * 0.3;
      }
    );
  });

  if (!smokeTexture) return null;

  return (
    <group
      ref={steamRef}
      position={[1.34, -0.55, 1.48]}
    >
      {particles.map((_, i) => (
        <mesh key={i}>
          <planeGeometry args={[1, 1]} />

          <meshBasicMaterial
            map={smokeTexture}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ==========================================
// SMALL ROUNDED 3D Z GEOMETRY
// ==========================================

function createPuffyZGeometry() {
  const shape = new THREE.Shape();

  shape.moveTo(-0.38, 0.32);
  shape.lineTo(0.38, 0.32);

  shape.quadraticCurveTo(
    0.48,
    0.32,
    0.38,
    0.19
  );

  shape.lineTo(-0.24, -0.23);
  shape.lineTo(0.35, -0.23);

  shape.quadraticCurveTo(
    0.48,
    -0.23,
    0.48,
    -0.34
  );

  shape.quadraticCurveTo(
    0.48,
    -0.43,
    0.35,
    -0.43
  );

  shape.lineTo(-0.4, -0.43);

  shape.quadraticCurveTo(
    -0.5,
    -0.43,
    -0.5,
    -0.31
  );

  shape.lineTo(0.13, 0.12);
  shape.lineTo(-0.38, 0.12);

  shape.quadraticCurveTo(
    -0.5,
    0.12,
    -0.5,
    0.22
  );

  shape.quadraticCurveTo(
    -0.5,
    0.32,
    -0.38,
    0.32
  );

  const geometry =
    new THREE.ExtrudeGeometry(
      shape,
      {
        depth: 0.08,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.035,
        bevelSegments: 8,
        curveSegments: 24,
        steps: 1,
      }
    );

  geometry.center();
  geometry.computeVertexNormals();

  return geometry;
}

// ==========================================
// SLEEP ZZZ - SMALL COZY 3D PARTICLES
// ==========================================

function SleepZzz({
  lastAction,
}: {
  lastAction: PetAction | null;
}) {
  const group =
    useRef<THREE.Group>(null);

  const zGeometry = useMemo(
    () => createPuffyZGeometry(),
    []
  );

  const particles = useMemo(
    () =>
      Array.from(
        { length: 3 },
        (_, i) => ({
          offset: i / 3,
          sway: i * 1.8,
          size:
            0.13 +
            i * 0.025,
        })
      ),
    []
  );

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    group.current.children.forEach(
      (child, i) => {
        const particle =
          particles[i];

        const progress =
          (
            t * 0.22 +
            particle.offset
          ) % 1;

        // Float diagonally away
        // from Mochi's ear
        child.position.set(
          progress * 0.45 +
            Math.sin(
              t * 0.8 +
                particle.sway
            ) * 0.035,

          progress * 0.85,

          0
        );

        // Gentle grow and shrink
        const size =
          particle.size *
          (
            0.7 +
            Math.sin(
              progress *
                Math.PI
            ) * 0.45
          );

        child.scale.setScalar(
          size
        );

        // Subtle rotation
        child.rotation.z =
          Math.sin(
            t * 0.65 +
              particle.sway
          ) * 0.08;

        child.rotation.y =
          Math.sin(
            t * 0.45 +
              particle.sway
          ) * 0.08;

        // Smooth fade
        const mesh =
          child as THREE.Mesh;

        const material =
          mesh.material as THREE.MeshStandardMaterial;

        material.opacity =
          Math.sin(
            progress *
              Math.PI
          ) * 0.85;
      }
    );
  });

  if (lastAction !== "sleep") {
    return null;
  }

  return (
    <group
      ref={group}
      position={[
        0.75,
        1.65,
        -0.65
      ]}
    >
      {particles.map(
        (_, i) => (
          <mesh
            key={i}
            geometry={zGeometry}
          >
            <meshStandardMaterial
              color="#fff1cc"
              roughness={0.55}
              metalness={0}
              emissive="#ffe4ae"
              emissiveIntensity={0.08}
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      )}
    </group>
  );
}

// ==========================================
// MAIN COZY EFFECTS
// ==========================================

export default function CozyEffects({
  lastAction,
}: Props) {
  return (
    <>
      {/* Keep soft coffee steam */}
      <Steam />

      {/* Keep cute sleeping Zzz */}
      <SleepZzz lastAction={lastAction} />
    </>
  );
}
