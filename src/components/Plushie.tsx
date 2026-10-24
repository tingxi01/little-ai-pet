
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Plushie() {
  const { scene } = useGLTF("/models/plushie.glb");

  const plushie = useMemo(() => {
    const clone = scene.clone(true);

    // Normalize the model so Meshy's original size
    // doesn't make the teddy enormous.
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());

    const targetHeight = 0.55;
    const scale = targetHeight / (size.y || 1);

    clone.scale.setScalar(scale);

    // Center the model and place its bottom at y = 0.
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());

    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= scaledBox.min.y;

    return clone;
  }, [scene]);

  return (
    <group
      position={[-1.43, -0.19, -1.15]}
      rotation={[0, 0.8, 0.12]}
      scale={1.5}
    >
      <primitive object={plushie} />
    </group>
  );
}

useGLTF.preload("/models/plushie.glb");
