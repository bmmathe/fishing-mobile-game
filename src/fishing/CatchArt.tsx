import { useId, type ReactNode } from "react";

/**
 * Per-species catch art for the reveal modal (and anywhere else a catch is
 * shown). Every species in the catalog gets its own look, built from:
 *
 *  - a **silhouette family** (minnow, bass, pike, tuna, billfish, …) — the
 *    hand-authored SVG body/tail/fin paths below;
 *  - a **3-color palette** (body / belly / fins);
 *  - an optional **pattern** (bars, spots, lateral stripes, mackerel squiggles,
 *    sturgeon scutes, tarpon scales) clipped to the body;
 *  - **feature flags** (whiskers, sail, bill, tail spot, glowing eye, …).
 *
 * Junk items (boots, cans, driftwood…) are individual drawings. All art lives
 * in a 240×140 viewBox, fish facing right.
 */

type Family =
  | "minnow"
  | "herring"
  | "eel"
  | "panfish"
  | "bass"
  | "trout"
  | "pike"
  | "catfish"
  | "mackerel"
  | "tuna"
  | "sturgeon"
  | "gar"
  | "billfish"
  | "grouper"
  | "mahi";

type Pattern = "vbars" | "spots" | "stripe" | "hlines" | "wavy" | "scales" | "scutes" | "blotches";

interface ArtSpec {
  family: Family;
  /** body / belly / fin colors */
  body: string;
  belly: string;
  fin: string;
  pattern?: Pattern;
  patternColor?: string;
  /** feature flags */
  earSpot?: boolean; // dark opercular flap (bluegill etc.)
  tailSpot?: boolean; // black spot at the tail base (red drum)
  glowEye?: boolean; // mythic glowing eye
  bigEye?: boolean; // oversized glassy eye (walleye)
  sail?: boolean; // billfish: huge sail dorsal
  longBill?: boolean; // billfish: swordfish-length bill
}

/* ------------------------------------------------------------------ */
/* Family geometry: body path (also used as pattern clip), tail, fins  */
/* ------------------------------------------------------------------ */

interface Geometry {
  body: string;
  tail: string;
  dorsal?: string;
  anal?: string;
  eye: [number, number, number];
  /** extra family-specific detail, drawn with the fin color */
  extras?: (fin: string, body: string) => ReactNode;
  /** approximate body box for pattern placement */
  box: [number, number, number, number]; // x0 y0 x1 y1
}

const GEO: Record<Family, Geometry> = {
  minnow: {
    body: "M 205 70 C 200 58 170 52 132 52 C 96 52 68 60 58 70 C 68 80 96 88 132 88 C 170 88 200 82 205 70 Z",
    tail: "M 62 70 L 36 54 C 32 70 32 70 36 86 Z",
    dorsal: "M 122 53 C 128 40 142 40 148 53 Z",
    anal: "M 118 87 C 124 98 136 98 142 87 Z",
    eye: [184, 65, 4.5],
    box: [66, 52, 200, 88],
  },
  herring: {
    body: "M 205 72 C 198 52 165 42 128 42 C 92 42 66 56 56 72 C 66 88 92 100 128 100 C 165 100 198 90 205 72 Z",
    tail: "M 58 72 L 30 50 L 42 72 L 30 94 Z",
    dorsal: "M 116 44 C 124 28 142 28 148 44 Z",
    anal: "M 112 98 C 120 110 136 110 142 97 Z",
    eye: [182, 62, 5],
    box: [64, 44, 198, 98],
  },
  eel: {
    body: "M 212 70 C 202 60 180 56 158 58 C 128 61 100 55 80 62 C 62 68 48 63 36 57 L 30 70 L 36 83 C 48 77 62 72 80 78 C 100 85 128 79 158 82 C 180 84 202 80 212 70 Z",
    tail: "M 34 60 L 24 66 L 24 74 L 34 80 Z",
    dorsal: "M 120 59 C 136 50 160 52 176 60 Z",
    eye: [196, 65, 3.5],
    box: [40, 56, 206, 84],
  },
  panfish: {
    body: "M 196 74 C 192 48 164 34 130 34 C 96 34 70 50 62 74 C 70 98 96 110 130 110 C 164 110 192 96 196 74 Z",
    tail: "M 66 74 L 40 58 C 36 74 36 74 40 90 Z",
    dorsal:
      "M 98 40 L 106 22 L 114 36 L 122 20 L 130 34 L 138 20 L 146 36 L 154 24 L 160 42 C 140 34 116 34 98 40 Z",
    anal: "M 110 108 C 120 120 140 118 148 104 Z",
    eye: [170, 58, 5.5],
    box: [70, 36, 190, 108],
  },
  bass: {
    body: "M 204 72 C 200 52 170 40 128 40 C 92 40 64 52 54 70 C 64 88 92 100 130 100 C 172 100 200 90 204 72 Z",
    tail: "M 56 70 L 32 52 C 27 70 27 72 32 90 Z",
    dorsal:
      "M 96 44 L 104 26 L 112 40 L 120 25 L 128 39 L 136 28 L 142 42 C 150 30 166 32 170 44 C 146 38 116 38 96 44 Z",
    anal: "M 118 99 C 126 112 142 111 150 98 Z",
    eye: [178, 58, 5],
    extras: (fin) => (
      // open jaw
      <path d="M 205 66 L 186 61 L 190 78 Z" fill={fin} opacity={0.55} />
    ),
    box: [62, 42, 198, 98],
  },
  trout: {
    body: "M 206 72 C 200 54 172 44 132 44 C 96 44 66 54 54 70 C 66 86 96 96 134 96 C 174 96 200 88 206 72 Z",
    tail: "M 56 70 L 32 55 C 29 70 29 72 32 87 Z",
    dorsal: "M 118 46 C 126 32 144 31 150 45 Z",
    anal: "M 116 95 C 124 106 138 106 144 94 Z",
    eye: [185, 63, 4.5],
    extras: (fin) => (
      // adipose fin
      <path d="M 92 47 C 95 41 101 41 103 47 Z" fill={fin} />
    ),
    box: [62, 46, 200, 94],
  },
  pike: {
    body: "M 224 72 C 224 66 216 61 202 60 C 176 57 120 55 82 60 C 62 63 50 67 50 72 C 50 77 62 81 82 84 C 120 89 176 87 202 84 C 216 83 224 78 224 72 Z",
    tail: "M 54 72 L 32 58 C 28 72 28 72 32 86 Z",
    dorsal: "M 88 59 C 94 46 110 46 114 58 Z",
    anal: "M 86 85 C 92 97 108 97 112 86 Z",
    eye: [200, 66, 4],
    extras: (_fin, body) => (
      // duckbill snout highlight
      <path d="M 224 68 C 232 69 234 71 234 72 C 234 73 232 75 224 76 Z" fill={body} />
    ),
    box: [58, 58, 216, 86],
  },
  catfish: {
    body: "M 208 74 C 204 58 184 48 150 48 C 112 48 76 56 58 70 C 52 74 54 80 62 84 C 84 96 120 100 152 98 C 186 96 204 90 208 74 Z",
    tail: "M 62 76 L 36 60 C 30 76 30 78 36 92 Z",
    dorsal: "M 138 50 L 145 33 L 152 49 Z",
    anal: "M 110 97 C 122 110 146 110 156 96 Z",
    eye: [188, 62, 3.5],
    extras: (fin) => (
      <g stroke={fin} strokeWidth={2.4} strokeLinecap="round" fill="none">
        {/* barbels */}
        <path d="M 206 64 C 218 57 226 55 234 58" />
        <path d="M 207 80 C 219 87 227 89 233 87" />
        <path d="M 200 58 C 208 49 214 45 222 44" />
      </g>
    ),
    box: [64, 50, 200, 96],
  },
  mackerel: {
    body: "M 208 70 C 202 54 172 46 134 46 C 98 46 70 56 56 70 C 70 84 98 94 134 94 C 172 94 202 86 208 70 Z",
    tail: "M 58 70 L 30 46 L 44 70 L 30 94 Z",
    dorsal: "M 128 47 L 138 32 L 150 46 Z",
    anal: "M 126 93 L 134 106 L 146 92 Z",
    eye: [184, 63, 4.5],
    extras: (fin) => (
      <g fill={fin}>
        {/* finlets along the caudal peduncle */}
        <path d="M 84 52 l 6 -6 l 3 6 Z" />
        <path d="M 97 50 l 6 -6 l 3 6 Z" />
        <path d="M 110 48 l 6 -6 l 3 6 Z" />
        <path d="M 84 88 l 6 6 l 3 -6 Z" />
        <path d="M 97 90 l 6 6 l 3 -6 Z" />
      </g>
    ),
    box: [64, 48, 200, 92],
  },
  tuna: {
    body: "M 206 70 C 198 48 168 38 132 38 C 98 38 72 52 58 70 C 72 88 98 102 132 102 C 168 102 198 92 206 70 Z",
    tail: "M 58 70 L 32 44 C 40 60 40 80 32 96 Z",
    dorsal: "M 128 40 C 134 20 148 16 152 22 C 145 30 138 36 136 42 Z",
    anal: "M 128 100 C 134 120 148 124 152 118 C 145 110 138 104 136 98 Z",
    eye: [180, 60, 5],
    extras: (fin) => (
      <g fill={fin}>
        {/* pectoral + finlets */}
        <path d="M 160 72 C 148 78 136 80 126 78 C 134 70 148 66 160 66 Z" />
        <path d="M 82 50 l 6 -7 l 4 6 Z" />
        <path d="M 95 46 l 6 -7 l 4 6 Z" />
        <path d="M 108 42 l 6 -7 l 4 6 Z" />
        <path d="M 82 90 l 6 7 l 4 -6 Z" />
        <path d="M 95 94 l 6 7 l 4 -6 Z" />
        <path d="M 108 98 l 6 7 l 4 -6 Z" />
      </g>
    ),
    box: [66, 40, 198, 100],
  },
  sturgeon: {
    body: "M 226 74 L 214 68 C 206 62 188 58 160 56 C 120 54 84 58 62 66 L 52 72 C 68 82 108 88 148 88 C 184 88 208 84 220 78 Z",
    tail: "M 58 72 L 28 50 L 44 68 L 38 86 L 30 88 Z",
    dorsal: "M 96 58 L 102 46 L 110 57 Z",
    anal: "M 100 87 C 106 96 118 96 122 86 Z",
    eye: [200, 66, 3],
    extras: (fin) => (
      <g stroke={fin} strokeWidth={2} strokeLinecap="round" fill="none">
        {/* snout barbels */}
        <path d="M 214 76 l -2 8" />
        <path d="M 220 75 l -1 8" />
      </g>
    ),
    box: [60, 56, 210, 88],
  },
  gar: {
    body: "M 206 70 C 202 63 188 59 168 58 C 136 56 96 58 70 64 C 56 67 48 69 48 72 C 48 75 56 78 70 81 C 96 86 136 88 168 86 C 188 85 202 80 206 72 Z",
    tail: "M 52 72 L 32 60 C 29 72 29 74 32 86 Z",
    dorsal: "M 84 60 C 90 48 104 48 108 59 Z",
    anal: "M 84 84 C 90 95 104 95 108 84 Z",
    eye: [190, 64, 3.5],
    extras: (_fin, body) => (
      <g>
        {/* long toothy beak */}
        <path d="M 204 65 L 238 66 L 238 74 L 204 77 Z" fill={body} />
        <path d="M 208 70 L 236 70" stroke="#f4f1ea" strokeWidth={1.6} strokeDasharray="2.5 2.5" fill="none" />
      </g>
    ),
    box: [56, 58, 198, 86],
  },
  billfish: {
    body: "M 200 74 C 194 54 166 44 130 46 C 96 48 68 58 56 72 C 68 86 96 96 132 96 C 168 96 194 92 200 74 Z",
    tail: "M 58 72 L 28 44 L 44 72 L 28 100 Z",
    eye: [178, 62, 4.5],
    box: [64, 48, 194, 94],
  },
  grouper: {
    body: "M 198 76 C 194 50 168 36 132 36 C 100 36 72 52 60 76 C 70 100 100 110 136 108 C 170 106 194 98 198 76 Z",
    tail: "M 64 78 L 40 64 C 36 78 36 82 40 94 Z",
    dorsal:
      "M 92 42 L 100 26 L 108 38 L 116 24 L 124 36 L 132 24 L 140 38 C 148 28 162 30 166 42 C 142 34 112 34 92 42 Z",
    anal: "M 116 107 C 126 118 144 116 150 104 Z",
    eye: [172, 56, 5],
    extras: (fin) => (
      // heavy lips
      <path d="M 199 70 C 205 72 205 78 198 81 C 194 78 194 73 199 70 Z" fill={fin} opacity={0.8} />
    ),
    box: [68, 38, 192, 106],
  },
  mahi: {
    body: "M 188 36 C 200 42 202 66 194 82 C 184 96 152 100 120 94 C 92 88 68 78 56 70 C 78 56 120 42 156 35 C 168 33 180 32 188 36 Z",
    tail: "M 58 70 L 30 50 L 42 70 L 30 90 Z",
    dorsal: "M 90 52 C 110 30 160 24 186 38 L 182 46 C 156 36 116 42 96 58 Z",
    anal: "M 112 94 C 128 104 156 104 172 96 Z",
    eye: [176, 54, 4.5],
    box: [64, 38, 192, 94],
  },
};

/* ------------------------------------------------------------------ */
/* Patterns (drawn clipped to the body path)                            */
/* ------------------------------------------------------------------ */

function PatternLayer({ pattern, color, box }: { pattern: Pattern; color: string; box: [number, number, number, number] }) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0;
  const h = y1 - y0;
  const midY = (y0 + y1) / 2;
  switch (pattern) {
    case "vbars":
      return (
        <g fill={color} opacity={0.5}>
          {[0.18, 0.34, 0.5, 0.66, 0.82].map((f, i) => (
            <rect key={i} x={x0 + f * w - 5} y={y0 + 3} width={10} height={h - 6} rx={5} />
          ))}
        </g>
      );
    case "spots":
      return (
        <g fill={color} opacity={0.65}>
          {[
            [0.2, 0.3], [0.34, 0.55], [0.45, 0.28], [0.58, 0.5], [0.68, 0.3],
            [0.3, 0.75], [0.52, 0.72], [0.78, 0.55], [0.72, 0.75], [0.86, 0.38],
          ].map(([fx, fy], i) => (
            <circle key={i} cx={x0 + fx * w} cy={y0 + fy * h} r={3.4} />
          ))}
        </g>
      );
    case "stripe":
      return <rect x={x0} y={midY - 4} width={w} height={8} rx={4} fill={color} opacity={0.7} />;
    case "hlines":
      return (
        <g stroke={color} strokeWidth={2.6} opacity={0.6} fill="none">
          {[-12, -4, 4, 12].map((dy, i) => (
            <path key={i} d={`M ${x0 + 6} ${midY + dy} Q ${(x0 + x1) / 2} ${midY + dy - 3} ${x1 - 8} ${midY + dy}`} />
          ))}
        </g>
      );
    case "wavy":
      return (
        <g stroke={color} strokeWidth={2.4} opacity={0.65} fill="none">
          {[0.22, 0.36, 0.5, 0.64, 0.78].map((f, i) => (
            <path key={i} d={`M ${x0 + f * w} ${y0 + 4} q 5 8 0 15 q -5 7 1 14`} />
          ))}
        </g>
      );
    case "scales":
      return (
        <g stroke={color} strokeWidth={1.6} opacity={0.5} fill="none">
          {[0.25, 0.45, 0.65].map((fy, r) =>
            [0.18, 0.32, 0.46, 0.6, 0.74, 0.88].map((fx, c) => (
              <path
                key={`${r}-${c}`}
                d={`M ${x0 + (fx + (r % 2) * 0.07) * w - 6} ${y0 + fy * h} a 6 6 0 0 0 12 0`}
              />
            )),
          )}
        </g>
      );
    case "scutes":
      return (
        <g fill={color} opacity={0.8}>
          {[0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((f, i) => (
            <path key={i} d={`M ${x0 + f * w} ${y0 + 2} l 5 6 l -5 6 l -5 -6 Z`} />
          ))}
        </g>
      );
    case "blotches":
      return (
        <g fill={color} opacity={0.45}>
          {[
            [0.22, 0.35, 11], [0.4, 0.6, 13], [0.58, 0.32, 10], [0.74, 0.6, 12], [0.86, 0.35, 8],
          ].map(([fx, fy, r], i) => (
            <ellipse key={i} cx={x0 + fx * w} cy={y0 + fy * h} rx={r} ry={r * 0.7} />
          ))}
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/* The fish renderer                                                    */
/* ------------------------------------------------------------------ */

function FishFigure({ spec }: { spec: ArtSpec }) {
  const clipId = useId();
  const g = GEO[spec.family];
  const [ex, ey, er] = g.eye;
  const eyeR = spec.bigEye ? er * 1.5 : er;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={g.body} />
        </clipPath>
      </defs>
      {/* tail + fins behind the body */}
      <path d={g.tail} fill={spec.fin} />
      {g.dorsal && <path d={g.dorsal} fill={spec.fin} />}
      {g.anal && <path d={g.anal} fill={spec.fin} />}
      {/* billfish dorsal: sail or blade */}
      {spec.family === "billfish" &&
        (spec.sail ? (
          <path d="M 80 58 Q 126 0 190 50 Q 134 44 80 58 Z" fill={spec.fin} />
        ) : (
          <path d="M 142 47 C 150 24 166 22 170 30 C 162 38 154 44 152 50 Z" fill={spec.fin} />
        ))}
      {/* body */}
      <path d={g.body} fill={spec.body} />
      {/* belly (lower half, clipped) */}
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx={(g.box[0] + g.box[2]) / 2} cy={g.box[3] + 8} rx={(g.box[2] - g.box[0]) / 1.6} ry={(g.box[3] - g.box[1]) / 2.4} fill={spec.belly} />
        {spec.pattern && <PatternLayer pattern={spec.pattern} color={spec.patternColor ?? spec.fin} box={g.box} />}
        {/* soft top shine */}
        <ellipse cx={(g.box[0] + g.box[2]) / 2 + 10} cy={g.box[1] + 2} rx={(g.box[2] - g.box[0]) / 2.2} ry={8} fill="#ffffff" opacity={0.18} />
      </g>
      {/* billfish bill (over body) */}
      {spec.family === "billfish" && (
        <path
          d={spec.longBill ? "M 196 66 L 239 52 L 239 57 L 199 76 Z" : "M 196 67 L 234 56 L 235 61 L 199 76 Z"}
          fill={spec.body}
        />
      )}
      {/* gill arc + pectoral */}
      <path d={`M ${ex - 14} ${ey - 12} q -8 12 0 24`} stroke={spec.fin} strokeWidth={2.2} fill="none" opacity={0.55} />
      <path d={`M ${ex - 24} ${ey + 6} q -12 8 -22 8 q 8 -12 22 -14 Z`} fill={spec.fin} opacity={0.8} />
      {/* feature flags */}
      {spec.earSpot && <circle cx={ex - 18} cy={ey + 2} r={4.5} fill="#2f3a36" />}
      {spec.tailSpot && <circle cx={g.box[0] + 8} cy={(g.box[1] + g.box[3]) / 2 - 6} r={5} fill="#2f3a36" />}
      {/* extras (whiskers, beaks, finlets…) */}
      {g.extras?.(spec.fin, spec.body)}
      {/* eye */}
      <circle cx={ex} cy={ey} r={eyeR + 1.6} fill="#f4f1ea" />
      <circle cx={ex} cy={ey} r={eyeR} fill={spec.glowEye ? "#ffd75e" : "#28313a"} />
      {spec.glowEye && <circle cx={ex} cy={ey} r={eyeR + 4} fill="none" stroke="#ffd75e" strokeWidth={1.5} opacity={0.6} />}
      <circle cx={ex + eyeR * 0.35} cy={ey - eyeR * 0.35} r={eyeR * 0.3} fill="#ffffff" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Junk drawings                                                        */
/* ------------------------------------------------------------------ */

function BootArt({ color }: { color: string }) {
  return (
    <g>
      {/* drips */}
      <path d="M 100 26 q -2 8 0 12 M 128 24 q 2 8 0 14" stroke="#7fc6d6" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* shaft + foot */}
      <path d="M 96 34 L 134 34 L 138 84 C 160 86 176 94 178 104 C 178 112 170 116 154 116 L 96 116 Z" fill={color} />
      {/* sole */}
      <path d="M 92 108 L 178 108 C 178 114 170 118 154 118 L 96 118 C 92 118 90 112 92 108 Z" fill="#4a3c2a" />
      {/* worn patches + flapping sole gap */}
      <ellipse cx={116} cy={64} rx={9} ry={6} fill="#4a3c2a" opacity={0.35} />
      <path d="M 138 104 l 12 -6" stroke="#4a3c2a" strokeWidth={2.5} />
      {/* laces */}
      <path d="M 102 42 L 128 48 M 102 54 L 128 60 M 102 66 L 128 72" stroke="#e9ddc4" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function CanArt() {
  return (
    <g>
      <path d="M 96 40 L 150 46 L 144 108 L 90 102 Z" fill="#9aa1a6" />
      {/* dented side */}
      <path d="M 96 40 L 90 102 C 100 96 104 84 100 70 C 97 58 98 48 96 40 Z" fill="#7d848a" />
      {/* rust blotches */}
      <ellipse cx={124} cy={62} rx={10} ry={7} fill="#8a5a3a" opacity={0.75} />
      <ellipse cx={110} cy={88} rx={7} ry={5} fill="#8a5a3a" opacity={0.6} />
      <ellipse cx={136} cy={94} rx={5} ry={4} fill="#a06a42" opacity={0.7} />
      {/* lid, peeled open */}
      <ellipse cx={123} cy={42} rx={27} ry={8} fill="#c2c8cc" />
      <path d="M 108 38 C 116 26 138 26 146 36 L 148 44 C 138 38 118 38 110 44 Z" fill="#b0b6ba" />
      {/* drips */}
      <path d="M 104 112 q -1 8 -4 10 M 132 114 q 1 7 4 9" stroke="#7fc6d6" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function TangledLineArt() {
  return (
    <g fill="none" strokeLinecap="round">
      <path
        d="M 90 70 C 84 52 104 40 122 48 C 142 38 162 52 154 68 C 172 70 168 92 150 94 C 148 108 122 110 114 98 C 96 104 80 88 90 70 Z"
        stroke="#b0b0a0"
        strokeWidth={4}
      />
      <path d="M 100 66 C 108 56 130 54 140 64 C 150 74 144 88 128 90 C 112 92 100 82 104 72" stroke="#c6c6b8" strokeWidth={3.4} />
      <path d="M 112 70 C 120 64 132 66 134 76 C 136 84 126 88 118 84" stroke="#9a9a8c" strokeWidth={3} />
      {/* trailing line + hook */}
      <path d="M 152 92 C 168 100 176 96 180 86" stroke="#b0b0a0" strokeWidth={2.6} />
      <path d="M 180 86 c 6 0 8 8 2 11 c -5 2 -9 -2 -8 -6" stroke="#6f7479" strokeWidth={3} />
      {/* a caught bobber for fun */}
      <circle cx={96} cy={52} r={7} fill="#d4564f" stroke="none" />
      <path d="M 89 52 a 7 7 0 0 0 14 0" fill="#f4efe2" stroke="none" />
    </g>
  );
}

function LogArt({ mossy }: { mossy: boolean }) {
  return (
    <g>
      <path d="M 66 62 L 172 54 C 182 62 182 84 172 94 L 66 100 C 58 90 58 72 66 62 Z" fill={mossy ? "#6e5a3f" : "#9a8a6a"} />
      {/* end grain */}
      <ellipse cx={172} cy={74} rx={11} ry={20} fill={mossy ? "#8a7355" : "#b3a181"} />
      <ellipse cx={172} cy={74} rx={6} ry={11} fill="none" stroke={mossy ? "#6e5a3f" : "#9a8a6a"} strokeWidth={2} />
      {/* bark cracks */}
      <path d="M 84 66 l 28 -3 M 96 88 l 34 -3 M 76 78 l 20 -1" stroke={mossy ? "#54432c" : "#7d6c4e"} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      {/* branch stub */}
      <path d="M 112 60 L 104 42 L 116 44 L 122 59 Z" fill={mossy ? "#54432c" : "#7d6c4e"} />
      {mossy && (
        <g fill="#6f8a5e">
          <ellipse cx={92} cy={62} rx={12} ry={5} />
          <ellipse cx={134} cy={57} rx={14} ry={5} />
        </g>
      )}
      {/* drips */}
      <path d="M 90 104 q -1 7 -4 9 M 150 100 q 1 7 4 9" stroke="#7fc6d6" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function CrabTrapArt() {
  return (
    <g>
      {/* bent wire cage */}
      <path d="M 78 54 L 168 60 L 160 104 L 72 98 Z" fill="none" stroke="#7a7a6a" strokeWidth={3.4} strokeLinejoin="round" />
      <path d="M 92 55 L 86 99 M 108 56 L 102 100 M 124 57 L 118 101 M 140 58 L 134 102 M 156 59 L 150 103" stroke="#8d8d7d" strokeWidth={2.2} />
      <path d="M 76 70 L 166 76 M 74 86 L 164 92" stroke="#8d8d7d" strokeWidth={2.2} />
      {/* broken corner flap */}
      <path d="M 168 60 L 184 48 L 186 58 L 168 68" fill="none" stroke="#7a7a6a" strokeWidth={3} />
      {/* seaweed snagged on it */}
      <path d="M 88 54 C 84 42 90 34 86 24 M 100 55 C 104 44 98 38 102 28" stroke="#6f8a5e" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* resident crab */}
      <ellipse cx={120} cy={92} rx={10} ry={6.5} fill="#d4826b" />
      <path d="M 111 88 l -6 -5 M 129 88 l 6 -5 M 113 97 l -5 4 M 127 97 l 5 4" stroke="#d4826b" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={116.5} cy={90} r={1.4} fill="#2f3a36" />
      <circle cx={123.5} cy={90} r={1.4} fill="#2f3a36" />
    </g>
  );
}

function SeaweedArt() {
  return (
    <g strokeLinecap="round">
      {/* fronds */}
      <path d="M 118 112 C 102 96 104 70 92 52 C 88 44 90 36 96 30" stroke="#5e7a4e" strokeWidth={7} fill="none" />
      <path d="M 122 112 C 122 88 128 66 122 44 C 120 36 122 30 126 26" stroke="#6f8a5e" strokeWidth={8} fill="none" />
      <path d="M 126 112 C 140 98 138 76 150 58 C 154 50 152 42 148 38" stroke="#7fa065" strokeWidth={6.5} fill="none" />
      {/* blades */}
      <path d="M 96 54 c -10 -4 -16 -12 -16 -20 c 10 2 16 8 18 14 Z" fill="#6f8a5e" />
      <path d="M 148 62 c 10 -6 14 -14 12 -22 c -9 3 -14 10 -15 16 Z" fill="#5e7a4e" />
      <path d="M 120 70 c -8 -8 -10 -16 -8 -24 c 8 4 12 12 12 20 Z" fill="#7fa065" />
      {/* bladder bulbs */}
      <circle cx={104} cy={44} r={4} fill="#8fae6e" />
      <circle cx={124} cy={38} r={4.5} fill="#8fae6e" />
      <circle cx={144} cy={48} r={4} fill="#8fae6e" />
      {/* drips */}
      <path d="M 108 114 q -1 8 -4 10 M 136 114 q 1 8 4 10" stroke="#7fc6d6" strokeWidth={2.5} fill="none" />
    </g>
  );
}

const JUNK_ART: Record<string, ReactNode> = {
  "Worn Boot": <BootArt color="#6e5a3f" />,
  "Old Boot": <BootArt color="#5c5a4a" />,
  "Rusty Can": <CanArt />,
  "Tangled Line": <TangledLineArt />,
  "Soggy Log": <LogArt mossy />,
  Driftwood: <LogArt mossy={false} />,
  "Crab-trap Debris": <CrabTrapArt />,
  "Seaweed Clump": <SeaweedArt />,
};

/* ------------------------------------------------------------------ */
/* The species registry — one entry per catchable                       */
/* ------------------------------------------------------------------ */

const FISH_ART: Record<string, ArtSpec> = {
  // --- Tier 1 fresh ---
  "Fathead Minnow": { family: "minnow", body: "#8a8f7a", belly: "#cfd2bd", fin: "#6e735e" },
  "Golden Shiner": { family: "herring", body: "#d9c879", belly: "#f2e9c0", fin: "#b3a052", pattern: "stripe", patternColor: "#b3984a" },
  Mosquitofish: { family: "minnow", body: "#9aa18c", belly: "#d5dac6", fin: "#79806c", pattern: "spots", patternColor: "#6e735e" },
  // --- Tier 1 salt ---
  "Bay Anchovy": { family: "minnow", body: "#c7cdb0", belly: "#eef2dd", fin: "#a5ab8e", pattern: "stripe", patternColor: "#9aa9b0" },
  "Sand Eel": { family: "eel", body: "#c2bf8f", belly: "#e8e5bd", fin: "#a09d6e" },
  Killifish: { family: "minnow", body: "#9aa17e", belly: "#d8dcbc", fin: "#7a8161", pattern: "vbars", patternColor: "#6e7355" },

  // --- Tier 2 fresh ---
  Bluegill: { family: "panfish", body: "#7fae6a", belly: "#e8c78a", fin: "#5d8a4e", pattern: "vbars", patternColor: "#4e6e42", earSpot: true },
  "Yellow Perch": { family: "panfish", body: "#e0b24f", belly: "#f4dfa4", fin: "#c26b3a", pattern: "vbars", patternColor: "#7a6428" },
  Pumpkinseed: { family: "panfish", body: "#e0a85a", belly: "#f4d9a4", fin: "#b57e3c", pattern: "spots", patternColor: "#c96b4a", earSpot: true },
  "Gizzard Shad": { family: "herring", body: "#b9c2c9", belly: "#e9edf0", fin: "#8d99a3", earSpot: true },
  // --- Tier 2 salt ---
  Pinfish: { family: "panfish", body: "#d9c87a", belly: "#f2e8bc", fin: "#b3a052", pattern: "vbars", patternColor: "#8fa0b0" },
  "Atlantic Croaker": { family: "bass", body: "#c9b48a", belly: "#ece0c4", fin: "#a08b60", pattern: "wavy", patternColor: "#8f7a52" },
  Menhaden: { family: "herring", body: "#b9c2c9", belly: "#e9edf0", fin: "#8d99a3", earSpot: true, pattern: "spots", patternColor: "#8d99a3" },
  Sardine: { family: "herring", body: "#c2ccd2", belly: "#eef2f4", fin: "#96a3ab", pattern: "stripe", patternColor: "#7fa0b3" },

  // --- Tier 3 fresh ---
  "Largemouth Bass": { family: "bass", body: "#7a9e5e", belly: "#dfe8c0", fin: "#597a44", pattern: "blotches", patternColor: "#3f5a32" },
  "Smallmouth Bass": { family: "bass", body: "#9a8a55", belly: "#e4dab4", fin: "#77683c", pattern: "vbars", patternColor: "#6e6034" },
  "Brown Trout": { family: "trout", body: "#b08a4f", belly: "#ecd9ae", fin: "#8a6838", pattern: "spots", patternColor: "#7a4a2a" },
  Cisco: { family: "herring", body: "#b7c4cc", belly: "#e9eff2", fin: "#8b9ba5" },
  Alewife: { family: "herring", body: "#c2cdd4", belly: "#eef3f6", fin: "#95a5ae", earSpot: true },
  // --- Tier 3 salt ---
  "Striped Bass": { family: "bass", body: "#8a93a0", belly: "#e3e7ec", fin: "#68717e", pattern: "hlines", patternColor: "#4a525e" },
  Bluefish: { family: "mackerel", body: "#7d9aa6", belly: "#dde8ec", fin: "#5c7a86", },
  "Spanish Mackerel": { family: "mackerel", body: "#6f93a0", belly: "#dce8ec", fin: "#4e7280", pattern: "spots", patternColor: "#d9b45e" },
  "Goggle-eye": { family: "panfish", body: "#b6a25a", belly: "#e8ddb0", fin: "#8f7c3e", bigEye: true },
  "Threadfin Herring": { family: "herring", body: "#c2ccd2", belly: "#eef2f4", fin: "#96a3ab", earSpot: true, pattern: "stripe", patternColor: "#9ab0bc" },

  // --- Tier 4 fresh ---
  Walleye: { family: "trout", body: "#b6a25a", belly: "#eadfb4", fin: "#8f7c3e", pattern: "vbars", patternColor: "#6e6030", bigEye: true },
  "Northern Pike": { family: "pike", body: "#5f8a6b", belly: "#cfe0c4", fin: "#446a4e", pattern: "spots", patternColor: "#d9d9a0" },
  "Channel Catfish": { family: "catfish", body: "#8f8a7d", belly: "#d9d5c9", fin: "#6e6a5e", pattern: "spots", patternColor: "#5e5a4e" },
  "Rainbow Trout": { family: "trout", body: "#c98a8f", belly: "#f2dfe0", fin: "#a06468", pattern: "spots", patternColor: "#5e5a5e" },
  // --- Tier 4 salt ---
  "Red Drum": { family: "bass", body: "#c98a5a", belly: "#f0dcc0", fin: "#a0663c", tailSpot: true },
  Snook: { family: "trout", body: "#b0a98f", belly: "#e9e5d4", fin: "#8a8268", pattern: "stripe", patternColor: "#3a3a32" },
  Cobia: { family: "mackerel", body: "#6e6a5c", belly: "#cfccc0", fin: "#4e4a40", pattern: "stripe", patternColor: "#3a382e" },
  "False Albacore": { family: "tuna", body: "#5a7a8a", belly: "#dae5ea", fin: "#42606e", pattern: "wavy", patternColor: "#3a5560" },

  // --- Tier 5 fresh ---
  Muskellunge: { family: "pike", body: "#6b8290", belly: "#d6e0e4", fin: "#4e6472", pattern: "vbars", patternColor: "#445762" },
  "Lake Trout": { family: "trout", body: "#7d8a82", belly: "#dde3de", fin: "#5c6a62", pattern: "spots", patternColor: "#e0e4d8" },
  "Flathead Catfish": { family: "catfish", body: "#9c8a63", belly: "#e4d9b8", fin: "#7a6a46", pattern: "blotches", patternColor: "#6e5c3a" },
  // --- Tier 5 salt ---
  "Juvenile Tarpon": { family: "herring", body: "#b9c4cc", belly: "#edf1f4", fin: "#8d9ba5", pattern: "scales", patternColor: "#7f909c" },
  "Big Striped Bass": { family: "bass", body: "#8a93a0", belly: "#e3e7ec", fin: "#68717e", pattern: "hlines", patternColor: "#3f4752" },
  "King Mackerel": { family: "mackerel", body: "#6f8a93", belly: "#dce7ea", fin: "#4e6a74", pattern: "wavy", patternColor: "#425962" },

  // --- Tier 6 fresh ---
  "Lake Sturgeon": { family: "sturgeon", body: "#7d93a6", belly: "#dde6ec", fin: "#5c7284", pattern: "scutes", patternColor: "#c2ccd4" },
  "Alligator Gar": { family: "gar", body: "#6f7a5e", belly: "#d4dac2", fin: "#525c42", pattern: "spots", patternColor: "#3f4832" },
  "Bull Catfish": { family: "catfish", body: "#8a7f70", belly: "#d9d2c6", fin: "#6a5f50" },
  // --- Tier 6 salt ---
  "Mahi-Mahi": { family: "mahi", body: "#d9c84f", belly: "#f2ecb0", fin: "#4e9e8e", pattern: "spots", patternColor: "#3f8a7a" },
  Wahoo: { family: "mackerel", body: "#5a7a8a", belly: "#d8e4ea", fin: "#3f5f6e", pattern: "vbars", patternColor: "#3a5666" },
  "Yellowfin Tuna": { family: "tuna", body: "#6f93a0", belly: "#e2ecef", fin: "#e8c94f", pattern: "stripe", patternColor: "#d9c85e" },
  Amberjack: { family: "tuna", body: "#c9b48a", belly: "#eee4cc", fin: "#a08e5e", pattern: "stripe", patternColor: "#8a6a3a" },

  // --- Tier 7 fresh ---
  "Giant Sturgeon": { family: "sturgeon", body: "#8a97a6", belly: "#e2e8ec", fin: "#687684", pattern: "scutes", patternColor: "#cdd6de" },
  "Wels Catfish": { family: "catfish", body: "#6e6a5c", belly: "#cfccc0", fin: "#4e4a40", pattern: "blotches", patternColor: "#3f3c32" },
  Arapaima: { family: "pike", body: "#7a5a5a", belly: "#dcc6c0", fin: "#c25a4e", pattern: "scales", patternColor: "#c2766a" },
  // --- Tier 7 salt ---
  "Bluefin Tuna": { family: "tuna", body: "#5a6e8a", belly: "#dde4ec", fin: "#42526a", pattern: "stripe", patternColor: "#8a9ab0" },
  Sailfish: { family: "billfish", body: "#5a7aa0", belly: "#dbe5ee", fin: "#3e5f8a", sail: true, pattern: "vbars", patternColor: "#8fb0cc" },
  "Goliath Grouper": { family: "grouper", body: "#7a7a5e", belly: "#dcdcc4", fin: "#5c5c44", pattern: "blotches", patternColor: "#4a4a36" },

  // --- Tier 8 fresh ---
  "White Sturgeon": { family: "sturgeon", body: "#b9c4cc", belly: "#eef2f4", fin: "#93a1ab", pattern: "scutes", patternColor: "#e4eaee" },
  "The Lake Warden": { family: "pike", body: "#5a6e72", belly: "#c2d2d4", fin: "#3e5054", pattern: "vbars", patternColor: "#8fb0a8", glowEye: true },
  // --- Tier 8 salt ---
  "Blue Marlin": { family: "billfish", body: "#4a6e9a", belly: "#d7e2ee", fin: "#35507a", pattern: "vbars", patternColor: "#7fa0c2" },
  Swordfish: { family: "billfish", body: "#6a7a8a", belly: "#dee5ea", fin: "#4e5c6a", longBill: true },
  "Giant Bluefin": { family: "tuna", body: "#5a6e8a", belly: "#dde4ec", fin: "#42526a", pattern: "stripe", patternColor: "#96a6bc" },
  "Old Hooktooth": { family: "billfish", body: "#4a5a5e", belly: "#c6d2d4", fin: "#354448", pattern: "blotches", patternColor: "#2c383c", glowEye: true },
};

/** Fallback for a species with no art entry yet: a plain bass in its color. */
function fallbackSpec(color: string): ArtSpec {
  return { family: "bass", body: color, belly: "#eee8d8", fin: color };
}

/**
 * The catch portrait. Junk gets its item drawing; fish get their species art.
 * `color` is the catalog color used only as a fallback tint.
 */
export function CatchArt({ name, color = "#7a9e5e", size = 220 }: { name: string; color?: string; size?: number }) {
  const junk = JUNK_ART[name];
  const spec = FISH_ART[name];
  return (
    <svg width={size} height={(size * 140) / 240} viewBox="0 0 240 140" role="img" aria-label={name}>
      {junk ?? <FishFigure spec={spec ?? fallbackSpec(color)} />}
    </svg>
  );
}

/** True if we have bespoke art for this catch name (fish or junk). */
export function hasCatchArt(name: string): boolean {
  return name in FISH_ART || name in JUNK_ART;
}
