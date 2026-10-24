
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

// Your 105 manually selected leaf islands
const LEAF_IDS = new Set<number>([
  0, 1, 2, 3, 4, 7, 9, 11, 12, 13,
  17, 18, 19, 21, 22, 24, 26, 28, 31, 33,
  36, 38, 39, 40, 45, 46, 52, 59, 60, 67,
  69, 72, 77, 81, 87, 95, 96, 97, 103, 104,
  105, 107, 109, 113, 116, 121, 124, 151, 162, 185,
  193, 194, 204, 208, 226, 228, 233, 236, 263, 264,
  266, 280, 284, 287, 295, 296, 306, 309, 317, 320,
  321, 322, 325, 326, 329, 331, 333, 334, 335, 336,
  338, 340, 343, 344, 345, 347, 350, 351, 368, 374,
  375, 390, 406, 411, 416, 438, 458, 479, 482, 534,
  540, 542, 554, 566, 628,
]);

const WIND_STRENGTH = 0.065;
const WIND_SPEED = 1.8;

type LeafPiece = {
  indices: number[];
  pivot: THREE.Vector3;
  phase: number;
};

type AnimatedMesh = {
  geometry: THREE.BufferGeometry;
  original: Float32Array;
  pieces: LeafPiece[];
};

export default function PlantBooks() {
  const { scene } = useGLTF("/models/plant-books.glb");

  const { model, animatedMeshes } = useMemo(() => {
    const cloned = scene.clone(true);
    const animatedMeshes: AnimatedMesh[] = [];

    // Find the combined mesh
    const mesh = cloned.getObjectByProperty(
      "type",
      "Mesh"
    ) as THREE.Mesh | undefined;

    if (mesh) {
      // Clone geometry so the cached GLB remains untouched
      const geometry = mesh.geometry.clone();
      mesh.geometry = geometry;

      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();

      const vertexCount = positions.count;
      const parent = new Int32Array(vertexCount);

      for (let i = 0; i < vertexCount; i++) {
        parent[i] = i;
      }

      function find(x: number): number {
        while (parent[x] !== x) {
          parent[x] = parent[parent[x]];
          x = parent[x];
        }
        return x;
      }

      function union(a: number, b: number) {
        const ra = find(a);
        const rb = find(b);

        if (ra !== rb) {
          parent[rb] = ra;
        }
      }

      const triangleCount = Math.floor(
        (index ? index.count : vertexCount) / 3
      );

      // Same island detection order as PlantInspector
      for (let t = 0; t < triangleCount; t++) {
        const a = index
          ? index.getX(t * 3)
          : t * 3;

        const b = index
          ? index.getX(t * 3 + 1)
          : t * 3 + 1;

        const c = index
          ? index.getX(t * 3 + 2)
          : t * 3 + 2;

        union(a, b);
        union(b, c);
      }

      const roots = new Map<number, number>();
      const piecesById = new Map<number, number[]>();

      for (let t = 0; t < triangleCount; t++) {
        const vertex = index
          ? index.getX(t * 3)
          : t * 3;

        const root = find(vertex);

        if (!roots.has(root)) {
          roots.set(root, roots.size);
        }

        const islandId = roots.get(root)!;

        if (!LEAF_IDS.has(islandId)) continue;

        if (!piecesById.has(islandId)) {
          piecesById.set(islandId, []);
        }

        const vertices = piecesById.get(islandId)!;

        for (let corner = 0; corner < 3; corner++) {
          const vertexIndex = index
            ? index.getX(t * 3 + corner)
            : t * 3 + corner;

          vertices.push(vertexIndex);
        }
      }

      const original = new Float32Array(
        positions.array as ArrayLike<number>
      );

      const pieces: LeafPiece[] = [];

      piecesById.forEach((indices, id) => {
        const uniqueIndices = [...new Set(indices)];

        const bounds = new THREE.Box3();
        const vertex = new THREE.Vector3();

        for (const i of uniqueIndices) {
          vertex.set(
            original[i * 3],
            original[i * 3 + 1],
            original[i * 3 + 2]
          );

          bounds.expandByPoint(vertex);
        }

        // Approximate the attachment point at the bottom
        const pivot = bounds.getCenter(
          new THREE.Vector3()
        );

        pivot.y = bounds.min.y;

        pieces.push({
          indices: uniqueIndices,
          pivot,
          phase: id * 0.37,
        });
      });

      animatedMeshes.push({
        geometry,
        original,
        pieces,
      });

      console.log(
        `🌿 Ready to animate ${pieces.length} leaf islands`
      );
    }

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // Preserve your original positioning
    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());

    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    return { model: cloned, animatedMeshes };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    for (const { geometry, original, pieces } of animatedMeshes) {
      const position = geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;

      for (const piece of pieces) {
        const angle =
          Math.sin(t * WIND_SPEED + piece.phase) *
          WIND_STRENGTH;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        for (const i of piece.indices) {
          const offset = i * 3;

          const x = original[offset] - piece.pivot.x;
          const y = original[offset + 1] - piece.pivot.y;
          const z = original[offset + 2] - piece.pivot.z;

          // Rotate the complete island around its pivot
          position.setXYZ(
            i,
            piece.pivot.x + x * cos - y * sin,
            piece.pivot.y + x * sin + y * cos,
            piece.pivot.z + z
          );
        }
      }

      position.needsUpdate = true;
    }
  });

  return (
    <group
      position={[1.6, -0.76, 0.7]}
      rotation={[0, -0.5, 0]}
      scale={0.75}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/plant-books.glb");
