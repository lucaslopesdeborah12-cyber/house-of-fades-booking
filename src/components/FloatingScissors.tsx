import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

const FloatingScissors = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
  });

  const goldMaterial = (
    <meshStandardMaterial
      color="#C9A84C"
      metalness={0.9}
      roughness={0.15}
      emissive="#C9A84C"
      emissiveIntensity={0.05}
    />
  );

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <group ref={groupRef} scale={1.2}>
        {/* Blade 1 */}
        <mesh position={[0.3, 0.4, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.12, 1.8, 0.03]} />
          {goldMaterial}
        </mesh>
        {/* Blade 2 */}
        <mesh position={[-0.3, 0.4, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.12, 1.8, 0.03]} />
          {goldMaterial}
        </mesh>
        {/* Handle 1 */}
        <mesh position={[0.5, -0.8, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.08, 0.06, 0.8, 16]} />
          {goldMaterial}
        </mesh>
        {/* Handle 2 */}
        <mesh position={[-0.5, -0.8, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.08, 0.06, 0.8, 16]} />
          {goldMaterial}
        </mesh>
        {/* Pivot */}
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          {goldMaterial}
        </mesh>
        {/* Finger rings */}
        <mesh position={[0.6, -1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.04, 16, 32]} />
          {goldMaterial}
        </mesh>
        <mesh position={[-0.6, -1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.04, 16, 32]} />
          {goldMaterial}
        </mesh>
      </group>
    </Float>
  );
};

export default FloatingScissors;
