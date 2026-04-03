import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GoldParticles = ({ count = 60 }) => {
  const mesh = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += delta * 0.3;
      if (pos[i * 3 + 1] > 5) {
        pos[i * 3 + 1] = -5;
        pos[i * 3] = (Math.random() - 0.5) * 10;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#C9A84C" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

export default GoldParticles;
