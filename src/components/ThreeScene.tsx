import * as THREE from 'three';
import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Caustics, Environment, Lightformer, RandomizedLight, PerformanceMonitor, AccumulativeShadows, MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';

function Scene(props: any) {
  return (
    <group {...props} dispose={null}>
      <group position={[1.2, 0, 0.2]} rotation={[0, -0.5, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[0.8, 0.6, 0.8]} /><meshStandardMaterial color="#ff6b6b" roughness={0.3} /></mesh>
        <mesh position={[0, 0.305, 0]}><boxGeometry args={[0.82, 0.05, 0.15]} /><meshStandardMaterial color="white" /></mesh>
        <mesh position={[0, 0.305, 0]}><boxGeometry args={[0.15, 0.05, 0.82]} /><meshStandardMaterial color="white" /></mesh>
      </group>
      <group position={[0, -0.5, 0]} rotation={[0, 0, 0.1]}>
         <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.02, 0.02, 1.2]} /><meshStandardMaterial color="#66bb6a" /></mesh>
         <mesh position={[0, 1.0, 0]}><dodecahedronGeometry args={[0.25]} /><meshStandardMaterial color="#f06292" /></mesh>
         <mesh position={[0, 1.0, 0.15]}><sphereGeometry args={[0.08]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      </group>
      <Caustics backside causticsOnly={false} color={[1, 0.8, 0.8]} lightSource={[-1.2, 3, -2]} intensity={0.005} worldRadius={0.1126 / 10} ior={0.91}>
        <mesh castShadow receiveShadow position={[0, 0.25, 0]}><cylinderGeometry args={[0.45, 0.35, 1.5, 32]} />
          <MeshTransmissionMaterial backside backsideThickness={0.1} thickness={0.05} chromaticAberration={0.05} anisotropicBlur={1} clearcoat={0.5} clearcoatRoughness={1} envMapIntensity={1.5} />
        </mesh>
      </Caustics>
    </group>
  );
}

function Env({ perfSucks }: { perfSucks: boolean }) {
  const ref = useRef<any>(null);
  useFrame((state, delta) => {
    if (!perfSucks && ref.current) {
      easing.damp3(ref.current.rotation, [Math.PI / 2, 0, state.clock.elapsedTime / 5 + state.pointer.x], 0.2, delta);
      easing.damp3(state.camera.position, [Math.sin(state.pointer.x / 4) * 9, 1.25 + state.pointer.y, Math.cos(state.pointer.x / 4) * 9], 0.5, delta);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return (
    <Environment frames={perfSucks ? 1 : Infinity} resolution={256} background blur={0.8}>
      <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
      <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
      <group rotation={[Math.PI / 2, 1, 0]}>
        {[2, -2, 2, -4, 2, -5, 2, -9].map((x, i) => (<Lightformer key={i} intensity={1} rotation={[Math.PI / 4, 0, 0]} position={[x, 4, i * 4]} scale={[4, 1, 1]} />))}
        <Lightformer intensity={0.5} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[50, 2, 1]} />
        <Lightformer intensity={0.5} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[50, 2, 1]} />
        <Lightformer intensity={0.5} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[50, 2, 1]} />
      </group>
      <group ref={ref}><Lightformer intensity={5} form="ring" color="red" rotation-y={Math.PI / 2} position={[-5, 2, -1]} scale={[10, 10, 1]} /></group>
    </Environment>
  );
}

export const ThreeScene = () => {
  const [perfSucks, degrade] = useState(false);
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas shadows dpr={[1, perfSucks ? 1.5 : 2]} camera={{ position: [20, 0.9, 20], fov: 26 }}>
        <PerformanceMonitor onDecline={() => degrade(true)} />
        <color attach="background" args={['#f3f4f6']} />
        <group position={[0, -0.5, 0]} rotation={[0, -0.75, 0]}><Scene /><AccumulativeShadows frames={100} alphaTest={0.85} opacity={0.8} color="red" scale={20} position={[0, -0.005, 0]}><RandomizedLight amount={8} radius={6} ambient={0.5} intensity={1} position={[-1.5, 2.5, -2.5]} bias={0.001} /></AccumulativeShadows></group>
        <Env perfSucks={perfSucks} /><ambientLight intensity={0.5} />
      </Canvas>
    </div>
  );
};