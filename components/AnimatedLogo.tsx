"use client";
import { useEffect, useRef } from "react";

// Animated Podium logo: a CSS "Podıum" wordmark in Sora, with a red dot that drops in
// from above the "P", bounces across P-o-d, and settles as the dot of the "ı". Geometry
// is measured from the rendered letters, so it adapts to the `size` (word font px) —
// compact in the nav, larger on login. Replays every 15s; respects reduced-motion
// (dot just rests on the "i").
export default function AnimatedLogo({ size = 30, slogan = true, className = "" }: { size?: number; slogan?: boolean; className?: string }) {
  const wordRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const pRef = useRef<HTMLSpanElement>(null);
  const oRef = useRef<HTMLSpanElement>(null);
  const dRef = useRef<HTMLSpanElement>(null);
  const iRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fs = size;
    const word = wordRef.current, dot = dotRef.current;
    const P = pRef.current, o = oRef.current, d = dRef.current, i = iRef.current;
    if (!word || !dot || !P || !o || !d || !i) return;

    let anim: Animation | null = null;
    let r = 0;
    let pts: { x: number; y: number }[] = [];
    let apex: number[] = [];

    const build = () => {
      const dia = Math.max(4, Math.round(0.28 * fs));
      dot.style.width = dia + "px"; dot.style.height = dia + "px"; r = dia / 2;
      const br = word.getBoundingClientRect();
      const cx = (el: Element) => { const x = el.getBoundingClientRect(); return x.left - br.left + x.width / 2; };
      const top = (el: Element) => el.getBoundingClientRect().top - br.top;
      const targets = [
        { x: cx(P), y: top(P) + 0.16 * fs - r },
        { x: cx(o), y: top(o) + 0.34 * fs - r },
        { x: cx(d), y: top(d) + 0.16 * fs - r },
      ];
      const tittle = { x: cx(i), y: top(i) - 0.07 * fs };
      // Dot drops in from just above the "P" (no globe to launch from anymore).
      const start = { x: cx(P), y: top(P) - 0.8 * fs };
      pts = [start, ...targets, tittle];
      apex = [0, fs * 0.5, fs * 0.45, fs * 0.55, fs * 0.42];
    };

    const frames = (): Keyframe[] => {
      const segs = pts.length - 1, steps = 16;
      const out: { x: number; y: number; off: number }[] = [];
      for (let seg = 0; seg < segs; seg++) {
        const a = pts[seg], b = pts[seg + 1], ah = apex[seg + 1] || fs * 0.5;
        for (let s = seg > 0 ? 1 : 0; s <= steps; s++) {
          const t = s / steps;
          out.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t - ah * Math.sin(Math.PI * t),
            off: (seg + t) / segs,
          });
        }
      }
      return out.map((f) => ({
        transform: `translate(${f.x - r}px, ${f.y - r}px)`,
        opacity: 1,
        offset: Math.min(1, Math.max(0, f.off)),
      }));
    };

    const run = () => {
      build();
      if (anim) anim.cancel();
      dot.style.opacity = "1";
      anim = dot.animate(frames(), { duration: 2200, easing: "linear", fill: "forwards" });
    };

    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const startup = () => {
      if (cancelled) return;
      if (reduce) {
        build();
        const last = frames().slice(-1)[0];
        dot.style.opacity = "1";
        if (last && typeof last.transform === "string") dot.style.transform = last.transform;
        return;
      }
      run();
      timer = setInterval(run, 15000);
    };

    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) fonts.ready.then(startup); else setTimeout(startup, 300);

    const onResize = () => build();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      if (anim) anim.cancel();
      if (timer) clearInterval(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [size]);

  const sloganPx = Math.max(7, Math.round(size * 0.2));
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="flex flex-col" style={{ gap: Math.max(2, Math.round(size * 0.06)) }}>
        <span ref={wordRef} className="relative inline-flex font-display font-extrabold leading-none"
          style={{ fontSize: size, letterSpacing: "-0.03em", paddingTop: Math.round(size * 0.1) }}>
          <span ref={pRef} style={{ color: "#e8211a" }}>P</span>
          <span ref={oRef} style={{ color: "#e8211a" }}>o</span>
          <span ref={dRef} style={{ color: "#1a46c0" }}>d</span>
          <span ref={iRef} style={{ color: "#1a46c0" }}>{"ı"}</span>
          <span style={{ color: "#1a46c0" }}>u</span>
          <span style={{ color: "#1a46c0" }}>m</span>
          <span ref={dotRef} aria-hidden style={{ position: "absolute", left: 0, top: 0, borderRadius: "50%", background: "#e8211a", opacity: 0, willChange: "transform" }} />
        </span>
        {slogan && (
          <span className="uppercase text-muted" style={{ fontSize: sloganPx, letterSpacing: "0.18em", lineHeight: 1.3 }}>from Conglomerate Corporates</span>
        )}
      </span>
      <span className="sr-only">Podium</span>
    </span>
  );
}
