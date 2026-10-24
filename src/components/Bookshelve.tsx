
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Bookshelve() {
  const { scene } = useGLTF("/models/bookshelves.glb");

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
      position={[4.5, 2.65, -2.55]}
      rotation={[0, 0, 0]}
      scale={1.3}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/bookshelves.glb");
