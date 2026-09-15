import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "../scene/palette";

/**
 * Fishing-scene water: keeps the faceted vertex swells, then tints them for
 * golden hour — deeper color in the distance, sky fresnel at grazing angles,
 * a cheap sun-path glitter, and pale foam on wave peaks.
 *
 * Geometry is Y-up (rotateX is baked into the plane), so the shader samples
 * world XZ rather than the region-map material's XY pond layout.
 */
export function FishingWaterMaterial({ sunPosition }: { sunPosition: THREE.Vector3 }) {
  const timeRef = useRef({ value: 0 });
  useFrame(({ clock }) => {
    timeRef.current.value = clock.elapsedTime;
  });

  const onBeforeCompile = useMemo(() => {
    return (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = timeRef.current;
      shader.uniforms.uDeep = { value: new THREE.Color(palette.waterDeep) };
      shader.uniforms.uShallow = { value: new THREE.Color(palette.waterShallow) };
      shader.uniforms.uHorizon = { value: new THREE.Color("#f3d9b8") };
      shader.uniforms.uFoam = { value: new THREE.Color(palette.foam) };
      shader.uniforms.uSun = { value: sunPosition.clone().normalize() };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWaterWorld;\nvarying float vWaveH;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWaveH = transformed.y;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uHorizon;
          uniform vec3 uFoam;
          uniform vec3 uSun;
          varying vec3 vWaterWorld;
          varying float vWaveH;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            float depth = smoothstep(5.0, 30.0, vWaterWorld.z);
            diffuseColor.rgb = mix(uShallow, uDeep, depth);

            // Scrolling brightness bands that catch the facets.
            float w1 = sin(vWaterWorld.x * 0.45 + uTime * 0.75) * sin(vWaterWorld.z * 0.32 - uTime * 0.5);
            float w2 = sin((vWaterWorld.x + vWaterWorld.z) * 0.9 - uTime * 1.05);
            diffuseColor.rgb += (w1 * 0.55 + w2 * 0.45) * 0.035;

            // Pale foam on swell peaks (vertex Y is already displaced).
            float foam = smoothstep(0.1, 0.22, vWaveH);
            diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, foam * 0.28);

            // Sun path: a warm glitter streak toward the disc, not a mirror.
            vec2 sunXZ = normalize(uSun.xz);
            vec2 fromCam = normalize(vWaterWorld.xz);
            float towardSun = pow(max(0.0, dot(fromCam, sunXZ)), 10.0);
            float sparkle = pow(max(0.0, w1 * 0.5 + 0.5), 7.0);
            diffuseColor.rgb += vec3(1.0, 0.9, 0.7) * towardSun * (0.12 + sparkle * 0.35);
          }`,
        )
        .replace(
          "#include <opaque_fragment>",
          `{
            vec3 viewDirF = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(viewDirF, normal)), 2.6);
            outgoingLight = mix(outgoingLight, uHorizon, fres * 0.42);
          }
          #include <opaque_fragment>`,
        );
    };
  }, [sunPosition]);

  return (
    <meshStandardMaterial
      color={palette.water}
      flatShading
      roughness={0.32}
      metalness={0.04}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={() => "fishing-water-v1"}
    />
  );
}
