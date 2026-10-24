
import { useGLTF } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

export default function Lamp() {
  const { scene } = useGLTF("/models/bear-lamp.glb");

  const [isOn, setIsOn] = useState(false);

  const model = useMemo(() => {
    const clone = scene.clone(true);

    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());

    clone.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  return (
    <group
      position={[2.75, -1.5, -1.65]}
      rotation={[0, 0, 0]}
      scale={2.25}
      onClick={(event) => {
        event.stopPropagation();
        setIsOn((previous) => !previous);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Original Meshy lamp */}
      <primitive object={model} />

      {/* Soft warm lamp lighting */}
      {isOn && (
        <>
          {/* Gentle light near the lampshade */}
          <pointLight
            position={[-0.15, 1.15, 0.15]}
            color="#FFD6A0"
            intensity={2.5}
            distance={3.5}
            decay={2}
          />

          {/* Subtle warm light on nearby furniture */}
          <pointLight
            position={[-0.35, 0.85, 0.5]}
            color="#FFE5C5"
            intensity={0.8}
            distance={3}
            decay={2}
          />
        </>
      )}
    </group>
  );
}

useGLTF.preload("/models/bear-lamp.glb");
