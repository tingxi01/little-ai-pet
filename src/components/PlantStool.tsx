
import { useGLTF, useCursor } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

export default function PlantStool() {
  const { scene } = useGLTF("/models/plant-stool.glb");

  const [isOn, setIsOn] = useState(false);
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
    const scale = targetHeight / Math.max(size.y, 0.001);

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

  return (
    <group
      position={[-4.0, -1.4, 0.1]}
      scale={1.15}
      rotation={[0, 0.3, 0]}
      onClick={(event) => {
        event.stopPropagation();
        setIsOn((previous) => !previous);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Original mushroom lamp, stool, books and bunny */}
      <primitive object={model} />

      {/* Gentle warm light when switched on */}
      {isOn && (
        <pointLight
          position={[-0.35, 1.4, 0.35]}
          color="#FFE4B8"
          intensity={0.35}
          distance={1.8}
          decay={2}
          castShadow={false}
        />
      )}
    </group>
  );
}

useGLTF.preload("/models/plant-stool.glb");
