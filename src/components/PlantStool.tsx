
import { useGLTF, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Props = {
  isOn: boolean;
  onToggle: () => void;
};

export default function PlantStool({
  isOn,
  onToggle,
}: Props) {
  const { scene } = useGLTF("/models/plant-stool.glb");

  const lightRef = useRef<THREE.PointLight>(null);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    const targetHeight = 1.7;
    const scale =
      targetHeight / Math.max(size.y, 0.001);

    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    const wrapper = new THREE.Group();
    wrapper.add(cloned);
    wrapper.scale.setScalar(scale);

    return wrapper;
  }, [scene]);

  useFrame((_, delta) => {
    if (!lightRef.current) return;

    lightRef.current.intensity = THREE.MathUtils.damp(
      lightRef.current.intensity,
      isOn ? 0.65 : 0,
      5,
      delta
    );
  });

  return (
    <group
      position={[-4.0, -1.4, 0.1]}
      scale={1.15}
      rotation={[0, 0.3, 0]}
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
      {/* Original mushroom lamp, stool, books and bunny */}
      <primitive object={model} />

      {/* Smooth warm mushroom light */}
      <pointLight
        ref={lightRef}
        position={[-0.35, 1.4, 0.35]}
        color="#FFE4B8"
        intensity={0}
        distance={2.5}
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

useGLTF.preload("/models/plant-stool.glb");
