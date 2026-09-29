"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; radius: number; phase: number; speed: number; drift: number; tone: number };

const tones = [
  [64, 72, 82],   // charcoal gray
  [94, 104, 115], // slate gray
  [132, 142, 152],
  [176, 184, 192],
  [225, 229, 233], // silver
];

export default function GrayParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !parent || !context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, particles: Particle[] = [], frame = 0, visible = false;
    let lastFrame = 0;
    // Repeatable layout avoids a noticeable jump when an invitation is reopened.
    const random = (seed: number) => {
      const n = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, parent.offsetHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      const count = Math.min(650, Math.max(110, Math.round(width * height / 4100)));
      particles = Array.from({ length: count }, (_, i) => ({
        x: random(i * 7 + 1) * width,
        y: random(i * 7 + 2) * height,
        radius: random(i * 7 + 3) > .94 ? 2.1 + random(i * 7 + 4) * 1.7 : .55 + random(i * 7 + 4) * 1.1,
        phase: random(i * 7 + 5) * Math.PI * 2,
        speed: .45 + random(i * 7 + 6) * 1.2,
        drift: 1.5 + random(i * 7 + 7) * 8,
        tone: Math.floor(random(i * 7 + 8) * tones.length),
      }));
      draw(0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const t = time / 1000;
      for (const particle of particles) {
        const pulse = (Math.sin(t * particle.speed * 2 + particle.phase) + 1) / 2;
        const shade = tones[(particle.tone + Math.floor((t + particle.phase) / 5)) % tones.length];
        const x = particle.x + Math.sin(t * .31 + particle.phase) * particle.drift;
        const y = particle.y + Math.cos(t * .23 + particle.phase) * particle.drift;
        const alpha = .24 + pulse * .55;
        const halo = context.createRadialGradient(x, y, 0, x, y, particle.radius * 5);
        halo.addColorStop(0, `rgba(${shade.join(",")},${alpha})`);
        halo.addColorStop(.22, `rgba(${shade.join(",")},${alpha * .35})`);
        halo.addColorStop(1, `rgba(${shade.join(",")},0)`);
        context.fillStyle = halo;
        context.beginPath();
        context.arc(x, y, particle.radius * 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `rgba(${shade.join(",")},${Math.min(1, alpha + .12)})`;
        context.beginPath();
        context.arc(x, y, particle.radius * (.65 + pulse * .35), 0, Math.PI * 2);
        context.fill();
      }
    };

    const tick = (time: number) => {
      if (!visible || document.hidden || motion.matches) return;
      if (time - lastFrame >= 32) { draw(time); lastFrame = time; }
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
      else draw(0);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(parent);
    resizeObserver.observe(parent);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return <canvas ref={canvasRef} className="gray-particle-field" aria-hidden="true" />;
}
