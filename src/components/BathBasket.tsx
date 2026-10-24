
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function BathBasket() {
  const { scene } = useGLTF("/models/bath-basket.glb");

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
      position={[-1.8, -1, 0.55]}
      rotation={[0, 0, 0]}
      scale={0.65}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/bath-basket.glb");
