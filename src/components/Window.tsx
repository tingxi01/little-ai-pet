
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { TimeOfDay } from "../lib/pet";

type WindowProps = {
  timeOfDay: TimeOfDay;
  blindsOpen?: boolean;
  onBlinds?: () => void;
};

export default function Window({
  timeOfDay,
  blindsOpen = false,
  onBlinds,
}: WindowProps) {
  const { scene } = useGLTF("/models/window-blinds.glb");

  const blinds = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    const scale = 3.9 / Math.max(size.x, 0.001);

    const wrapper = new THREE.Group();

    cloned.position.set(
      -center.x,
      -center.y,
      -center.z
    );

    wrapper.add(cloned);
    wrapper.scale.setScalar(scale);

    return wrapper;
  }, [scene]);

  const skyColors: Record<TimeOfDay, string> = {
    morning: "#F9DDBB",
    afternoon: "#D8E9ED",
    evening: "#F6AD83",
    night: "#29354F",
  };

  const isNight = timeOfDay === "night";
  const isEvening = timeOfDay === "evening";

  const sunColor =
    timeOfDay === "morning"
      ? "#FFF0C9"
      : isEvening
      ? "#FFD5A0"
      : "#FFF8DB";

  return (
    <group position={[0, 2.35, -2.85]}>
      {/* Sky */}
      <mesh>
        <planeGeometry args={[3.8, 2.3]} />
        <meshBasicMaterial
          color={skyColors[timeOfDay]}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Sun or moon */}
      <mesh
        position={[
          1.05,
          isEvening ? -0.35 : 0.45,
          0.02,
        ]}
      >
        <circleGeometry
          args={[isNight ? 0.2 : 0.27, 32]}
        />
        <meshBasicMaterial
          color={isNight ? "#F7F0DB" : sunColor}
          toneMapped={false}
        />
      </mesh>

      {/* Night stars */}
      {isNight &&
        [
          [-1.2, 0.7],
          [-0.5, 0.85],
          [0.25, 0.6],
          [0.8, -0.1],
        ].map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0.03]}>
            <circleGeometry args={[0.025, 12]} />
            <meshBasicMaterial
              color="#FFF7DC"
              toneMapped={false}
            />
          </mesh>
        ))}

      {/* Wooden frame */}
      {[
        [0, 1.17, 3.95, 0.13],
        [0, -1.17, 3.95, 0.13],
        [-1.95, 0, 0.13, 2.45],
        [1.95, 0, 0.13, 2.45],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0.05]}>
          <boxGeometry args={[width, height, 0.12]} />
          <meshStandardMaterial
            color="#E7C49E"
            roughness={1}
          />
        </mesh>
      ))}

      {/* Clickable blinds */}
      <group
        position={[0, blindsOpen ? 0.65 : 0, 0.18]}
        scale={[1, blindsOpen ? 0.4 : 1, 1]}
        onClick={(event) => {
          event.stopPropagation();
          onBlinds?.();
        }}
      >
        <primitive object={blinds} />
      </group>
    </group>
  );
}

useGLTF.preload("/models/window-blinds.glb");
