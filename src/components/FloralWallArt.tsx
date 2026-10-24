
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function FloralWallArt() {
  const { scene } = useGLTF("/models/floral-wall-art.glb");

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
      position={[-4.98, 2.1, -0.5]}
      rotation={[0, Math.PI / 2, 0]}
      scale={1}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/floral-wall-art.glb");
