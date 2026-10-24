import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
export default function CozyEffects() {
  const particles = useRef<THREE.Group>(null);
  const positions = [[-3, 1.2, -1.7], [-2.5, 2.1, -2], [2.2, 1.3, -2.2], [0.7, 2.5, -2.1], [-1.5, 0.4, 0.5]];
  useFrame(({ clock }) => { if (particles.current) { particles.current.children.forEach((child, i) => { child.position.y = positions[i][1] + Math.sin(clock.elapsedTime * 0.55 + i * 1.8) * 0.12; child.position.x = positions[i][0] + Math.cos(clock.elapsedTime * 0.3 + i) * 0.08; }); } });
  return <group ref={particles}>{positions.map((p, i) => <mesh key={i} position={p as [number,number,number]}><sphereGeometry args={[0.014,8,8]} /><meshBasicMaterial color="#fff6dc" transparent opacity={0.55} depthWrite={false} /></mesh>)}</group>;
}
