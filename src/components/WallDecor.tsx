
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function WallDecor() {
  const { scene } = useGLTF("/models/wall-decor.glb");

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

    cloned.position.set(
      -center.x,
      -center.y,
      -center.z
    );

    return cloned;
  }, [scene]);

  return (
    <group
      position={[5.9, 1.95, -1.6]}
      rotation={[0, -1.5, 0]}
      scale={1.65}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/wall-decor.glb");
