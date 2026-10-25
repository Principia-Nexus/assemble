import { useEffect, useRef } from "react";
import { createDots } from "@/lib/dotsEngine";

const isMobile = () => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

const StaticLogo = () => (
  <h1 data-testid="logo-static" className="text-[58px] font-semibold leading-none tracking-tight text-[#1A2838]">Assemble</h1>
);

// Full-page dot swirl that lands as the wordmark inside the slot; replays on hover. Desktop only.
const DotsLogo = () => {
  const canvas = useRef(null);
  const slot = useRef(null);
  const engine = useRef(null);

  useEffect(() => {
    const target = () => {
      const r = slot.current.getBoundingClientRect();
      return { x: r.left, w: r.width, cy: r.top + r.height / 2 };
    };
    const ro = new ResizeObserver(() => engine.current?.redraw());
    // Deferred so the page paints first and a strict-mode remount never builds it twice.
    const id = setTimeout(() => {
      engine.current = createDots(canvas.current, target);
      ro.observe(slot.current);
    }, 450);
    return () => { clearTimeout(id); ro.disconnect(); engine.current?.destroy(); engine.current = null; };
  }, []);

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" data-testid="logo-dots-canvas" className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" />
      <h1
        ref={slot}
        onMouseEnter={() => engine.current?.replay()}
        data-testid="logo-dots-slot"
        className="relative z-10 aspect-[4061/748] w-[271px] cursor-default select-none lg:w-[325px]"
      >
        <span className="sr-only">Assemble</span>
      </h1>
    </>
  );
};

export const LogoDots = () => (isMobile() ? <StaticLogo /> : <DotsLogo />);
