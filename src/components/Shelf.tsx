
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Shelf() {
  const { scene } = useGLTF("/models/shelf-left.glb");

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
      position={[-3.5, 1.1, -2.1]}
      rotation={[0, 0, 0]}
      scale={2.67}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/shelf-left.glb");
