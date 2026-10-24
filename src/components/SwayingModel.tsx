import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
export default function SwayingModel({children, position=[0,0,0], speed=0.55, amount=0.014}:{children:React.ReactNode;position?:[number,number,number];speed?:number;amount?:number}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(ref.current){ref.current.rotation.z=Math.sin(clock.elapsedTime*speed)*amount;ref.current.rotation.x=Math.cos(clock.elapsedTime*speed*.75)*amount*.6;}});
  return <group position={position}><group ref={ref}>{children}</group></group>;
}
