import { useEffect, useRef, useState } from "react";
import GLYPHS from "@/lib/dotsGlyphs.json";
import { createPortal } from "react-dom";
import { createDots } from "@/lib/dotsEngine";

const isMobile = () => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

// Static dots painted by index.html before the app loads; faded out once the live dots take over.
const releaseBoot = (ms) => {
  const b = document.getElementById("boot-dots");
  if (!b) return;
  b.id = "";
  b.style.transition = `opacity ${ms}ms linear`;
  b.style.opacity = "0";
  setTimeout(() => b.parentNode?.removeChild(b), ms + 50);
};

const G = GLYPHS.glyphs;
const X0 = Math.min(...G.map((g) => g.x + g.bounds[0])), X1 = Math.max(...G.map((g) => g.x + g.bounds[2]));
const Y0 = Math.min(...G.map((g) => g.bounds[1])), Y1 = Math.max(...G.map((g) => g.bounds[3]));

// The same wordmark the dots form, as a vector in the page.
const WordSvg = ({ show }) => (
  <svg viewBox={`${X0} ${-Y1} ${X1 - X0} ${Y1 - Y0}`} className={`absolute inset-0 h-full w-full ${show ? "" : "invisible"}`} aria-hidden="true" data-testid="logo-dots-final">
    <g transform="scale(1,-1)" fill="#1a2937">
      {G.map((g, i) => <path key={i} d={g.d} transform={`translate(${g.x},0)`} />)}
    </g>
  </svg>
);

const StaticLogo = () => (
  <h1 data-testid="logo-static" className="text-[58px] font-semibold leading-none tracking-tight text-[#1A2838]">Assemble</h1>
);

// Full-page dot swirl that lands as the wordmark inside the slot; replays on hover. Desktop only.
const DotsLogo = () => {
  const canvas = useRef(null);
  const slot = useRef(null);
  const engine = useRef(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const target = () => {
      const r = slot.current.getBoundingClientRect();
      return { x: r.left, w: r.width, cy: r.top + r.height / 2 };
    };
    const ro = new ResizeObserver(() => engine.current?.redraw());
    // Deferred so the page paints first and a strict-mode remount never builds it twice.
    const id = setTimeout(() => {
      engine.current = createDots(canvas.current, target, setSettled);
      releaseBoot(engine.current.fadeMs);
      ro.observe(slot.current);
    }, 0);
    return () => { clearTimeout(id); ro.disconnect(); engine.current?.destroy(); engine.current = null; };
  }, []);

  return (
    <>
      {createPortal(<canvas ref={canvas} aria-hidden="true" data-testid="logo-dots-canvas" className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" />, document.body)}
      <h1
        ref={slot}
        onMouseEnter={() => engine.current?.replay()}
        data-testid="logo-dots-slot"
        className="relative z-10 aspect-[4061/748] w-[271px] cursor-default select-none lg:w-[325px]"
      >
        <WordSvg show={settled} />
        <span className="sr-only">Assemble</span>
      </h1>
    </>
  );
};

export const LogoDots = () => (isMobile() ? <StaticLogo /> : <DotsLogo />);

export const dropBootDots = () => releaseBoot(0);
