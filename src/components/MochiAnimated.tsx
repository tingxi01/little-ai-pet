
import { useGLTF, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PetAction } from "../lib/pet";
import Carrot from "./Carrot";

type Props = {
  onPet: () => void;
  lastAction: PetAction | null;
  actionId: number;
};

type IdleBehavior =
  | "rest"
  | "curious"
  | "look-left"
  | "look-right"
  | "wiggle"
  | "stretch";

const BASE_Y = -0.22;
const BASE_SCALE = 1.5;
const DURATION = 2.5;

const TEST_SLEEP_EYES = false;

const SLEEP_EYES = {
  left: {
    x: -0.25,
    y: -0.073,
    z: 0.34,
  },

  right: {
    x: 0.075,
    y: -0.168,
    z: 0.348,
  },

  rotation: -0.3,
  width: 0.095,
  curve: 0.018,
  thickness: 0.006,
  coverWidth: 0.11,
  coverHeight: 0.13,
  coverColor: "#E8D3BD",
  lineColor: "#302019",
};

// Carrot coordinates in original GLB model space.
// These may need adjustment to match Mochi's mouth.
const CARROT_SETTINGS = {
  start: {
    x: 0.17,
    y: -0.42,
    z: 0.62,
  },

  mouth: {
    x: -0.09,
    y: -0.26,
    z: 0.43,
  },

  rotation: -0.5,
  size: 1,
};

// ==========================================
// CLOSED EYE
// ==========================================

function ClosedEye({
  x,
  y,
  z,
}: {
  x: number;
  y: number;
  z: number;
}) {
  const curveGeometry = useMemo(() => {
    const half = SLEEP_EYES.width / 2;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-half, 0, 0),
      new THREE.Vector3(
        0,
        -SLEEP_EYES.curve,
        0
      ),
      new THREE.Vector3(half, 0, 0)
    );

    return new THREE.TubeGeometry(
      curve,
      20,
      SLEEP_EYES.thickness,
      6,
      false
    );
  }, []);

  return (
    <group
      position={[x, y, z]}
      rotation={[0, 0, SLEEP_EYES.rotation]}
    >
      <mesh
        scale={[
          SLEEP_EYES.coverWidth / 2,
          SLEEP_EYES.coverHeight / 2,
          0.008,
        ]}
      >
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial
          color={SLEEP_EYES.coverColor}
          roughness={1}
        />
      </mesh>

      <mesh
        geometry={curveGeometry}
        position={[0, 0, 0.015]}
      >
        <meshBasicMaterial
          color={SLEEP_EYES.lineColor}
        />
      </mesh>
    </group>
  );
}

// ==========================================
// MAIN MOCHI COMPONENT
// ==========================================

export default function MochiAnimated({
  onPet,
  lastAction,
  actionId,
}: Props) {
  const { scene } = useGLTF("/models/mochi.glb");

  const mochiRef = useRef<THREE.Group>(null);
  const sleepEyesRef = useRef<THREE.Group>(null);
  const carrotRef = useRef<THREE.Group>(null);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const animationStart = useRef(0);
  const previousActionId = useRef(actionId);
  const sleeping = useRef(false);

  const idleBehavior = useRef<IdleBehavior>("rest");
  const idleStart = useRef(0);
  const idleDuration = useRef(0);
  const nextIdleTime = useRef(4);

  // ==========================================
  // LOAD ORIGINAL MOCHI
  // ==========================================

  const { model, centerX, bottomY, centerZ } = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = true;
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

  // ==========================================
  // ANIMATION LOOP
  // ==========================================

  useFrame(({ clock }, dt) => {
    const g = mochiRef.current;

    if (!g) return;

    const t = clock.elapsedTime;

    // Detect new button interactions
    if (actionId !== previousActionId.current) {
      previousActionId.current = actionId;
      animationStart.current = t;

      idleBehavior.current = "rest";
      nextIdleTime.current = t + 4 + Math.random() * 3;

      if (lastAction === "sleep") {
        sleeping.current = !sleeping.current;
      } else {
        sleeping.current = false;
      }
    }

    // ==========================================
    // SLEEPING EYES
    // ==========================================

    if (sleepEyesRef.current) {
      sleepEyesRef.current.visible =
        TEST_SLEEP_EYES || sleeping.current;
    }

    const a = t - animationStart.current;

    const active =
      actionId > 0 &&
      a >= 0 &&
      a < DURATION;

    const fade = active
      ? Math.min(1, (DURATION - a) * 2)
      : 0;

    // ==========================================
    // CARROT ANIMATION
    // ==========================================

    if (carrotRef.current) {
      const carrot = carrotRef.current;

      const feeding =
        active && lastAction === "feed";

      carrot.visible = feeding;

      if (feeding) {
        // 0–0.7s: carrot approaches mouth
        const approach = THREE.MathUtils.smoothstep(
          a,
          0,
          0.7
        );

        carrot.position.set(
          THREE.MathUtils.lerp(
            CARROT_SETTINGS.start.x,
            CARROT_SETTINGS.mouth.x,
            approach
          ),
          THREE.MathUtils.lerp(
            CARROT_SETTINGS.start.y,
            CARROT_SETTINGS.mouth.y,
            approach
          ),
          THREE.MathUtils.lerp(
            CARROT_SETTINGS.start.z,
            CARROT_SETTINGS.mouth.z,
            approach
          )
        );

        // 0.7–2.2s: bite-by-bite shrinking
        let remaining = 1;

        if (a >= 0.7) remaining = 0.8;
        if (a >= 1.1) remaining = 0.6;
        if (a >= 1.5) remaining = 0.35;
        if (a >= 1.9) remaining = 0.15;
        if (a >= 2.2) remaining = 0;

        const chomp =
          a >= 0.7 && a < 2.2
            ? 1 + Math.sin(a * 28) * 0.045
            : 1;

        const scale =
          CARROT_SETTINGS.size * remaining;

        carrot.scale.set(
          scale * chomp,
          scale,
          scale * chomp
        );

        carrot.rotation.z =
          CARROT_SETTINGS.rotation +
          (a >= 0.7
            ? Math.sin(a * 18) * 0.06
            : 0);
      }
    }

    // ==========================================
    // BODY ANIMATION
    // ==========================================

    let y = BASE_Y;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    let sx = BASE_SCALE;
    let sy = BASE_SCALE;
    let sz = BASE_SCALE;

    if (sleeping.current) {
      const breath = Math.sin(t * 1.1);

      sy += breath * 0.015;
      sx -= breath * 0.005;

      rx = 0.1;
      rz = Math.sin(t * 0.4) * 0.015;
    } else {
      const breath = Math.sin(t * 2);

      sy += breath * 0.012;
      sx -= breath * 0.005;

      rz = Math.sin(t * 0.8) * 0.012;
      ry = Math.sin(t * 0.55) * 0.018;
      y += Math.sin(t * 2) * 0.006;

      // ==========================================
      // IDLE ANIMATIONS
      // ==========================================

      if (!active && t >= nextIdleTime.current) {
        const behaviors: IdleBehavior[] = [
          "curious",
          "look-left",
          "look-right",
          "wiggle",
          "stretch",
        ];

        idleBehavior.current =
          behaviors[
            Math.floor(Math.random() * behaviors.length)
          ];

        idleStart.current = t;

        idleDuration.current =
          1.5 + Math.random() * 1.5;

        nextIdleTime.current =
          t +
          idleDuration.current +
          4 +
          Math.random() * 5;
      }

      const idleElapsed = t - idleStart.current;

      const idleProgress =
        idleDuration.current > 0
          ? idleElapsed / idleDuration.current
          : 1;

      const idleWeight =
        idleProgress >= 0 && idleProgress <= 1
          ? Math.sin(idleProgress * Math.PI) ** 2
          : 0;

      if (!active && idleWeight > 0) {
        switch (idleBehavior.current) {
          case "curious":
            rz += 0.09 * idleWeight;
            ry += 0.055 * idleWeight;
            break;

          case "look-left":
            ry += 0.14 * idleWeight;
            rz += 0.025 * idleWeight;
            break;

          case "look-right":
            ry -= 0.14 * idleWeight;
            rz -= 0.025 * idleWeight;
            break;

          case "wiggle":
            rz +=
              Math.sin(idleElapsed * 11) *
              0.045 *
              idleWeight;

            y +=
              Math.abs(Math.sin(idleElapsed * 8)) *
              0.014 *
              idleWeight;
            break;

          case "stretch":
            sy += 0.065 * idleWeight;
            sx -= 0.025 * idleWeight;
            rx -= 0.045 * idleWeight;
            y += 0.015 * idleWeight;
            break;
        }
      }

      // ==========================================
      // BUTTON ANIMATIONS
      // ==========================================

      if (active) {
        switch (lastAction) {
          case "pet": {
            const pulse =
              Math.abs(Math.sin(a * 11)) * fade;

            sy -= pulse * 0.12;
            sx += pulse * 0.08;
            sz += pulse * 0.06;

            rz += Math.sin(a * 14) * 0.1 * fade;

            y +=
              Math.abs(Math.sin(a * 7)) *
              0.03 *
              fade;
            break;
          }

          case "play": {
            const hop =
              Math.pow(
                Math.abs(Math.sin(a * 5)),
                2
              ) *
              0.2 *
              fade;

            y += hop;
            rz += Math.sin(a * 7) * 0.1 * fade;

            sy += hop * 0.4;
            sx -= hop * 0.15;
            break;
          }

          case "feed": {
            // Gentle chewing movement
            rx += 0.12 * fade;

            sy +=
              Math.sin(a * 18) *
              0.022 *
              fade;

            y +=
              Math.sin(a * 10) *
              0.012 *
              fade;
            break;
          }
        }
      }
    }

    // ==========================================
    // APPLY TRANSFORMS TO MOCHI ONLY
    // ==========================================

    const damp = 8;
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

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <group>
      {/* ======================================
          MOCHI — ORIGINAL MODEL
      ====================================== */}

      <group
        ref={mochiRef}
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
          position={[
            -centerX,
            -bottomY,
            -centerZ,
          ]}
        />

        <group
          ref={sleepEyesRef}
          visible={TEST_SLEEP_EYES}
          position={[
            -centerX,
            -bottomY,
            -centerZ,
          ]}
        >
          <ClosedEye {...SLEEP_EYES.left} />
          <ClosedEye {...SLEEP_EYES.right} />
        </group>
      </group>

      {/* ======================================
          CARROT — SEPARATE FROM MOCHI
      ====================================== */}

      <group
        position={[0, BASE_Y, -1.35]}
        scale={BASE_SCALE}
      >
        <group
          position={[
            -centerX,
            -bottomY,
            -centerZ,
          ]}
        >
          <group
            ref={carrotRef}
            visible={false}
            position={[
              CARROT_SETTINGS.start.x,
              CARROT_SETTINGS.start.y,
              CARROT_SETTINGS.start.z,
            ]}
          >
            <Carrot />
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/models/mochi.glb");
