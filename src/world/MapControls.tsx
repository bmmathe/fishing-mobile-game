import type { ComponentProps } from "react";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH } from "three";

type MapControlsProps = Omit<
  ComponentProps<typeof OrbitControls>,
  "enableRotate" | "enablePan" | "screenSpacePanning" | "mouseButtons" | "touches"
>;

/** Drag/touch pans the map; pinch or scroll still zooms. No orbit rotation. */
export function MapOrbitControls(props: MapControlsProps) {
  return (
    <OrbitControls
      enableRotate={false}
      enablePan
      screenSpacePanning
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      {...props}
    />
  );
}
