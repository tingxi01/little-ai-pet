
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Carpet() {
  const { scene } = useGLTF("/models/carpet.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    // Calculate the model's original dimensions
    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());

    // Center the rug and place its bottom at Y = 0
    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    // Keep the original Meshy colors and textures
    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.receiveShadow = true;
        object.castShadow = false;
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group
      position={[0, -1.41, -0.3]}
      scale={3.7}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/carpet.glb");
