import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
export default function ClickableBlinds({ open, toggle, position = [0,1.6,-2.66], width = 3.2, height = 1.7 }: {
  open:boolean; toggle:()=>void; position?:[number,number,number]; width?:number; height?:number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_,dt) => { if (group.current) group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, open ? 0.06 : 1, 5, dt); });
  return <group position={position}>
    <group ref={group} position={[0,height/2,0]}>{Array.from({length:12},(_,i) => <mesh key={i} position={[0,height/2 - (i+0.5)*height/12,0]}><boxGeometry args={[width,height/14,0.035]}/><meshStandardMaterial color="#aebf9b" roughness={1}/></mesh>)}</group>
    <mesh onClick={e => {e.stopPropagation();toggle();}} onPointerOver={() => {document.body.style.cursor='pointer';}} onPointerOut={() => {document.body.style.cursor='auto';}}><planeGeometry args={[width,height]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  </group>;
}
