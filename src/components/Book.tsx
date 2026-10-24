import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Book() {
  const { scene } = useGLTF("/models/books.glb");

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
      position={[1.4, -0.65, 2.0]}
      rotation={[0, -0.25, 0]}
      scale={0.3}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/books.glb");