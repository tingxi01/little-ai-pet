
import { Html, useGLTF } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";

const STORAGE_KEY = "little-ai-pet-plant-leaf-ids";

type Island = {
  id: number;
  triangleIndices: number[];
};

export default function PlantInspector() {
  const { scene } = useGLTF("/models/plant-books.glb");

  const [selected, setSelected] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);

      if (
        Array.isArray(parsed) &&
        parsed.every(
          (value) =>
            typeof value === "number" &&
            Number.isInteger(value)
        )
      ) {
        return parsed;
      }
    } catch {
      // Ignore invalid saved data
    }

    return [];
  });

  // Automatically save selections after every click.
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(selected)
    );
  }, [selected]);

  const { model, triangleToIsland, islands, mesh } =
    useMemo(() => {
      const cloned = scene.clone(true);

      const mesh = cloned.getObjectByProperty(
        "type",
        "Mesh"
      ) as THREE.Mesh | undefined;

      if (!mesh) {
        return {
          model: cloned,
          mesh: undefined,
          triangleToIsland: new Int32Array(0),
          islands: [] as Island[],
        };
      }

      const geometry = mesh.geometry;
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
      const triangleToIsland = new Int32Array(triangleCount);
      const islandMap = new Map<number, number[]>();

      for (let t = 0; t < triangleCount; t++) {
        const vertex = index
          ? index.getX(t * 3)
          : t * 3;

        const root = find(vertex);

        if (!roots.has(root)) {
          roots.set(root, roots.size);
        }

        const islandId = roots.get(root)!;
        triangleToIsland[t] = islandId;

        if (!islandMap.has(islandId)) {
          islandMap.set(islandId, []);
        }

        islandMap.get(islandId)!.push(t);
      }

      const islands: Island[] = Array.from(
        islandMap.entries()
      ).map(([id, triangleIndices]) => ({
        id,
        triangleIndices,
      }));

      console.log(
        "🌿 Geometry islands found:",
        islands.length
      );

      cloned.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      const bounds = new THREE.Box3().setFromObject(cloned);
      const center = bounds.getCenter(new THREE.Vector3());

      cloned.position.set(
        -center.x,
        -bounds.min.y,
        -center.z
      );

      return {
        model: cloned,
        mesh,
        triangleToIsland,
        islands,
      };
    }, [scene]);

  // Build pink highlights for selected pieces.
  const highlights = useMemo(() => {
    if (!mesh || selected.length === 0) return [];

    const geometry = mesh.geometry;
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();

    return selected
      .map((islandId) => {
        const island = islands.find(
          (item) => item.id === islandId
        );

        if (!island) return null;

        const vertices: number[] = [];

        for (const triangle of island.triangleIndices) {
          for (let corner = 0; corner < 3; corner++) {
            const vertexIndex = index
              ? index.getX(triangle * 3 + corner)
              : triangle * 3 + corner;

            vertices.push(
              positions.getX(vertexIndex),
              positions.getY(vertexIndex),
              positions.getZ(vertexIndex)
            );
          }
        }

        const highlightGeometry = new THREE.BufferGeometry();

        highlightGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            vertices,
            3
          )
        );

        highlightGeometry.computeVertexNormals();

        return {
          id: islandId,
          geometry: highlightGeometry,
        };
      })
      .filter(
        (item): item is {
          id: number;
          geometry: THREE.BufferGeometry;
        } => item !== null
      );
  }, [selected, mesh, islands]);

  // Export currently selected leaf IDs.
  const saveSelectedLeaves = () => {
    const ids = [...selected].sort((a, b) => a - b);
    const output = JSON.stringify(ids);

    localStorage.setItem(STORAGE_KEY, output);

    console.log("🌿 SAVED LEAF IDS:", output);

    navigator.clipboard
      .writeText(output)
      .then(() => {
        window.alert(
          `Saved ${ids.length} leaf islands! 🌿\n\nIDs copied to clipboard.`
        );
      })
      .catch(() => {
        window.prompt(
          "Copy your leaf IDs:",
          output
        );
      });
  };

  const handleClick = (event: {
    stopPropagation: () => void;
    faceIndex?: number;
  }) => {
    event.stopPropagation();

    if (event.faceIndex === undefined) return;

    const islandId = triangleToIsland[event.faceIndex];

    if (islandId === undefined) return;

    setSelected((previous) =>
      previous.includes(islandId)
        ? previous.filter(
            (id) => id !== islandId
          )
        : [...previous, islandId]
    );

    console.log(
      "🌿 Clicked island:",
      islandId
    );
  };

  return (
    <group
      position={[1.6, -0.76, 0.7]}
      rotation={[0, -0.5, 0]}
      scale={0.75}
    >
      {/* Save button above the plant */}
      <Html
        position={[0, 1.9, 0]}
        center
        style={{
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={(event) => {
            event.stopPropagation();
            saveSelectedLeaves();
          }}
          style={{
            background: "#fff2dc",
            color: "#694b36",
            border: "2px solid #d5b08e",
            borderRadius: "14px",
            padding: "12px 18px",
            fontSize: "14px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            cursor: "pointer",
            boxShadow: "0 4px 14px #0002",
          }}
        >
          🌿 Save Selected Leaves ({selected.length})
        </button>
      </Html>

      {/* Original model */}
      <primitive
        object={model}
        onClick={handleClick}
      />

      {/* Pink selected leaf highlights */}
      {highlights.map(({ id, geometry }) => (
        <mesh
          key={id}
          geometry={geometry}
          position={model.position}
          onClick={(event) => {
            event.stopPropagation();

            setSelected((previous) =>
              previous.filter(
                (item) => item !== id
              )
            );
          }}
        >
          <meshBasicMaterial
            color="#ff00ff"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload("/models/plant-books.glb");
