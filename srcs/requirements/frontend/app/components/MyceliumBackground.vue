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
  startAt: number;
};

function makeCell(w: number, h: number): Cell {
  const ringCount = 1 + Math.floor(Math.random() * 4);
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

// Random walk starting at (sx, sy), gently pulled toward canvas center
function makeWalk(sx: number, sy: number, w: number, h: number): { x: number; y: number }[] {
  const cx = w / 2, cy = h / 2;
  const dots: { x: number; y: number }[] = [];
  let x = sx, y = sy;
  let angle = Math.random() * Math.PI * 2;

  for (let i = 0; i < 700; i++) {
    // Angle toward center
    const toCenterAngle = Math.atan2(cy - y, cx - x);
    let diff = toCenterAngle - angle;
    // Normalize diff to [-π, π]
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    // Blend: center pull + organic random wander
    angle += diff * 0.05 + (Math.random() - 0.5) * 0.75;

    const step = 9 + Math.random() * 5;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;

    // Soft boundary reflection
    if (x < 20)      { x = 20;      angle = Math.PI - angle; }
    if (x > w - 20)  { x = w - 20;  angle = Math.PI - angle; }
    if (y < 20)      { y = 20;      angle = -angle; }
    if (y > h - 20)  { y = h - 20;  angle = -angle; }

    dots.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
  }
  return dots;
}

function makeThreads(cells: Cell[], w: number, h: number): Thread[] {
  const threads: Thread[] = [];
  let cursor = 1; // seconds; first thread starts after 1s
  for (const cell of cells) {
    const perCell = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < perCell; k++) {
      const exitAngle = Math.random() * Math.PI * 2;
      const exitR = 20 + Math.random() * 15;
      threads.push({
        dots: makeWalk(
          cell.x + Math.cos(exitAngle) * exitR,
          cell.y + Math.sin(exitAngle) * exitR,
          w, h,
        ),
        colorIdx: Math.floor(Math.random() * COLORS_DARK.length),
        interval: 0.08 + Math.random() * 0.12,
        startAt: cursor,
      });
      cursor += 2.5 + Math.random() * 2; // next thread starts 2.5–4.5s later
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

  // Growing threads
  for (const thread of threads) {
    const elapsed = ts - thread.startAt;
    if (elapsed < 0) continue;
    const visible = Math.min(Math.floor(elapsed / thread.interval), thread.dots.length);
    const color = colors[thread.colorIdx];
    const baseAlpha = dark ? 0.14 : 0.11;

    for (let k = 0; k < visible; k++) {
      const dotAge = elapsed - k * thread.interval;
      const fadeIn = Math.min(dotAge / 0.4, 1);
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
  const threads: Thread[] = makeThreads(cells, el.width, el.height);

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
