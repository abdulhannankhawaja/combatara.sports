import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildShowroomPlinth, buildSceneSubject, ProceduralBuildResult } from '../three/productModels.ts';
import { DiscoveredLead, ProductFinishOption, SceneSubjectId } from '../types/exportHub.ts';

export type CameraPresetId = 'hero' | 'detail' | 'top';

interface ShowroomCanvasProps {
  subjectId: SceneSubjectId;
  finish: ProductFinishOption;
  explodeAmount: number;
  cameraPreset: CameraPresetId;
  cameraPresetTrigger: number;
  leads: DiscoveredLead[];
  onPartSelect: (partKey: string | null) => void;
  drawerOpen: boolean;
}

const _scratchVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCamLook = new THREE.Vector3();

const PRESET_VIEWS: Record<CameraPresetId, { pos: [number, number, number]; look: [number, number, number] }> = {
  hero: { pos: [3.2, 2.35, 3.6], look: [0, 0.85, 0] },
  detail: { pos: [1.65, 1.5, 2.0], look: [0, 0.9, 0] },
  top: { pos: [0.01, 4.3, 1.15], look: [0, 0.75, 0] },
};

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const ShowroomCanvas: React.FC<ShowroomCanvasProps> = ({
  subjectId,
  finish,
  explodeAmount,
  cameraPreset,
  cameraPresetTrigger,
  leads,
  onPartSelect,
  drawerOpen,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const explodeTargetRef = useRef(explodeAmount);
  explodeTargetRef.current = explodeAmount;

  const onPartSelectRef = useRef(onPartSelect);
  onPartSelectRef.current = onPartSelect;

  const drawerOpenRef = useRef(drawerOpen);
  drawerOpenRef.current = drawerOpen;
  const hasMountedRef = useRef(false);

  const sceneStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    currentBuild: ProceduralBuildResult | null;
    anisotropy: number;
    isSoftwareGl: boolean;
    explodeCurrent: number;
    transitionActive: boolean;
    requestRender: () => void;
    rebuildSubject: (
      subId: SceneSubjectId,
      fin: ProductFinishOption,
      currentLeads: DiscoveredLead[]
    ) => void;
    triggerCameraPreset: (preset: CameraPresetId) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.048);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      80
    );
    camera.position.set(3.2, 2.35, 3.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.4;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.12;
    controls.target.set(0, 0.85, 0);

    // Warm/cool studio 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.3);
    keyLight.position.set(4.5, 6.2, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    const d = 3.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
    rimLight.position.set(-4.5, 3.8, -4.0);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xfff5e4, 2.6, 3.2, 1.4);
      softbox.position.set(0, 4.2, 2.2);
      softbox.lookAt(0, 0.8, 0);
      scene.add(softbox);
    }

    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const plinth = buildShowroomPlinth(anisotropy);
    scene.add(plinth.group);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const st = sceneStateRef.current;
        let needsAnotherFrame = false;

        if (st) {
          // Smoothly damp explode factor
          const explodeDiff = Math.abs(st.explodeCurrent - explodeTargetRef.current);
          if (explodeDiff > 0.001) {
            st.explodeCurrent = THREE.MathUtils.damp(
              st.explodeCurrent,
              explodeTargetRef.current,
              isSoftwareGl ? 24 : 8,
              dt
            );
            if (st.currentBuild) {
              for (const part of st.currentBuild.explodableParts) {
                _scratchVec
                  .copy(part.basePos)
                  .addScaledVector(part.explodeVec, st.explodeCurrent);
                part.mesh.position.copy(_scratchVec);
              }
            }
            needsAnotherFrame = true;
          }

          // Smoothly damp camera preset glide
          if (st.transitionActive) {
            const k = isSoftwareGl ? 24 : 6.5;
            const alpha = 1 - Math.exp(-k * dt);
            camera.position.lerp(_targetCamPos, alpha);
            controls.target.lerp(_targetCamLook, alpha);
            if (
              camera.position.distanceTo(_targetCamPos) < 0.02 &&
              controls.target.distanceTo(_targetCamLook) < 0.02
            ) {
              camera.position.copy(_targetCamPos);
              controls.target.copy(_targetCamLook);
              st.transitionActive = false;
            } else {
              needsAnotherFrame = true;
            }
          }
        }

        const controlsChanged = controls.update();
        if (controlsChanged) needsAnotherFrame = true;

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsAnotherFrame) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    const onControlStart = () => {
      if (sceneStateRef.current) {
        sceneStateRef.current.transitionActive = false;
      }
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', requestRender);

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6) return;
      const st = sceneStateRef.current;
      if (!st?.currentBuild) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(st.currentBuild.inspectables, true);
      if (hits.length > 0) {
        const partKey = hits[0].object.userData.partKey as string | undefined;
        onPartSelectRef.current(partKey || null);
      } else {
        onPartSelectRef.current(null);
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 65) return;
      lastHoverCheck = now;
      const st = sceneStateRef.current;
      if (!st?.currentBuild) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(st.currentBuild.inspectables, true);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const rebuildSubject = (
      subId: SceneSubjectId,
      fin: ProductFinishOption,
      currentLeads: DiscoveredLead[]
    ) => {
      const st = sceneStateRef.current;
      if (!st) return;

      if (st.currentBuild) {
        scene.remove(st.currentBuild.group);
        st.currentBuild.dispose();
      }

      const built = buildSceneSubject(subId, fin, anisotropy, currentLeads);
      st.currentBuild = built;
      st.explodeCurrent = 0;
      scene.add(built.group);

      // Apply current explode instantaneously on fresh mount if non-zero
      if (explodeTargetRef.current > 0) {
        st.explodeCurrent = explodeTargetRef.current;
        for (const part of built.explodableParts) {
          _scratchVec.copy(part.basePos).addScaledVector(part.explodeVec, st.explodeCurrent);
          part.mesh.position.copy(_scratchVec);
        }
      }

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
      requestRender();
    };

    const triggerCameraPreset = (preset: CameraPresetId) => {
      const st = sceneStateRef.current;
      if (!st) return;
      const target = PRESET_VIEWS[preset];
      const offsetShift = drawerOpenRef.current ? 0.55 : 0;
      _targetCamPos.set(target.pos[0] + offsetShift, target.pos[1], target.pos[2]);
      _targetCamLook.set(target.look[0] + offsetShift * 0.45, target.look[1], target.look[2]);
      st.transitionActive = true;
      requestRender();
    };

    sceneStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      currentBuild: null,
      anisotropy,
      isSoftwareGl,
      explodeCurrent: 0,
      transitionActive: false,
      requestRender,
      rebuildSubject,
      triggerCameraPreset,
    };

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    // Initial build
    rebuildSubject(subjectId, finish, leads);
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      if (sceneStateRef.current?.currentBuild) {
        sceneStateRef.current.currentBuild.dispose();
      }
      plinth.dispose();
      envTex.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneStateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild 3D subject when product line, finish, or plotted globe leads change
  useEffect(() => {
    sceneStateRef.current?.rebuildSubject(subjectId, finish, leads);
  }, [subjectId, finish, leads]);

  // Smoothly animate explode slider updates
  useEffect(() => {
    sceneStateRef.current?.requestRender();
  }, [explodeAmount]);

  // Smooth camera preset transitions
  useEffect(() => {
    if (cameraPresetTrigger > 0) {
      sceneStateRef.current?.triggerCameraPreset(cameraPreset);
    }
  }, [cameraPreset, cameraPresetTrigger]);

  // Shift framing gracefully when right drawer opens/closes (skip initial mount)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    sceneStateRef.current?.triggerCameraPreset(cameraPreset);
  }, [drawerOpen, cameraPreset]);

  return (
    <div className="relative w-full h-full bg-[#090d16]">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090d16] p-8">
          <div className="max-w-lg border border-white/10 bg-[#0f1624] rounded-xl overflow-hidden">
            <img
              src="/src/assets/images/karate_football_studio_1795300342088.jpg"
              alt="Sarwar Khawaja Industries Pvt Ltd Sialkot craftsmanship studio"
              referrerPolicy="no-referrer"
              className="w-full h-64 object-cover"
            />
            <div className="p-5">
              <h3 className="text-base font-semibold text-white">Sialkot Craftsmanship Preview</h3>
              <p className="mt-1.5 text-sm text-slate-300">
                WebGL 3D context is currently paused. Use the workspace navigation above to run live AI buyer lead searches and export briefings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
