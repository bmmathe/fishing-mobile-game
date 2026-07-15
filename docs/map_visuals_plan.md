# Region Map Visual Enhancement Plan

Implementation plan for upgrading the region map (`src/world/RegionMap.tsx`) from "flat board" to
"diorama with depth, grounding, and motion" while keeping the soft low-poly pastel style.

**Read this whole document before starting a phase.** Each phase is independent and shippable on
its own, but they are ordered by impact — do them in order. Exact values (colors, intensities,
positions) are specified everywhere; **use the values as written, do not improvise new colors or
magnitudes.** The art direction is: soft pastels, faceted flat shading, warm sun / cool shadows,
small motion. Nothing neon, nothing saturated, nothing realistic.

## Files involved

| File | Role |
|---|---|
| `src/world/RegionMap.tsx` | The region diorama scene: Canvas, lights, terrain, water bodies, spot pins |
| `src/world/MapDecor.tsx` | Shared low-poly props (trees, rocks, clouds, ripples…) used by all overworld scenes |
| `src/scene/palette.ts` | The single source of truth for all colors |
| `src/world/WaterMaterial.tsx` | NEW (Phase 3): animated stylized water material |

## Global rules (apply to every phase)

1. **Every color must come from `palette.ts`.** If a new color is needed, add it to the palette
   with the exact hex given in this document, then reference `palette.name`. Never inline a hex
   string in a component (existing inline hexes in the codebase are legacy; don't add more).
2. **All new decorative meshes must be non-interactive.** Put them inside a group with
   `raycast={() => null}` (see `ShoreDecor` in RegionMap.tsx for the pattern) so they never
   intercept taps meant for spot pins.
3. **No per-frame allocation.** Animation goes in `useFrame` callbacks that mutate refs; never
   create `new THREE.*` objects or arrays inside `useFrame`. Reuse module-level scratch objects
   if needed.
4. **No postprocessing.** Do NOT add `@react-three/postprocessing`, SSAO, bloom, or any
   fullscreen pass. This game runs in a WKWebView on phones; the budget does not allow it.
5. **Geometry stays chunky low-poly.** Segment counts ≤ 8 for cylinders/cones, `icosahedronGeometry`
   detail 0, `flatShading` on every `meshStandardMaterial`.
6. **Verification after each phase:** run `npm run typecheck`, then `npm run dev` and view the
   California region map (tap Travel → California). Compare against the "expected result" note at
   the end of each phase. Check that spot pins are still tappable and the SpotCard still opens.

---

## Phase 1 — Lighting & material tuning

**Goal:** replace the washed-out even lighting with a warm directional sun + cool fill, and give
surfaces distinct material responses. No new geometry. This phase alone should visibly transform
the scene.

### 1.1 Palette additions (`src/scene/palette.ts`)

Add these entries:

```ts
  // Lighting (Phase 1: warm sun / cool fill)
  sunlight: "#ffedd0",      // warm late-morning sun
  skyFill: "#cfe8ef",       // hemisphere sky color (cool)
  groundFill: "#8fae7c",    // hemisphere ground bounce (muted green)
```

### 1.2 Light rig (`src/world/RegionMap.tsx`, lines ~71–75)

Replace the current three light lines:

```tsx
<ambientLight intensity={0.9} />
<hemisphereLight args={[palette.sky, palette.grassDark, 0.5]} />
<directionalLight position={[8, 18, 6]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
```

with:

```tsx
<ambientLight intensity={0.62} />
<hemisphereLight args={[palette.skyFill, palette.groundFill, 0.7]} />
<directionalLight
  color={palette.sunlight}
  position={[9, 17, 7]}
  intensity={1.1}
  castShadow
  shadow-mapSize={[2048, 2048]}
  shadow-camera-left={-16}
  shadow-camera-right={16}
  shadow-camera-top={16}
  shadow-camera-bottom={-16}
  shadow-camera-near={1}
  shadow-camera-far={45}
  shadow-normalBias={0.02}
/>
```

Rationale (do not change these numbers — they were tuned against screenshots and approved):
ambient 0.9 flattened everything, but the fix must stay gentle. **The art style is "soft, light,
airy": shadows must read as pale tinted patches, never heavy dark blobs.** These exact values
(ambient 0.62 / hemi 0.7 / sun 1.1 at a high angle) keep overall scene brightness essentially
unchanged from the original while adding just enough directionality. A first attempt at
ambient 0.3 / sun 1.6 / low sun angle was rejected for darkening the scene — do not drift back
toward high-contrast values. The tight shadow camera (±16 covers the ~26-unit landmass) is what
makes 2048px shadows crisp instead of mushy. `normalBias` 0.02 prevents shadow acne stripes on
flat-shaded faces.

### 1.3 Soft shadow filtering (`src/world/RegionMap.tsx`, Canvas props)

On the `<Canvas>` element, change the `gl` prop and add `onCreated`:

```tsx
import { PCFSoftShadowMap } from "three"; // add to existing three import or import * as THREE and use THREE.PCFSoftShadowMap

<Canvas
  shadows
  dpr={[1, 2]}
  camera={{ position: [focus[0], 14, focus[1] + 15], fov: 38, near: 0.1, far: 200 }}
  gl={{ antialias: true }}
  onCreated={({ gl }) => {
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }}
>
```

### 1.4 Material separation pass

The problem: nearly everything is `roughness={1}`, so all surfaces respond identically to light.
Apply exactly these changes (roughness only — do not change colors here):

In `src/world/RegionMap.tsx`:
- Ocean plane (`Terrain`, `palette.water` material): `roughness={0.35}` — the water should catch a
  visible sun highlight.
- Shallow tint mesh (`foam` slab, `palette.waterShallow`): `roughness={0.45}`.
- Pond water in `FreshWaterBody` (`palette.waterDeep`): `roughness={0.35}`.
- Beach shallows in `SaltShoreDressing` (`palette.waterShallow`): `roughness={0.45}`.
- Grass slab and sand stay `roughness={1}` (matte is correct for them).

In `src/world/MapDecor.tsx`:
- `Rock` boulders: `roughness={0.85}` (both main and cluster meshes).
- `Mountain` peaks: `roughness={0.9}` on the colored peak meshes; snow caps stay 1.
- Everything else stays as-is.

### Phase 1 expected result

Trees and rocks cast short, soft-edged, PALE shadows onto the grass — visible but airy, like high
midday sun through haze. The shadowed side of tree canopies reads slightly cooler than the sun
side. Lakes show a soft specular sheen. Overall scene brightness matches the pre-change build;
only the shadows and highlights are new. **Regression check:** no shadow acne (stripey bands),
and put a before/after screenshot side by side — if the after looks darker overall, the fill
lights are too low; raise `ambientLight` (never above 0.7) rather than lowering sun further.

---

## Phase 2 — Grounding: contact shadows & seating objects into terrain

**Goal:** kill the "objects floating above the board" look. Trees, rocks, and ponds must feel
attached to the ground.

### 2.1 Shared blob shadow texture + component (`src/world/MapDecor.tsx`)

Add near the top of the file (module scope, created once):

```tsx
/** Shared radial-gradient texture for cheap contact shadows (one texture for all blobs). */
let blobShadowTexture: THREE.CanvasTexture | null = null;
function getBlobShadowTexture() {
  if (blobShadowTexture) return blobShadowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(46, 66, 58, 0.38)"); // soft cool green-grey core
  g.addColorStop(0.6, "rgba(46, 66, 58, 0.18)");
  g.addColorStop(1, "rgba(46, 66, 58, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobShadowTexture = new THREE.CanvasTexture(c);
  return blobShadowTexture;
}

/** Soft contact shadow blob. Place at ground level under a prop. */
export function BlobShadow({ position, radius = 0.4 }: { position: V3; radius?: number }) {
  const map = useMemo(getBlobShadowTexture, []);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <circleGeometry args={[radius, 16]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}
```

Notes for the implementer:
- The gradient color is a desaturated deep green-grey, NOT black. Black blobs look like holes;
  this must read as shade on grass.
- `depthWrite={false}` is required or the blob will z-fight with the terrain.
- The `position` y should be ~0.01 above whatever surface the prop sits on so it draws on top.

### 2.2 Build blobs into the props themselves

Add a `BlobShadow` INSIDE these components in `MapDecor.tsx`, so every scene that uses them gets
grounding for free. Exact placements (positions are in the prop's local space, y = 0.01):

| Component | BlobShadow line to add |
|---|---|
| `PineTree` | `<BlobShadow position={[0, 0.01, 0]} radius={0.45} />` |
| `LeafTree` | `<BlobShadow position={[0.05, 0.01, 0.03]} radius={0.42} />` (offset toward canopy overhang) |
| `PalmTree` | `<BlobShadow position={[0.15, 0.01, 0]} radius={0.5} />` (trunk leans +x) |
| `Rock` | `<BlobShadow position={[0, 0.01, 0]} radius={0.3} />`, and when `cluster`, a second one `position={[0.24, 0.01, 0.08]} radius={0.18}` |
| `Mountain` | `<BlobShadow position={[0, 0.01, 0]} radius={1.1} />` |
| `Reeds` | `<BlobShadow position={[0, 0.01, 0]} radius={0.16} />` |

Do NOT add blobs to `Cloud`, `Gull`, `Fish`, `Sailboat`, `RippleRing`, `LilyPad` (airborne or
on-water props).

### 2.3 Seat the ponds into the terrain (`src/world/RegionMap.tsx`, `FreshWaterBody`)

Add one palette entry:

```ts
  sandWet: "#d8c49a",   // darker damp-sand rim where the bank meets the water
```

In `FreshWaterBody`, between the existing sand-bank circle and the water circle, insert a wet-sand
rim ring so the water sits *in* a depression instead of on top of a pancake:

```tsx
<mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
  <ringGeometry args={[radius * 0.96, radius * 1.08, 24]} />
  <meshStandardMaterial color={palette.sandWet} flatShading roughness={1} />
</mesh>
```

(y = 0.32 places it between the bank at 0.315 and the water at 0.325.)

### 2.4 Drifting cloud shadows (`src/world/MapDecor.tsx`, `Cloud`)

Add `castShadow` to all three icosahedron meshes inside `Cloud`. Because clouds already drift on
the x axis, this produces slow-moving soft shadow patches sweeping across the terrain — very high
charm for a one-word-per-mesh change. Verify the shadows look soft and dim; if they read too
dark against the airy style, remove `castShadow` from the two smaller side puffs (keeping only
the main puff's shadow) before touching the light rig.

### Phase 2 expected result

Every tree/rock/mountain has a soft dark patch tying it to the ground even where the sun shadow
is short. Pond edges show a damp rim. Cloud shadows drift slowly across the map. Nothing appears
to hover.

---

## Phase 3 — Stylized animated water

**Goal:** replace the flat-color water with a subtle animated material: shallow rim → deep center
gradient, moving sparkle, fresnel sky tint at grazing angles. Stylized, NOT realistic. Ponds and
ocean both.

### 3.1 New file: `src/world/WaterMaterial.tsx`

Create a component that renders a `meshStandardMaterial` extended via `onBeforeCompile`. Full
implementation spec:

```tsx
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
          "#include <output_fragment>",
          `// fresnel: tint toward sky color at grazing view angles
          {
            vec3 viewDirF = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(viewDirF, normalize(vNormal))), 3.0);
            outgoingLight = mix(outgoingLight, uSky, fres * 0.35);
          }
          #include <output_fragment>`,
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
```

Implementation notes (important — read before coding):
- The `+= 0.025` wave amplitude and `fres * 0.35` are style ceilings. If it looks too subtle on
  desktop, it is correct — check on a phone before increasing, and never exceed 0.04 / 0.45.
- `vWaterPos = position.xy` works because the water geometries are `circleGeometry`/`planeGeometry`
  authored in the XY plane then rotated flat; local xy is the water surface plane.
- three r169's `onBeforeCompile` shader type is `WebGLProgramParametersWithUniforms`. If the type
  import errors, type the parameter as `any` rather than fighting it.
- `customProgramCacheKey` is required: without it three.js may share one compiled program across
  water instances with different uniforms baked in.

### 3.2 Use it

- `FreshWaterBody` pond circle (`RegionMap.tsx`): replace
  `<meshStandardMaterial color={palette.waterDeep} flatShading roughness={0.6} />` with
  `<WaterMaterial radius={radius} />`.
- `Terrain` ocean plane: replace its material with
  `<WaterMaterial deep={palette.water} gradient={false} />`.
- `SaltShoreDressing` beach shallows circle: `<WaterMaterial deep={palette.waterShallow} shallow={palette.foam} radius={2.0} />`.

### 3.3 Ripple variety (`src/world/MapDecor.tsx`, `RippleRing`)

Extend `RippleRing` with two optional props, defaulting to current behavior:

```tsx
export function RippleRing({ position, period = 2.4, size = 1, maxOpacity = 0.45 }: { position: V3; period?: number; size?: number; maxOpacity?: number })
```

- Multiply the computed scale by `size`; use `maxOpacity` in place of the hardcoded `0.45`.
- In `FreshWaterBody`, add two ripple rings per pond (lakes and rivers only, skip streams):
  ```tsx
  <RippleRing position={[radius * 0.3, 0.34, -radius * 0.2]} period={3.1} size={0.7} maxOpacity={0.3} />
  <RippleRing position={[-radius * 0.4, 0.34, radius * 0.3]} period={4.3} size={0.5} maxOpacity={0.25} />
  ```
  The differing periods/sizes/opacities are the point — identical rings read as a bug, varied
  rings read as life.

### Phase 3 expected result

Pond water shows a lighter teal rim fading to deeper blue-teal center, faint moving light bands,
and a slight sky-tint at the far edge from the camera. Multiple ripples per pond expand at
different rhythms. Water clearly reads as a different substance from grass. **Regression check:**
fog still affects the ocean correctly at distance (if fog broke, an `onBeforeCompile` replace
anchor didn't match — check three version chunk names).

---

## Phase 4 — Terrain breakup & prop density

**Goal:** the big single-color grass field becomes varied, and the areas around each named POI feel
authored.

### 4.1 Palette additions

```ts
  grassDry: "#c9d69a",   // warm dry-grass patch tint
  pebble: "#b5b1a6",     // light pebble
```

### 4.2 Vertex-color noise on the grass slab (`RegionMap.tsx`, `useCoastSlab`)

Give `useCoastSlab` an optional flag `vertexNoise?: boolean`, used only by the grass slab call.
After `g.computeVertexNormals()`, when the flag is set, add a color attribute:

```ts
if (vertexNoise) {
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(palette.grass);
  const cDark = new THREE.Color(palette.grassDark);
  const cDry = new THREE.Color(palette.grassDry);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // cheap 2-octave value noise from overlapping sines (deterministic, no lib)
    const n =
      Math.sin(x * 0.55 + z * 0.35) * 0.5 +
      Math.sin(x * 1.7 - z * 1.1 + 2.4) * 0.3 +
      Math.sin(x * 0.2 + z * 0.9 + 5.1) * 0.2; // range ~[-1, 1]
    if (n > 0.45) c.copy(cGrass).lerp(cDry, (n - 0.45) * 0.9);
    else if (n < -0.35) c.copy(cGrass).lerp(cDark, (-n - 0.35) * 0.8);
    else c.copy(cGrass);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
```

On the grass mesh's material set `vertexColors` and change `color` to `"#ffffff"` (vertex colors
multiply the base color; leaving it green would double-tint).

**Caveat:** `ExtrudeGeometry` may generate few vertices on large flat faces, making the noise
invisible. If patches don't appear, increase tessellation by adding `curveSegments: 8` and
`steps: 1` to the extrude options AND subdivide the shape outline: in the shape-building loop,
step `z += 0.5` instead of `1`. If it is still too sparse, fall back to Plan B: 6–10 flat
`circleGeometry` patches (radius 1.5–3, `grassDark` / `grassDry`, y = 0.301, `depthWrite` true,
`raycast={() => null}`) scattered at hand-picked positions between POIs.

### 4.3 Terrain relief hummocks (`RegionMap.tsx`, inside `ShoreDecor`)

Add 4 low grass mounds so the ground silhouette isn't a single plane. Squashed icosahedrons,
grass-colored, mostly sunk into the ground:

```tsx
{/* gentle grass hummocks so the field isn't one flat plane */}
<mesh position={[-4.5, 0.15, -2.5]} scale={[2.6, 0.55, 2.0]} castShadow receiveShadow>
  <icosahedronGeometry args={[1, 0]} />
  <meshStandardMaterial color={palette.grassDark} flatShading roughness={1} />
</mesh>
<mesh position={[-1.5, 0.12, 9]} scale={[2.0, 0.45, 1.7]} castShadow receiveShadow>
  <icosahedronGeometry args={[1, 0]} />
  <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
</mesh>
<mesh position={[-6, 0.18, 3.5]} scale={[2.2, 0.6, 1.8]} castShadow receiveShadow>
  <icosahedronGeometry args={[1, 0]} />
  <meshStandardMaterial color={palette.grassDry} flatShading roughness={1} />
</mesh>
<mesh position={[1.5, 0.1, 0.5]} scale={[1.6, 0.35, 1.4]} castShadow receiveShadow>
  <icosahedronGeometry args={[1, 0]} />
  <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
</mesh>
```

**Constraint:** hummocks must not sit under any spot pin or pond. Spot positions come from
`region.spots[].pos` in `src/world/regions.ts` — check California's land-spot positions and nudge
any colliding hummock at least 2.5 units away. Keep max height (scale y × 1) ≤ 0.6 so they read
as meadow swells, not hills.

### 4.4 Instanced micro-props (`src/world/MapDecor.tsx`)

Two new components, each ONE `InstancedMesh` (one draw call each):

**`GrassTufts`** — small cones scattered in a ring band around a center:

```tsx
/** A ring of tiny grass-tuft cones around a POI (single InstancedMesh). */
export function GrassTufts({ center, innerRadius, outerRadius, count = 40, seed = 1 }:
  { center: [number, number, number]; innerRadius: number; outerRadius: number; count?: number; seed?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useMemo(() => { /* placement computed below in useLayoutEffect-style effect */ }, []);
  // deterministic pseudo-random from seed (mulberry32 or sin-hash); place instances once:
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const dummy = new THREE.Object3D();
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = innerRadius + rand() * (outerRadius - innerRadius);
      dummy.position.set(center[0] + Math.cos(a) * r, center[1], center[2] + Math.sin(a) * r);
      const sc = 0.5 + rand() * 0.8;
      dummy.scale.set(sc, sc * (0.7 + rand() * 0.6), sc);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [center, innerRadius, outerRadius, count, seed]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={() => null} receiveShadow>
      <coneGeometry args={[0.05, 0.22, 4]} />
      <meshStandardMaterial color={palette.reed} flatShading roughness={1} />
    </instancedMesh>
  );
}
```

**`Pebbles`** — same pattern, but `icosahedronGeometry args={[0.05, 0]}`, color `palette.pebble`,
squashed scale (`dummy.scale.set(sc, sc * 0.6, sc)`), count default 25.

Rules:
- Placement MUST be deterministic (seeded), so the map looks identical every visit. No `Math.random()`.
- Instances that would land inside the pond (r < pond radius) are already excluded by `innerRadius`.

### 4.5 Cluster density around POIs (`RegionMap.tsx`, `FreshWaterBody`)

At the bottom of `FreshWaterBody`'s group add:

```tsx
<GrassTufts center={[0, 0.3, 0]} innerRadius={radius * 1.25} outerRadius={radius * 1.9} count={36} seed={Math.round(x * 13 + z * 7)} />
<Pebbles center={[0, 0.3, 0]} innerRadius={radius * 1.2} outerRadius={radius * 1.8} count={20} seed={Math.round(x * 5 + z * 11)} />
```

And 2 more hand-placed props per pond for asymmetry (positions in local pond space):

```tsx
<Reeds position={[radius * 0.1, 0.32, -radius * 0.9]} scale={0.85} />
<Rock position={[-radius * 1.15, 0.3, radius * 0.5]} scale={0.5} />
```

### Phase 4 expected result

The grass field shows soft mottled patches of three green tones. Gentle mounds break the horizon
between POIs. Each pond is ringed by a scruffy band of tufts and pebbles — "Clear Lake" and
"Tahoe Boat Docks" look dressed rather than placed. Draw calls added: ~2 per pond + 4 hummocks.
**Regression check:** open the SpotCard on every California land spot; no tuft/pebble/hummock may
block a tap.

---

## Phase 5 — Motion & selection microinteractions

**Goal:** small ambient motion everywhere the eye rests, and juicy feedback when a spot is selected.

### 5.1 Tree canopy sway (`src/world/MapDecor.tsx`)

Add a `Sway` wrapper used INSIDE trees, around canopy meshes only (trunks stay planted):

```tsx
/** Gentle wind sway for canopies. amp is radians; keep <= 0.03. */
function Sway({ children, seed = 0, amp = 0.025 }: { children: React.ReactNode; seed?: number; amp?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.rotation.z = Math.sin(t * 1.3) * amp;
    ref.current.rotation.x = Math.sin(t * 0.9 + 1.7) * amp * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}
```

- In `PineTree`: wrap the three cone meshes (not the trunk) in `<Sway seed={position[0] * 3 + position[2]}>`.
- In `LeafTree`: wrap the two icosahedron canopy meshes the same way.
- In `PalmTree`: wrap the fronds group, `amp={0.04}`.
- The per-tree `seed` from position is mandatory — synchronized sway across all trees looks
  mechanical and is worse than no sway.

### 5.2 Selection feedback (`RegionMap.tsx`, `SpotPin`)

Pass a new `selected: boolean` prop from `RegionMap` (`selected?.id === s.id`). In `SpotPin`:

1. **Spring pop:** replace the current instant `scale={hover ? 1.18 : 1}` with an animated scale
   in the existing `useFrame`: keep a `targetScale` (selected ? 1.28 : hover ? 1.18 : 1) and
   lerp the group's scale toward it each frame with factor `1 - Math.exp(-12 * delta)` (get
   `delta` from the `useFrame` second argument). This gives a smooth pop without a spring lib.
2. **Gold ring:** while `selected`, the pulsing locator ring uses color `#f4c453` and
   opacity 0.7 (same values the tutorial target already uses — reuse those constants).
3. **Selection ripple burst:** on the frame `selected` becomes true, trigger one `RippleRing`-style
   one-shot: render a ring mesh that scales 0.5 → 2.2 and fades 0.5 → 0 over 0.6s, then hides
   (`visible = false`). Drive it from the same `useFrame` with a `startTime` ref set in a
   `useEffect` on `selected`. Do not use setState per frame.

### 5.3 Occasional fish splash (`RegionMap.tsx`)

New component `SplashSpawner` rendered once inside the Canvas:

- Props: `points: [number, number, number][]` — pass the center of every fresh pond
  (`landSpots.filter(s => s.water === "fresh").map(s => [s.pos[0], 0.36, s.pos[1]])`).
- Behavior: every 8–15 s (randomized once per cycle from a seeded or plain `Math.random()` — timing
  randomness is fine, only placement must be deterministic), pick a random point, offset it by up
  to 0.4 units in x/z, and play a 0.6 s one-shot splash:
  - 3 small cones (`coneGeometry args={[0.03, 0.14, 4]}`, color `palette.foam`) that rise
    ~0.25 units while tilting outward and fading out;
  - plus one expanding fading ring (reuse the Phase 5.2 one-shot ring logic).
- Implement as ONE hidden group whose meshes are re-positioned and shown for each splash — do
  not mount/unmount meshes per splash.
- Optional polish if trivially available: play `sfx.splash?.()` if such a method exists in
  `src/audio/sfx.ts` — check first; if there is no splash sound, skip audio entirely (do not add one).

### 5.4 Explicitly out of scope

- NO camera idle drift or parallax — `MapOrbitControls` is user-driven pan/zoom; automatic camera
  motion fights touch input.
- NO label entry animations (the `Html` labels are DOM; animating them per-frame causes layout
  churn in WKWebView).

### Phase 5 expected result

Canopies sway independently and subtly (blink and you miss it — that's correct). Tapping a spot
pops the pin with a smooth overshoot-free scale, turns its ring gold, and emits a single ripple.
Every ~10 s a tiny foam splash blips on one of the ponds. **Regression check:** sway must not
move trunks or blob shadows; selection pop must not shift the Html label enough to move it out
from under a finger mid-tap.

---

## Final verification (after all phases)

1. `npm run typecheck` passes and `npm run build` succeeds.
2. On the dev server, walk the full loop: Travel → pick region → tap spot → SpotCard → Fish here →
   fishing scene loads. Repeat for a salt (pier/beach) spot.
3. Tutorial path still works: the gold tutorial ring, arrow, and dimmed pins must all still render
   correctly (Phase 5.2 touches the same ring).
4. Check a second region besides California — all changes are region-agnostic and must not assume
   California's layout.
5. Performance spot-check on device or simulator (`npm run cap:ios`): the map should hold 60 fps
   on a recent iPhone; if it doesn't, the first suspects are shadow map size (drop to 1024) and
   cloud `castShadow` (remove) — in that order, and report which was needed.
