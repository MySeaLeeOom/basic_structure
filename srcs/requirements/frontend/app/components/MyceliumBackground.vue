<template>
  <canvas ref="canvas" class="absolute inset-0 w-full h-full" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animId: number;

const COLORS_DARK = [
  'rgba(107, 148, 116,',
  'rgba(168, 194, 175,',
  'rgba(212, 184, 150,',
  'rgba(180, 160, 130,',
  'rgba(200, 200, 190,',
];

const COLORS_LIGHT = [
  'rgba(60, 100, 70,',
  'rgba(80, 130, 90,',
  'rgba(150, 110, 60,',
  'rgba(120, 100, 70,',
  'rgba(100, 110, 90,',
];

type Cell = {
  x: number;
  y: number;
  rings: { radius: number; dotCount: number; colorIdx: number; offset: number }[];
  phase: number;
  speed: number;
  scale: number;
};

type Thread = {
  dots: { x: number; y: number }[];
  colorIdx: number;
  interval: number; // seconds between each dot appearing
  startAt: number;  // seconds before this thread begins growing
};

function makeCell(w: number, h: number): Cell {
  const ringCount = 2 + Math.floor(Math.random() * 2);
  const rings = Array.from({ length: ringCount }, (_, i) => ({
    radius: 14 + i * 16 + Math.random() * 6,
    dotCount: 16 + i * 8,
    colorIdx: Math.floor(Math.random() * COLORS_DARK.length),
    offset: Math.random() * Math.PI * 2,
  }));
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    rings,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0003 + Math.random() * 0.0003,
    scale: 0.5 + Math.random() * 0.8,
  };
}

function makeThreads(cells: Cell[]): Thread[] {
  const threads: Thread[] = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (Math.random() > 0.65) continue;
      const ci = cells[i], cj = cells[j];
      const mx = (ci.x + cj.x) / 2;
      const my = (ci.y + cj.y) / 2;
      const dx = cj.x - ci.x;
      const dy = cj.y - ci.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;
      const bend = (Math.random() - 0.5) * Math.min(len * 0.4, 100);
      const cpx = mx + nx * bend;
      const cpy = my + ny * bend;

      // Pre-compute dot positions along the bezier, with slight organic jitter
      const dotCount = Math.max(12, Math.floor(len / 12));
      const dots = Array.from({ length: dotCount }, (_, k) => {
        const t = k / (dotCount - 1);
        return {
          x: (1-t)*(1-t)*ci.x + 2*(1-t)*t*cpx + t*t*cj.x + (Math.random()-0.5)*2.5,
          y: (1-t)*(1-t)*ci.y + 2*(1-t)*t*cpy + t*t*cj.y + (Math.random()-0.5)*2.5,
        };
      });

      threads.push({
        dots,
        colorIdx: Math.floor(Math.random() * COLORS_DARK.length),
        interval: 0.09 + Math.random() * 0.13,
        startAt: Math.random() * 10,
      });
    }
  }
  return threads;
}

const FPS = 30;
const INTERVAL = 1000 / FPS;
let lastFrame = 0;

function draw(ctx: CanvasRenderingContext2D, cells: Cell[], threads: Thread[], ts: number, dark: boolean) {
  const { width: w, height: h } = ctx.canvas;
  const colors = dark ? COLORS_DARK : COLORS_LIGHT;
  ctx.clearRect(0, 0, w, h);

  // Orbital rings
  for (const cell of cells) {
    const pulse = 0.88 + 0.12 * Math.sin(ts * cell.speed * 1000 + cell.phase);
    for (const ring of cell.rings) {
      const r = ring.radius * cell.scale * pulse;
      const color = colors[ring.colorIdx];
      for (let i = 0; i < ring.dotCount; i++) {
        const angle = ring.offset + (i / ring.dotCount) * Math.PI * 2 + ts * cell.speed;
        const dx = cell.x + Math.cos(angle) * r;
        const dy = cell.y + Math.sin(angle) * r;
        const dotR = Math.max((2.0 - ring.radius / 70) * cell.scale * pulse, 0.5);
        const alphaMod = (Math.sin(angle * 2 + ts * cell.speed * 3) + 1) / 2;
        const alpha = dark ? 0.10 + 0.20 * alphaMod : 0.18 + 0.22 * alphaMod;
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${alpha})`;
        ctx.fill();
      }
    }
  }

  // Growing threads — dots appear one at a time and stay
  for (const thread of threads) {
    const elapsed = ts - thread.startAt;
    if (elapsed < 0) continue;
    const visible = Math.min(Math.floor(elapsed / thread.interval), thread.dots.length);
    const color = colors[thread.colorIdx];
    const baseAlpha = dark ? 0.52 : 0.45;

    for (let k = 0; k < visible; k++) {
      const dotAge = elapsed - k * thread.interval;
      const fadeIn = Math.min(dotAge / 0.35, 1); // fade in over 350ms
      ctx.beginPath();
      ctx.arc(thread.dots[k].x, thread.dots[k].y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${baseAlpha * fadeIn})`;
      ctx.fill();
    }
  }
}

onMounted(() => {
  const el = canvas.value!;
  const ctx = el.getContext('2d')!;

  const resize = () => {
    el.width = el.offsetWidth;
    el.height = el.offsetHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const cells: Cell[] = Array.from({ length: 6 }, () => makeCell(el.width, el.height));
  const threads: Thread[] = makeThreads(cells);

  const loop = (ts: number) => {
    animId = requestAnimationFrame(loop);
    if (ts - lastFrame < INTERVAL) return;
    lastFrame = ts;
    const dark = document.documentElement.classList.contains('dark');
    draw(ctx, cells, threads, ts / 1000, dark);
  };
  animId = requestAnimationFrame(loop);

  onUnmounted(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  });
});
</script>
