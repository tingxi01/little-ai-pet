
import { useGLTF } from "@react-three/drei";

export default function WoodenTable() {
  const { scene } = useGLTF("/models/wooden-table.glb");

  return (
    <group
      position={[1.35, -1.10, 1.15]}
      rotation={[0, -0.25, 0]}
      scale={1.15}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/wooden-table.glb");
