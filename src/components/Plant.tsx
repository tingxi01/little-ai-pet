
import { useGLTF } from "@react-three/drei";

export default function Plant() {
  const { scene } = useGLTF("/models/plant.glb");

  return (
    <group
      position={[4.2, -0.22, -1.4]}
      rotation={[0, -0.15, 0]}
      scale={1.3}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/plant.glb");
