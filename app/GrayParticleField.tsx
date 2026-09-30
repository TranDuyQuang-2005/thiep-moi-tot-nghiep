"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; size: number; phase: number; speed: number; drift: number; tone: number };

const tones = [
  [174, 190, 208],
  [187, 202, 218],
  [202, 215, 228],
  [215, 226, 236],
  [231, 239, 246],
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
    const startedAt = performance.now();
    // Cache soft glows instead of creating thousands of gradients every frame.
    const glows = tones.map((shade) => [0, 1, 2].map((size) => {
      const radius = [5, 8, 13][size];
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = radius * 2;
      const painter = sprite.getContext("2d")!;
      const glow = painter.createRadialGradient(radius, radius, 0, radius, radius, radius);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(.12, `rgba(${shade.join(",")},.98)`);
      glow.addColorStop(.29, "rgba(247,251,255,.86)");
      glow.addColorStop(.55, `rgba(${shade.join(",")},.26)`);
      glow.addColorStop(1, `rgba(${shade.join(",")},0)`);
      painter.fillStyle = glow;
      painter.fillRect(0, 0, sprite.width, sprite.height);
      if (size > 0) {
        painter.strokeStyle = "rgba(255,255,255,.82)";
        painter.lineWidth = size === 2 ? .9 : .6;
        painter.beginPath();
        painter.moveTo(radius, radius * .28);
        painter.lineTo(radius, radius * 1.72);
        painter.moveTo(radius * .28, radius);
        painter.lineTo(radius * 1.72, radius);
        painter.stroke();
      }
      return sprite;
    }));
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
      const count = Math.min(1600, Math.max(240, Math.round(width * height / 1350)));
      particles = Array.from({ length: count }, (_, i) => ({
        x: random(i * 7 + 1) * width,
        y: random(i * 7 + 2) * height,
        size: random(i * 7 + 3) > .94 ? 2 : random(i * 7 + 4) > .68 ? 1 : 0,
        phase: random(i * 7 + 5) * Math.PI * 2,
        speed: 22 + random(i * 7 + 6) * 36,
        drift: 3 + random(i * 7 + 7) * 11,
        tone: Math.floor(random(i * 7 + 8) * tones.length),
      }));
      draw(0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const t = Math.max(0, time - startedAt) / 1000;
      for (const particle of particles) {
        const pulse = (Math.sin(t * (1.4 + particle.tone * .19) + particle.phase) + 1) / 2;
        const tone = (particle.tone + Math.floor((t + particle.phase) / 6)) % tones.length;
        const x = particle.x + Math.sin(t * .7 + particle.phase) * particle.drift;
        // A steady fall; each particle returns above the top after leaving the bottom.
        const y = (particle.y + t * particle.speed) % (height + 28) - 14;
        const sprite = glows[tone][particle.size];
        context.globalAlpha = .5 + pulse * .5;
        context.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
      }
      context.globalAlpha = 1;
    };

    const tick = (time: number) => {
      if (!visible || document.hidden || motion.matches) return;
      if (time - lastFrame >= 40) { draw(time); lastFrame = time; }
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
