import { useEffect, useRef } from 'react';
import { TOTAL_BALLS, letterFor, type Letter } from './game';

export type LightShow = 'idle' | 'hurry' | 'draw' | 'win' | 'lose';

const SPIN_MS = 1500;
const FILLERS = 14;

const COL: Record<Letter, string> = { B: '#4c8dff', I: '#ff3f7f', N: '#b9b2e6', G: '#2fd68a', O: '#ffa62b' };
const BULB_COLORS = ['#ffd34d', '#ffd34d', '#ff4fa3', '#49e3ff'];
const WIN = '#34e3a0';
const LOSE = '#ff5f87';
const DISPLAY_FONT = "'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  color: string;
  life: number;
  coin: boolean;
}

/** Round info drawn over the canvas. */
export interface Hud {
  round: number;
  /** Seconds left to bet, or null outside the betting window. */
  secondsLeft: number | null;
  /** 1 at the start of the betting window, 0 when it closes. */
  progress: number;
  label: string;
}

interface Scene {
  hud: Hud;
  ball: number | null;
  strip: (number | null)[];
  spinStart: number | null;
  show: LightShow;
  showStart: number;
  particles: Particle[];
  onDone: () => void;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Points evenly spaced clockwise around a rounded rectangle, starting top-left. */
function bulbPoints(x: number, y: number, w: number, h: number, r: number, gap: number) {
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI / 2) * r;
  // Each segment maps a distance along it to a point.
  const segments: [number, (d: number) => [number, number]][] = [
    [sw, (d) => [x + r + d, y]],
    [arc, (d) => corner(x + w - r, y + r, -Math.PI / 2 + d / r)],
    [sh, (d) => [x + w, y + r + d]],
    [arc, (d) => corner(x + w - r, y + h - r, d / r)],
    [sw, (d) => [x + w - r - d, y + h]],
    [arc, (d) => corner(x + r, y + h - r, Math.PI / 2 + d / r)],
    [sh, (d) => [x, y + h - r - d]],
    [arc, (d) => corner(x + r, y + r, Math.PI + d / r)],
  ];
  function corner(cx: number, cy: number, a: number): [number, number] {
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  const total = segments.reduce((sum, [len]) => sum + len, 0);
  const n = Math.max(12, Math.round(total / gap));
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total;
    for (const [len, at] of segments) {
      if (d <= len) {
        pts.push(at(d));
        break;
      }
      d -= len;
    }
  }
  return pts;
}

function drawBall(ctx: CanvasRenderingContext2D, n: number | null, cx: number, cy: number, R: number, glow: boolean) {
  const color = n === null ? '#3a2f6e' : COL[letterFor(n)];
  ctx.save();
  if (glow && n !== null) {
    ctx.shadowColor = color;
    ctx.shadowBlur = R * 0.6;
  }
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, color);
  g.addColorStop(0.75, color);
  g.addColorStop(1, '#140b2e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // White face
  const f = R * 0.62;
  const fg = ctx.createRadialGradient(cx - f * 0.3, cy - f * 0.3, f * 0.1, cx, cy, f);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(1, '#e7e2f5');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx, cy, f, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (n === null) {
    ctx.fillStyle = '#8a80b3';
    ctx.font = `${R * 0.7}px ${DISPLAY_FONT}`;
    ctx.fillText('?', cx, cy + R * 0.04);
  } else {
    ctx.fillStyle = color;
    ctx.font = `${R * 0.26}px ${DISPLAY_FONT}`;
    ctx.fillText(letterFor(n), cx, cy - f * 0.55);
    ctx.fillStyle = '#1a1433';
    ctx.font = `${R * 0.62}px ${DISPLAY_FONT}`;
    ctx.fillText(String(n), cx, cy + f * 0.18);
  }

  // Gloss highlight
  const hg = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.55, 0, cx - R * 0.45, cy - R * 0.55, R * 0.45);
  hg.addColorStop(0, 'rgba(255,255,255,.75)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Live badge with round number on the left, countdown ring on the right, both straddling the frame's top edge. */
function drawHud(ctx: CanvasRenderingContext2D, hud: Hud, W: number, fy: number, t: number, still: boolean) {
  ctx.save();
  ctx.textBaseline = 'middle';
  const h = 26;
  const y = fy - h / 2;

  // LIVE · Round N
  ctx.font = `800 12px Rubik, system-ui, sans-serif`;
  const roundText = `Round ${hud.round}`;
  const liveW = ctx.measureText('LIVE').width;
  ctx.font = `600 12px Rubik, system-ui, sans-serif`;
  const roundW = ctx.measureText(roundText).width;
  const pw = 12 + 8 + 6 + liveW + 10 + roundW + 12;
  const px = 24;
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 10;
  pill(ctx, px, y, pw, h, '#120e28', 'rgba(255,95,135,.55)');
  ctx.shadowBlur = 0;
  const blink = still ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(t * 2.6));
  ctx.fillStyle = `rgba(255,95,135,${blink})`;
  ctx.shadowColor = '#ff5f87';
  ctx.shadowBlur = 8 * blink;
  ctx.beginPath();
  ctx.arc(px + 12 + 4, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff5f87';
  ctx.font = `800 12px Rubik, system-ui, sans-serif`;
  ctx.fillText('LIVE', px + 12 + 8 + 6, y + h / 2 + 0.5);
  ctx.fillStyle = '#c9c2ec';
  ctx.font = `600 12px Rubik, system-ui, sans-serif`;
  ctx.fillText(roundText, px + 12 + 8 + 6 + liveW + 10, y + h / 2 + 0.5);

  // Countdown ring
  const R = 24;
  const cx = W - 24 - R;
  const cy = fy;
  const hurry = hud.secondsLeft !== null && hud.secondsLeft <= 5;
  const accent = hurry ? '#ffd34d' : '#49e3ff';
  const pulse = hurry && !still ? 1 + 0.08 * Math.abs(Math.sin(t * Math.PI * 2)) : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = hurry ? '#ffd34d' : 'rgba(0,0,0,.5)';
  ctx.shadowBlur = hurry ? 18 : 10;
  ctx.fillStyle = '#120e28';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.beginPath();
  ctx.arc(0, 0, R - 4, 0, Math.PI * 2);
  ctx.stroke();
  if (hud.secondsLeft !== null) {
    ctx.strokeStyle = accent;
    ctx.lineCap = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, R - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, hud.progress));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = hud.secondsLeft !== null ? (hurry ? '#ffd34d' : '#ffffff') : '#c9c2ec';
  if (hud.secondsLeft !== null) {
    ctx.font = `20px ${DISPLAY_FONT}`;
    ctx.fillText(String(hud.secondsLeft), 0, 1);
  } else {
    ctx.font = `700 9px Rubik, system-ui, sans-serif`;
    ctx.fillText(hud.label, 0, 1);
  }
  ctx.restore();
  ctx.restore();
}

function burst(scene: Scene, cx: number, cy: number) {
  const colors = ['#ffd34d', '#34e3a0', '#ff4fa3', '#49e3ff', '#ffffff'];
  for (let k = 0; k < 70; k++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 6;
    const coin = k % 3 === 0;
    scene.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3,
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      size: coin ? 7 + Math.random() * 3 : 4 + Math.random() * 4,
      color: coin ? '#ffd34d' : colors[k % colors.length],
      life: 1,
      coin,
    });
  }
}

/**
 * The ball stage, drawn on a canvas: a frame of light bulbs, a reel that
 * slides numbers up onto each new ball, light rays behind the ball and a coin
 * burst on wins. Everything else on the page stays as regular HTML.
 */
export function GameCanvas({
  target,
  spinKey,
  show,
  hud,
  onDone,
}: {
  target: number | null;
  spinKey: number;
  show: LightShow;
  hud: Hud;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene>({
    hud,
    ball: target,
    strip: [target],
    spinStart: null,
    show,
    showStart: 0,
    particles: [],
    onDone,
  });
  scene.current.onDone = onDone;
  scene.current.hud = hud;

  // New draw: build the strip from the old ball up to the new one.
  useEffect(() => {
    const s = scene.current;
    if (spinKey === 0 || target === null) {
      s.ball = target;
      return;
    }
    if (reducedMotion()) {
      s.ball = target;
      s.strip = [target];
      s.onDone();
      return;
    }
    const fillers = Array.from({ length: FILLERS }, () => 1 + Math.floor(Math.random() * TOTAL_BALLS));
    s.strip = [s.ball, ...fillers, target];
    s.ball = target;
    s.spinStart = performance.now();
  }, [target, spinKey]);

  useEffect(() => {
    const s = scene.current;
    if (s.show === show) return;
    s.show = show;
    s.showStart = performance.now();
    if (show === 'win' && !reducedMotion()) {
      const c = canvasRef.current;
      if (c) burst(s, c.clientWidth / 2, c.clientHeight / 2);
    }
  }, [show]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = reducedMotion();
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const s = scene.current;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const t = still ? 0 : now / 1000;
      const sinceShow = (now - s.showStart) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Shake on a loss
      let shake = 0;
      if (s.show === 'lose' && sinceShow < 0.45 && !still)
        shake = Math.sin(sinceShow * 60) * 6 * (1 - sinceShow / 0.45);
      ctx.save();
      ctx.translate(shake, 0);

      // Frame (extra room on top for the live badge and countdown)
      const m = 12;
      const top = 30;
      const fx = m;
      const fy = top;
      const fw = W - 2 * m;
      const fh = H - top - m;
      const fr = Math.min(fw, fh) * 0.16;
      const glowColor = s.show === 'win' ? WIN : s.show === 'lose' ? LOSE : s.show === 'draw' ? '#ffd34d' : '#ff4fa3';
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = s.show === 'idle' ? 18 : 34;
      const frameGrad = ctx.createLinearGradient(0, fy, 0, fy + fh);
      frameGrad.addColorStop(0, '#4a37a8');
      frameGrad.addColorStop(1, '#1b1442');
      ctx.fillStyle = frameGrad;
      roundRect(ctx, fx, fy, fw, fh, fr);
      ctx.fill();
      ctx.restore();

      // Window
      const wi = 26;
      const wx = fx + wi;
      const wy = fy + wi;
      const ww = fw - 2 * wi;
      const wh = fh - 2 * wi;
      const wr = fr * 0.6;
      const cx = wx + ww / 2;
      const cy = wy + wh / 2;
      ctx.save();
      roundRect(ctx, wx, wy, ww, wh, wr);
      ctx.clip();
      const bg = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, Math.max(ww, wh) * 0.75);
      bg.addColorStop(0, '#2f2370');
      bg.addColorStop(1, '#0c0a1d');
      ctx.fillStyle = bg;
      ctx.fillRect(wx, wy, ww, wh);

      const spinning = s.spinStart !== null;
      const restColor = s.ball === null ? '#ffffff' : COL[letterFor(s.ball)];

      // Sunburst rays behind the resting ball
      if (!spinning && s.ball !== null) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.25);
        const rays = 16;
        const rayLen = Math.max(ww, wh);
        ctx.globalAlpha = s.show === 'win' ? 0.4 : 0.2;
        ctx.fillStyle = s.show === 'win' ? WIN : restColor;
        for (let k = 0; k < rays; k++) {
          ctx.rotate((Math.PI * 2) / rays);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(rayLen, -rayLen * 0.12);
          ctx.lineTo(rayLen, rayLen * 0.12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(ww, wh) * 0.55);
        halo.addColorStop(0, restColor + '88');
        halo.addColorStop(1, restColor + '00');
        ctx.fillStyle = halo;
        ctx.fillRect(wx, wy, ww, wh);
      }

      const R = Math.min(ww, wh) * 0.38;
      const itemH = R * 2.5;
      if (spinning) {
        const p = Math.min(1, (now - s.spinStart!) / SPIN_MS);
        const offset = easeOut(p) * (s.strip.length - 1);
        const first = Math.max(0, Math.floor(offset) - 1);
        for (let k = first; k <= Math.min(s.strip.length - 1, first + 3); k++) {
          const y = cy + (k - offset) * itemH;
          const speed = 1 - p;
          ctx.globalAlpha = speed > 0.3 ? 0.35 : 1;
          if (speed > 0.3) drawBall(ctx, s.strip[k], cx, y + itemH * 0.08, R, false);
          ctx.globalAlpha = 1;
          drawBall(ctx, s.strip[k], cx, y, R, false);
        }
        if (p >= 1) {
          s.spinStart = null;
          s.strip = [s.ball];
          s.onDone();
        }
      } else {
        const bob = still ? 0 : Math.sin(t * 2) * 3;
        const pop =
          s.show === 'win' && sinceShow < 0.4 && !still ? 1 + Math.sin((sinceShow / 0.4) * Math.PI) * 0.12 : 1;
        drawBall(ctx, s.ball, cx, cy + bob, R * pop, true);
      }

      // Fade top and bottom of the window
      const fade = ctx.createLinearGradient(0, wy, 0, wy + wh);
      fade.addColorStop(0, 'rgba(12,10,29,.9)');
      fade.addColorStop(0.18, 'rgba(12,10,29,0)');
      fade.addColorStop(0.82, 'rgba(12,10,29,0)');
      fade.addColorStop(1, 'rgba(12,10,29,.9)');
      ctx.fillStyle = fade;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.restore();

      // Glass edge
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 2;
      roundRect(ctx, wx, wy, ww, wh, wr);
      ctx.stroke();

      // Bulbs
      const bi = 13;
      const pts = bulbPoints(fx + bi, fy + bi, fw - 2 * bi, fh - 2 * bi, Math.max(4, fr - bi), 20);
      const n = pts.length;
      pts.forEach(([x, y], k) => {
        let color = BULB_COLORS[k % BULB_COLORS.length];
        let level: number;
        if (still) level = 1;
        else if (s.show === 'draw') {
          const head = (t * 1.6) % 1;
          const d = (k / n - head + 1) % 1;
          level = d < 0.05 || (d > 0.5 && d < 0.55) ? 1 : 0.18 + Math.max(0, 0.5 - d) * 0.3;
        } else if (s.show === 'win') {
          color = k % 2 ? WIN : '#ffd34d';
          level = Math.floor(sinceShow * 10 + (k % 2)) % 2 ? 1 : 0.25;
        } else if (s.show === 'lose') {
          color = LOSE;
          level = 0.45 + 0.35 * Math.sin(sinceShow * 4);
        } else if (s.show === 'hurry') {
          level = 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 2));
        } else {
          // Idle: slow waves of light rolling around the frame
          level = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 - (k / n) * Math.PI * 6));
        }
        const r = 4.2 + level * 1.4;
        ctx.save();
        ctx.globalAlpha = 0.35 + level * 0.65;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 + level * 16;
        const bg2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        bg2.addColorStop(0, '#ffffff');
        bg2.addColorStop(0.45, color);
        bg2.addColorStop(1, color + '66');
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      drawHud(ctx, s.hud, W, fy, t, still);
      ctx.restore();

      // Win particles
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const p of s.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.vx *= 0.99;
        p.angle += p.spin;
        p.life -= 0.012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (p.coin) {
          ctx.scale(Math.abs(Math.cos(p.angle * 2)) * 0.8 + 0.2, 1);
          ctx.fillStyle = '#ffd34d';
          ctx.shadowColor = '#ffd34d';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d98e0b';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const label = target === null ? 'No ball yet' : `Ball ${letterFor(target)} ${target}`;
  return <canvas ref={canvasRef} className="stage-canvas" role="img" aria-label={label} />;
}
