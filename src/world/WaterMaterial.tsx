import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "../scene/palette";

/**
 * Stylized animated water material (shared by ponds and the ocean).
 * - radial gradient: shallowColor at the rim -> deepColor at the center
 * - two layered scrolling ripple waves perturb the normal for moving sun glints
 * - cheap fresnel tint toward the sky color at grazing angles
 * Opaque (no transparency) so overdraw stays cheap on mobile.
 *
 * `radius` must match the geometry's radius so the gradient spans rim->center.
 * For large planes (ocean) pass gradient={false} to skip the radial gradient.
 */
export function WaterMaterial({
  deep = palette.waterDeep,
  shallow = palette.waterShallow,
  radius = 1.6,
  gradient = true,
}: {
  deep?: string;
  shallow?: string;
  radius?: number;
  gradient?: boolean;
}) {
  const timeRef = useRef({ value: 0 });
  useFrame(({ clock }) => {
    timeRef.current.value = clock.elapsedTime;
  });

  const onBeforeCompile = useMemo(() => {
    return (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = timeRef.current;
      shader.uniforms.uDeep = { value: new THREE.Color(deep) };
      shader.uniforms.uShallow = { value: new THREE.Color(shallow) };
      shader.uniforms.uSky = { value: new THREE.Color(palette.sky) };
      shader.uniforms.uRadius = { value: radius };
      shader.uniforms.uGradient = { value: gradient ? 1.0 : 0.0 };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vWaterPos;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWaterPos = position.xy;",
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uSky;
          uniform float uRadius;
          uniform float uGradient;
          varying vec2 vWaterPos;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            // rim -> center gradient (only when uGradient == 1)
            float d = clamp(length(vWaterPos) / uRadius, 0.0, 1.0);
            vec3 grad = mix(uDeep, uShallow, smoothstep(0.55, 1.0, d));
            diffuseColor.rgb = mix(uDeep, grad, uGradient);
            // two layered scrolling waves -> subtle moving brightness bands
            float w1 = sin(vWaterPos.x * 3.1 + uTime * 0.7) * sin(vWaterPos.y * 2.3 - uTime * 0.5);
            float w2 = sin((vWaterPos.x + vWaterPos.y) * 5.7 - uTime * 1.1);
            diffuseColor.rgb += (w1 * 0.5 + w2 * 0.5) * 0.025; // KEEP SUBTLE: max +-2.5% brightness
          }`,
        )
        .replace(
          // three r169 renamed the old <output_fragment> chunk to <opaque_fragment>
          "#include <opaque_fragment>",
          // fresnel: tint toward sky color at grazing view angles.
          // Use `normal` (the flat-shading-aware fragment normal from
          // <normal_fragment_begin>) — with flatShading three does NOT declare
          // the `vNormal` varying, so referencing it invalidates the program.
          `{
            vec3 viewDirF = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(viewDirF, normal)), 3.0);
            outgoingLight = mix(outgoingLight, uSky, fres * 0.35);
          }
          #include <opaque_fragment>`,
        );
    };
  }, [deep, shallow, radius, gradient]);

  return (
    <meshStandardMaterial
      color={deep}
      flatShading
      roughness={0.35}
      onBeforeCompile={onBeforeCompile}
      // material must recompile if colors change
      customProgramCacheKey={() => `water-${deep}-${shallow}-${gradient}`}
    />
  );
}
