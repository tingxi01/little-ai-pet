
import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";

export default function InspectMochi() {
  const { scene } = useGLTF("/models/mochi.glb");

  useEffect(() => {
    console.log("🐰 MOCHI MODEL STRUCTURE");

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        console.log({
          name: object.name,
          type: object.type,
          geometry: object.geometry?.type,
          morphTargets:
            Object.keys(
              object.geometry?.morphAttributes ?? {}
            ),
        });
      }

      if (object instanceof THREE.Bone) {
        console.log("BONE:", object.name);
      }
    });
  }, [scene]);

  return null;
}
