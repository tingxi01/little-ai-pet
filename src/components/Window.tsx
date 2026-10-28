
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { TimeOfDay } from "../lib/pet";
import WindowScenery from "./WindowScenery";

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

  const blindsRef = useRef<THREE.Group>(null);

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

  useFrame((_, delta) => {
    if (!blindsRef.current) return;

    const smoothing = 1 - Math.exp(-delta * 3.5);

    blindsRef.current.position.y = THREE.MathUtils.lerp(
      blindsRef.current.position.y,
      blindsOpen ? 0.65 : 0,
      smoothing
    );

    blindsRef.current.scale.y = THREE.MathUtils.lerp(
      blindsRef.current.scale.y,
      blindsOpen ? 0.4 : 1,
      smoothing
    );
  });

  return (
    <group position={[0, 2.35, -2.85]}>
      {/* Outdoor garden behind the blinds */}
      <WindowScenery timeOfDay={timeOfDay} />

      {/* Original wooden window frame */}
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

      {/* Clickable animated blinds */}
      <group
        ref={blindsRef}
        position={[0, 0, 0.18]}
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
