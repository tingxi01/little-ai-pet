
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Bookshelve() {
  const { scene } = useGLTF("/models/bookshelves.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;

        // Keep all original Meshy textures and colors
        // while improving shadow rendering.
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        const updatedMaterials = materials.map((original) => {
          const material = original.clone();

          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = 1;
            material.metalness = 0;
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

  // Soft shadow texture for contact shading
  const shadowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    const gradient = ctx.createRadialGradient(
      64, 64, 5,
      64, 64, 64
    );

    gradient.addColorStop(0, "rgba(70,45,30,0.32)");
    gradient.addColorStop(0.5, "rgba(70,45,30,0.14)");
    gradient.addColorStop(1, "rgba(70,45,30,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <group
      position={[4.5, 2.65, -2.55]}
      rotation={[0, 0, 0]}
      scale={1.3}
    >
      {/* Original bookshelf model */}
      <primitive object={model} />

      {/* Subtle contact shadows */}
      {shadowTexture &&
        [-1.2, -0.45, 0.3, 1.05].map((y, index) => (
          <mesh
            key={index}
            position={[0, y, 0.12]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={1}
          >
            <planeGeometry args={[2.8, 1.15]} />
            <meshBasicMaterial
              map={shadowTexture}
              transparent
              opacity={0.38}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        ))}
    </group>
  );
}

useGLTF.preload("/models/bookshelves.glb");
