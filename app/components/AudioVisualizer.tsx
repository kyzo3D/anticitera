import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

const AnimatedSphere = ({ isActive }) => {
  const meshRef = useRef()

  useFrame((state, delta) => {
    if (isActive && meshRef.current) {
      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, 1.2, 0.1)
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, 1.2, 0.1)
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, 1.2, 0.1)
    } else if (meshRef.current) {
      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, 1, 0.1)
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, 1, 0.1)
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, 1, 0.1)
    }
  })

  return (
    <Sphere ref={meshRef} args={[10, 64, 64]}>
      <meshPhongMaterial color={isActive ? "#00ff00" : "#0000ff"} opacity={0.6} transparent />
    </Sphere>
  )
}

const AudioVisualizer = ({ isActive }) => {
  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <AnimatedSphere isActive={isActive} />
    </Canvas>
  )
}

export default AudioVisualizer
