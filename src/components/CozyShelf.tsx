
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function CozyShelf() {
  const { scene } = useGLTF("/models/cozy-shelf.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // Center the model and place its base at ground level
    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());

    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    return cloned;
  }, [scene]);

  return (
    <group
      position={[5.5, -1.4, -0.3]}
      rotation={[0, -Math.PI / 2, 0]}
      scale={1.5}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/cozy-shelf.glb");
