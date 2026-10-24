export default function ClickableLight({ position, on, onToggle, color = '#ffcf95', intensity = 2.4, distance = 5, radius = 0.5 }: {
  position: [number,number,number]; on: boolean; onToggle: () => void; color?: string; intensity?: number; distance?: number; radius?: number;
}) {
  return <group position={position}>
    {on && <><pointLight color={color} intensity={intensity} distance={distance} decay={2} /><mesh><sphereGeometry args={[radius,16,16]} /><meshBasicMaterial color={color} transparent opacity={0.09} depthWrite={false} /></mesh></>}
    <mesh onClick={e => {e.stopPropagation();onToggle();}} onPointerOver={() => {document.body.style.cursor='pointer';}} onPointerOut={() => {document.body.style.cursor='auto';}}><sphereGeometry args={[radius,16,16]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>;
}
