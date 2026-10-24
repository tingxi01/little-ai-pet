
import { useGLTF, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PetAction } from "../lib/pet";

type Props = {
  onPet: () => void;
  lastAction: PetAction | null;
  actionId: number;
};

const BASE_Y = -0.22;
const BASE_SCALE = 1.5;
const DURATION = 2.5;

export default function MochiAnimated({
  onPet,
  lastAction,
  actionId,
}: Props) {
  const { scene } = useGLTF("/models/mochi.glb");

  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useCursor(hovered);

  const animationStart = useRef(0);
  const previousActionId = useRef(actionId);
  const sleeping = useRef(false);

  const { model, centerX, bottomY, centerZ } = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());

    return {
      model: cloned,
      centerX: center.x,
      bottomY: box.min.y,
      centerZ: center.z,
    };
  }, [scene]);

  useFrame(({ clock }, dt) => {
    if (!group.current) return;

    const t = clock.elapsedTime;
    const g = group.current;

    // Detect EVERY action, even repeated actions
    if (actionId !== previousActionId.current) {
      previousActionId.current = actionId;
      animationStart.current = t;

      if (lastAction === "sleep") {
        sleeping.current = !sleeping.current;
      } else {
        sleeping.current = false;
      }
    }

    const a = t - animationStart.current;
    const active = actionId > 0 && a < DURATION;
    const fade = active
      ? Math.min(1, (DURATION - a) * 2)
      : 0;

    let y = BASE_Y;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    let sx = BASE_SCALE;
    let sy = BASE_SCALE;
    let sz = BASE_SCALE;

    if (sleeping.current) {
      // Slow sleepy breathing
      const breath = Math.sin(t * 1.1);

      sy += breath * 0.015;
      sx -= breath * 0.005;
      rx = 0.1;
      rz = Math.sin(t * 0.4) * 0.015;
    } else {
      // Normal idle animation
      const breath = Math.sin(t * 2);

      sy += breath * 0.012;
      sx -= breath * 0.005;

      rz = Math.sin(t * 0.8) * 0.015;
      ry = Math.sin(t * 0.55) * 0.025;
      y += Math.sin(t * 2) * 0.006;

      if (active) {
        switch (lastAction) {
          case "pet": {
            const pulse =
              Math.abs(Math.sin(a * 11)) * fade;

            sy -= pulse * 0.12;
            sx += pulse * 0.08;
            sz += pulse * 0.06;

            rz += Math.sin(a * 14) * 0.1 * fade;
            y += Math.abs(Math.sin(a * 7)) * 0.03 * fade;
            break;
          }

          case "play": {
            const hop =
              Math.pow(Math.abs(Math.sin(a * 5)), 2) *
              0.2 *
              fade;

            y += hop;
            rz += Math.sin(a * 7) * 0.1 * fade;

            sy += hop * 0.4;
            sx -= hop * 0.15;
            break;
          }

          case "feed": {
            rx += 0.17 * fade;
            sy += Math.sin(a * 16) * 0.025 * fade;
            y += Math.sin(a * 5) * 0.015 * fade;
            break;
          }

          default:
            break;
        }
      }
    }

    const damp = 10;
    const delta = Math.min(dt, 0.05);

    g.position.y = THREE.MathUtils.damp(
      g.position.y,
      y,
      damp,
      delta
    );

    g.rotation.x = THREE.MathUtils.damp(
      g.rotation.x,
      rx,
      damp,
      delta
    );

    g.rotation.y = THREE.MathUtils.damp(
      g.rotation.y,
      ry,
      damp,
      delta
    );

    g.rotation.z = THREE.MathUtils.damp(
      g.rotation.z,
      rz,
      damp,
      delta
    );

    g.scale.x = THREE.MathUtils.damp(
      g.scale.x,
      sx,
      damp,
      delta
    );

    g.scale.y = THREE.MathUtils.damp(
      g.scale.y,
      sy,
      damp,
      delta
    );

    g.scale.z = THREE.MathUtils.damp(
      g.scale.z,
      sz,
      damp,
      delta
    );
  });

  return (
    <group
      ref={group}
      position={[0, BASE_Y, -1.35]}
      scale={BASE_SCALE}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        onPet();
      }}
    >
      <primitive
        object={model}
        position={[-centerX, -bottomY, -centerZ]}
      />
    </group>
  );
}

useGLTF.preload("/models/mochi.glb");
