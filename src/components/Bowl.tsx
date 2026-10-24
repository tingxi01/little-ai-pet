
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Bowl() {
  const { scene } = useGLTF("/models/bowl.glb");

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
      position={[0.78, -0.57, 1.13]}
      rotation={[0, -0.2, 0]}
      scale={0.38}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/bowl.glb");
