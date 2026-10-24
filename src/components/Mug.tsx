
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Mug() {
  const { scene } = useGLTF("/models/mug.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group
      position={[1.3, -0.57, 1.6]}
      rotation={[0, -0.25, 0]}
      scale={0.29}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/mug.glb");
