'use client';

import { useEffect, useRef, CSSProperties, ReactNode } from 'react';

interface ElectricBorderProps {
  children: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  thickness?: number;
  style?: CSSProperties;
  className?: string;
}

export default function ElectricBorder({
  children,
  color = '#7df9ff',
  speed = 1,
  chaos = 0.12,
  thickness = 2,
  style,
  className,
}: ElectricBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };

    const drawJaggedLine = (
      x1: number, y1: number,
      x2: number, y2: number,
      t: number
    ) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const segs = Math.max(Math.floor(len / 18), 2);
      const dx = x2 - x1, dy = y2 - y1;
      const nx = -dy / len, ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segs; i++) {
        const p = i / segs;
        const bx = x1 + dx * p;
        const by = y1 + dy * p;
        const wave = Math.sin(t * speed * 3 + i * 1.7) * 0.5 +
                     Math.sin(t * speed * 7 + i * 2.9) * 0.3 +
                     (Math.random() - 0.5) * 0.4;
        const offset = wave * chaos * len;
        ctx.lineTo(bx + nx * offset, by + ny * offset);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Base glow border
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness * 0.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      // Electric lines
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = thickness;
      ctx.shadowBlur = 16;

      drawJaggedLine(0, 0, w, 0, time);         // top
      drawJaggedLine(w, 0, w, h, time + 1.2);   // right
      drawJaggedLine(w, h, 0, h, time + 2.4);   // bottom
      drawJaggedLine(0, h, 0, 0, time + 3.6);   // left

      // Bright inner line
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = thickness * 0.4;
      ctx.shadowBlur = 6;
      drawJaggedLine(0, 0, w, 0, time + 0.5);
      drawJaggedLine(w, 0, w, h, time + 1.7);
      drawJaggedLine(w, h, 0, h, time + 2.9);
      drawJaggedLine(0, h, 0, 0, time + 4.1);

      ctx.globalAlpha = 1;
      time += 0.04 * speed;
      animId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [color, speed, chaos, thickness]);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }} className={className}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  );
}
