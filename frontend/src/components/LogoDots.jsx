import { useEffect, useRef } from "react";
import { createDots } from "@/lib/dotsEngine";

// Full-page dot swirl that lands as the wordmark inside the slot; replays on hover/tap.
export const LogoDots = () => {
  const canvas = useRef(null);
  const slot = useRef(null);
  const engine = useRef(null);

  useEffect(() => {
    const target = () => {
      const r = slot.current.getBoundingClientRect();
      return { x: r.left, w: r.width, cy: r.top + r.height / 2 };
    };
    engine.current = createDots(canvas.current, target);
    const ro = new ResizeObserver(() => engine.current?.redraw());
    ro.observe(slot.current);
    return () => { ro.disconnect(); engine.current?.destroy(); };
  }, []);

  const replay = () => engine.current?.replay();

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" data-testid="logo-dots-canvas" className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" />
      <h1
        ref={slot}
        onMouseEnter={replay}
        onClick={replay}
        data-testid="logo-dots-slot"
        className="relative z-10 aspect-[4061/748] w-[217px] cursor-default select-none sm:w-[271px] lg:w-[325px]"
      >
        <span className="sr-only">Assemble</span>
      </h1>
    </>
  );
};
