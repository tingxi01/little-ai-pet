
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Sofa() {
  const { scene } = useGLTF("/models/sofa.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    // Calculate the sofa's original dimensions
    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());

    // Center the sofa and place it on the floor
    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        // Clone materials so we don't modify the original GLB
        const updatedMaterials = materials.map((original) => {
          const material = original.clone();

          if (material instanceof THREE.MeshStandardMaterial) {
            // Preserve Meshy's original texture colors
            material.color.set("#ffffff");
            material.emissive.set("#FFF5DE");
            material.emissiveIntensity = 0.3;

            // Soft, matte fabric and wood appearance
            material.roughness = 1;
            material.metalness = 0;

            // Remove additional emissive tint
            material.emissive.set("#000000");
            material.emissiveIntensity = 0;
          }

          return material;
        });

        object.material = Array.isArray(object.material)
          ? updatedMaterials
          : updatedMaterials[0];
      }
    });

    return cloned;
  }, [scene]);

  return (
    <group position={[0, -1.4, -1.5]} scale={2.5}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/sofa.glb");
