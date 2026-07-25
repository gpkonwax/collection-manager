import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';

interface Props {
  url: string;
  alt: string;
  isLandscape: boolean;
  isBack?: boolean;
  className?: string;
}

const MAX_TILT_RAD = (12 * Math.PI) / 180;
const EDGE_COLOR = '#f2ede4';
// Thickness relative to card width. Real trading cards are ~0.3mm on a 63mm
// card ≈ 0.5%. We exaggerate slightly so the edge is visible on tilt.
const DEPTH_RATIO = 0.025;

function CardMesh({
  textureUrl,
  isLandscape,
  isBack,
  pointer,
}: {
  textureUrl: string;
  isLandscape: boolean;
  isBack: boolean;
  pointer: React.MutableRefObject<{ x: number; y: number; active: boolean }>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glareRef = useRef<THREE.Mesh>(null);

  const texture = useLoader(THREE.TextureLoader, textureUrl);

  const { width, height, depth } = useMemo(() => {
    // Portrait card 3:4, landscape 4:3. Use unit width, scale height.
    const w = isLandscape ? 4 : 3;
    const h = isLandscape ? 3 : 4;
    // Normalize longest side to 4 so the card fills the canvas similarly
    const scale = 4 / Math.max(w, h);
    return { width: w * scale, height: h * scale, depth: (w * scale) * DEPTH_RATIO };
  }, [isLandscape]);

  const materials = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    // For a Series 1 landscape back the underlying image is portrait and
    // needs to be rotated 90° to read upright on our landscape geometry.
    if (isBack && isLandscape) {
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
    } else {
      texture.rotation = 0;
    }

    const edge = new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.9, metalness: 0 });
    const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.05 });
    const backFace = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 });
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
    return [edge, edge, edge, edge, face, backFace];
  }, [texture, isBack, isLandscape]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const target = pointer.current.active
      ? { x: -pointer.current.y * MAX_TILT_RAD, y: pointer.current.x * MAX_TILT_RAD }
      : { x: 0, y: 0 };
    // Critically-damped-ish lerp
    const k = Math.min(1, delta * 12);
    mesh.rotation.x += (target.x - mesh.rotation.x) * k;
    mesh.rotation.y += (target.y - mesh.rotation.y) * k;

    if (glareRef.current) {
      const gx = pointer.current.active ? pointer.current.x * (width / 2) : 0;
      const gy = pointer.current.active ? pointer.current.y * (height / 2) : 0;
      glareRef.current.position.set(gx, gy, depth / 2 + 0.002);
      const mat = glareRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pointer.current.active ? 0.18 : 0;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} material={materials}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      {/* Moving highlight — parented to the card group so it tilts with it */}
      <mesh ref={glareRef} raycast={() => null}>
        <circleGeometry args={[Math.min(width, height) * 0.55, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Card3DViewer({ url, alt, isLandscape, isBack = false, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });
  const [ready, setReady] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointer.current.x = Math.max(-1, Math.min(1, x));
    pointer.current.y = Math.max(-1, Math.min(1, y));
    pointer.current.active = true;
  };
  const onLeave = () => {
    pointer.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className || ''}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Fallback flat image while the 3D scene mounts / textures load */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <IpfsMedia url={url} alt={alt} className="w-full h-full" context="detail" showSkeleton />
        </div>
      )}
      <Canvas
        camera={{ position: [0, 0, 7], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        onCreated={() => setReady(true)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, -2, 2]} intensity={0.25} />
        <Suspense fallback={null}>
          <CardMesh textureUrl={url} isLandscape={isLandscape} isBack={isBack} pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}
