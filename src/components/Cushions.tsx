
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// ---------------------------------------
// 3D Daisy pillow from Meshy
// ---------------------------------------

function DaisyCushion() {
  const { scene } = useGLTF("/models/daisy-pillow.glb");

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
        position={[-1.12, 0.2, -1.55]}
        rotation={[-0.12, 0, -0.2]}
        scale={0.48}
    >
        <primitive object={model} />
    </group>
    );
}

// ---------------------------------------
// Sage-green cushion
// ---------------------------------------

function GreenCushion() {
  const { scene } = useGLTF("/models/green-pillow.glb");

  return (
    <group
      position={[1.08, 0.2, -1.22]}
      rotation={[0, 0, 0.12]}
      scale={0.5}
    >
      <primitive object={scene} />
    </group>
  );
}

// ---------------------------------------
// Both cushions
// ---------------------------------------

export default function Cushions() {
  return (
    <group>
      <DaisyCushion />
      <GreenCushion />
    </group>
  );
}

useGLTF.preload("/models/daisy-pillow.glb");
useGLTF.preload("/models/green-pillow.glb");
