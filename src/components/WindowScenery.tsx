
import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { TimeOfDay } from "../lib/pet";

type Props = {
  timeOfDay: TimeOfDay;
};

type LeafData = {
  x: number;
  y: number;
  speed: number;
  sway: number;
  phase: number;
  size: number;
  rotation: number;
  color: string;
};

const LEAF_COUNT = 12;

const LEAF_COLORS = [
  "#D98A45",
  "#E5A455",
  "#C97943",
  "#E7B46C",
  "#B87B43",
];

function makeLeafTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.Texture();
  }

  ctx.translate(64, 64);

  // Draw a recognizable leaf silhouette
  ctx.beginPath();
  ctx.moveTo(0, -45);
  ctx.bezierCurveTo(30, -35, 40, -5, 0, 38);
  ctx.bezierCurveTo(-40, -5, -30, -35, 0, -45);
  ctx.closePath();

  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Leaf vein
  ctx.beginPath();
  ctx.moveTo(0, -35);
  ctx.lineTo(0, 32);
  ctx.strokeStyle = "rgba(130,85,45,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function FallingLeaves({
  timeOfDay,
}: {
  timeOfDay: TimeOfDay;
}) {
  const leavesRef = useRef<THREE.Group>(null);

  const texture = useMemo(() => makeLeafTexture(), []);

  const leaves = useMemo<LeafData[]>(
    () =>
      Array.from({ length: LEAF_COUNT }, (_, i) => ({
        x: -1.7 + Math.random() * 3.4,
        y: -1.1 + Math.random() * 2.2,
        speed: 0.08 + Math.random() * 0.12,
        sway: 0.08 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
        size: 0.09 + Math.random() * 0.09,
        rotation: Math.random() * Math.PI * 2,
        color: LEAF_COLORS[i % LEAF_COLORS.length],
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!leavesRef.current) return;

    const time = clock.elapsedTime;

    leavesRef.current.children.forEach((object, index) => {
      const leaf = leaves[index];

      if (!leaf) return;

      const travel = (time * leaf.speed) % 2.8;

      object.position.x =
        leaf.x +
        Math.sin(time * 0.7 + leaf.phase) * leaf.sway;

      object.position.y =
        1.4 - ((leaf.y + 1.4 + travel) % 2.8);

      object.rotation.z =
        leaf.rotation +
        Math.sin(time * 0.8 + leaf.phase) * 0.4;

      object.rotation.y =
        Math.sin(time * 1.1 + leaf.phase) * 0.5;
    });
  });

  if (timeOfDay === "night") return null;

  return (
    <group ref={leavesRef}>
      {leaves.map((leaf, index) => (
        <mesh
          key={index}
          position={[leaf.x, leaf.y, 0]}
          scale={leaf.size}
        >
          <planeGeometry args={[1, 1]} />

          <meshBasicMaterial
            map={texture}
            color={leaf.color}
            transparent
            alphaTest={0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Fireflies() {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 9 }, () => ({
        x: (Math.random() - 0.5) * 3.2,
        y: (Math.random() - 0.5) * 1.7,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.elapsedTime;

    groupRef.current.children.forEach((object, index) => {
      const particle = particles[index];

      if (!particle) return;

      object.position.x =
        particle.x +
        Math.sin(time * 0.35 + particle.phase) * 0.08;

      object.position.y =
        particle.y +
        Math.cos(time * 0.45 + particle.phase) * 0.06;

      const material = (object as THREE.Mesh)
        .material as THREE.MeshBasicMaterial;

      material.opacity =
        0.25 +
        (Math.sin(time * 1.5 + particle.phase) + 1) * 0.3;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((particle, index) => (
        <mesh
          key={index}
          position={[particle.x, particle.y, 0]}
        >
          <circleGeometry args={[0.018, 12]} />

          <meshBasicMaterial
            color="#FFE7A0"
            transparent
            opacity={0.4}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function WindowScenery({
  timeOfDay,
}: Props) {
  const gardenTexture = useLoader(
    THREE.TextureLoader,
    "/images/window-garden.png"
  );

  const texture = useMemo(() => {
    const cloned = gardenTexture.clone();

    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.needsUpdate = true;

    return cloned;
  }, [gardenTexture]);

  const tint: Record<TimeOfDay, string> = {
    morning: "#FFF3DC",
    afternoon: "#FFFFFF",
    evening: "#FFD3AD",
    night: "#53647E",
  };

  return (
    <group>
      {/* Garden background */}
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[3.8, 2.3]} />

        <meshBasicMaterial
          map={texture}
          color={tint[timeOfDay]}
          toneMapped={false}
        />
      </mesh>

      {/* Animated falling leaves */}
      <group position={[0, 0, 0.015]}>
        <FallingLeaves timeOfDay={timeOfDay} />
      </group>

      {/* Subtle fireflies at night */}
      {timeOfDay === "night" && (
        <group position={[0, 0, 0.02]}>
          <Fireflies />
        </group>
      )}
    </group>
  );
}
