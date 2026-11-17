import { useEffect, useRef } from 'react';
import { TOTAL_BALLS } from './game';

export type LightShow = 'idle' | 'hurry' | 'draw' | 'win' | 'lose';

const SPIN_MS = 1500;
const FILLERS = 14;
const NUM_FONT = "800 {px}px Barlow, 'Arial Narrow', system-ui, sans-serif";
const font = (px: number) => NUM_FONT.replace('{px}', String(Math.round(px)));

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
  decay: number;
  kind: 'coin' | 'spark' | 'confetti';
}

/** Betting countdown drawn over the stage. */
export interface Countdown {
  /** Date.now() time when bets close. */
  endsAt: number;
  /** Length of the betting window in ms. */
  totalMs: number;
  /** Set while the clock is paused (How to play tour): ms left, frozen. */
  frozenMs: number | null;
}

interface Scene {
  countdown: Countdown | null;
  ball: number | null;
  strip: (number | null)[];
  spinStart: number | null;
  show: LightShow;
  showStart: number;
  particles: Particle[];
  onDone: () => void;
  still: boolean;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

function drawBall(ctx: CanvasRenderingContext2D, n: number | null, cx: number, cy: number, R: number) {
  // Body: glossy green
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.05, cx, cy, R);
  g.addColorStop(0, '#d9ffc7');
  g.addColorStop(0.25, '#3ee06a');
  g.addColorStop(0.7, '#13a03e');
  g.addColorStop(1, '#064a1c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // White face
  const f = R * 0.66;
  const fg = ctx.createRadialGradient(cx - f * 0.3, cy - f * 0.35, f * 0.1, cx, cy, f);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(0.8, '#f1f6ec');
  fg.addColorStop(1, '#cfdcc6');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx, cy, f, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0b3417';
  ctx.font = font(R * (n !== null && n >= 10 ? 0.74 : 0.84));
  ctx.fillText(n === null ? '?' : String(n), cx, cy + R * 0.04);

  // Gloss
  const hg = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.55, 0, cx - R * 0.42, cy - R * 0.55, R * 0.5);
  hg.addColorStop(0, 'rgba(255,255,255,.8)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0 = 0,
  a1 = Math.PI * 2,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
}

function burst(scene: Scene, cx: number, cy: number) {
  const colors = ['#ffd84d', '#7dff6a', '#ffffff', '#ffb72b'];
  for (let k = 0; k < 80; k++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 7;
    const coin = k % 3 === 0;
    scene.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3.5,
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      size: coin ? 7 + Math.random() * 4 : 4 + Math.random() * 4,
      color: coin ? '#ffd84d' : colors[k % colors.length],
      life: 1,
      decay: 0.011,
      kind: coin ? 'coin' : 'confetti',
    });
  }
}

/**
 * The ball stage, drawn on a canvas: light rays and a beam behind a glass dome,
 * the ball with a gold orbit ring on a glowing pedestal, ghost numbers in the
 * beam, an upward reel on each draw, and coin bursts on wins.
 */
export function GameCanvas({
  target,
  spinKey,
  show,
  countdown,
  reduceMotion,
  onDone,
}: {
  target: number | null;
  spinKey: number;
  show: LightShow;
  countdown: Countdown | null;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene>({
    countdown,
    ball: target,
    strip: [target],
    spinStart: null,
    show,
    showStart: 0,
    particles: [],
    onDone,
    still: reduceMotion,
  });
  scene.current.still = reduceMotion;
  scene.current.onDone = onDone;
  scene.current.countdown = countdown;

  useEffect(() => {
    const s = scene.current;
    if (spinKey === 0 || target === null) {
      s.ball = target;
      return;
    }
    if (s.still) {
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
    if (show === 'win' && !s.still) {
      const c = canvasRef.current;
      if (c) burst(s, c.clientWidth / 2, c.clientHeight * 0.46);
    }
  }, [show]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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
      const still = s.still;
      const t = still ? 0 : now / 1000;
      const since = (now - s.showStart) / 1000;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const by = H * 0.47;
      const R = Math.min(W * 0.17, H * 0.155);
      const Rs = R * 1.6;
      const pedY = H * 0.86;
      const spinning = s.spinStart !== null;
      const win = s.show === 'win';
      const lose = s.show === 'lose';
      const draw = s.show === 'draw';
      const hurry = s.show === 'hurry';
      const pulse = hurry && !still ? 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 2)) : 0;

      let shake = 0;
      if (lose && since < 0.45 && !still) shake = Math.sin(since * 60) * 6 * (1 - since / 0.45);
      ctx.save();
      ctx.translate(shake, 0);

      // Background glow
      const reach = Math.min(W, H) * 0.5;
      const glow = ctx.createRadialGradient(cx, by, 0, cx, by, reach);
      glow.addColorStop(0, lose ? 'rgba(255,70,90,.35)' : win ? 'rgba(255,220,80,.4)' : 'rgba(120,255,90,.32)');
      glow.addColorStop(0.5, 'rgba(30,160,60,.12)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Rays
      ctx.save();
      ctx.translate(cx, by);
      ctx.rotate(t * (draw ? 0.9 : 0.15));
      const rays = 18;
      ctx.globalAlpha = win ? 0.5 : draw ? 0.38 : 0.26;
      const rayFill = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
      rayFill.addColorStop(0, win ? 'rgba(255,226,122,.9)' : 'rgba(184,255,138,.8)');
      rayFill.addColorStop(1, 'rgba(184,255,138,0)');
      ctx.fillStyle = rayFill;
      for (let k = 0; k < rays; k++) {
        ctx.rotate((Math.PI * 2) / rays);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H), -Math.max(W, H) * 0.07);
        ctx.lineTo(Math.max(W, H), Math.max(W, H) * 0.07);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Light beam
      const bw = R * 2.3;
      const beamTop = 0;
      const beamBot = pedY - H * 0.03;
      const bg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      const beamA = draw ? 0.5 : 0.3;
      bg.addColorStop(0, 'rgba(200,255,190,0)');
      bg.addColorStop(0.5, `rgba(225,255,215,${beamA})`);
      bg.addColorStop(1, 'rgba(200,255,190,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(cx - bw / 2, beamTop, bw, beamBot - beamTop);
      ctx.strokeStyle = 'rgba(220,255,210,.18)';
      ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k++) {
        const x = cx + (k * bw) / 6;
        ctx.beginPath();
        ctx.moveTo(x, beamTop);
        ctx.lineTo(x, beamBot);
        ctx.stroke();
      }

      // Pedestal (three glowing tiers)
      const tiers: [number, number, number, string, string][] = [
        [W * 0.42, H * 0.07, pedY + H * 0.045, '#0a3a17', '#ffcf3f'],
        [W * 0.33, H * 0.055, pedY, '#0f5523', '#5dff6a'],
        [W * 0.22, H * 0.04, pedY - H * 0.04, '#17782f', '#b8ff7a'],
      ];
      for (const [rx, ry, y, fill, rim] of tiers) {
        ctx.save();
        ctx.fillStyle = fill;
        ellipse(ctx, cx, y + ry * 0.5, rx, ry);
        ctx.fill();
        ctx.fillStyle = '#0d4a1d';
        ellipse(ctx, cx, y, rx, ry);
        ctx.fill();
        ctx.shadowColor = rim;
        ctx.shadowBlur = 14 + pulse * 14;
        ctx.strokeStyle = rim;
        ctx.lineWidth = 3;
        ellipse(ctx, cx, y, rx, ry);
        ctx.stroke();
        ctx.restore();
      }
      const disk = ctx.createRadialGradient(cx, pedY - H * 0.04, 0, cx, pedY - H * 0.04, W * 0.2);
      disk.addColorStop(0, 'rgba(230,255,200,.9)');
      disk.addColorStop(1, 'rgba(120,255,110,0)');
      ctx.fillStyle = disk;
      ellipse(ctx, cx, pedY - H * 0.04, W * 0.2, H * 0.035);
      ctx.fill();

      // Ghost numbers in the beam (the neighbours of the ball showing)
      if (!spinning && s.ball !== null) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(R * 0.95);
        if (!still) ctx.filter = 'blur(1.5px)';
        const ghost = (n: number, y: number) => {
          if (n < 1 || n > TOTAL_BALLS) return;
          const fade = ctx.createLinearGradient(0, y - R * 0.5, 0, y + R * 0.5);
          fade.addColorStop(0, 'rgba(25,80,35,.15)');
          fade.addColorStop(1, 'rgba(25,80,35,.55)');
          ctx.fillStyle = fade;
          ctx.fillText(String(n), cx, y);
        };
        ghost(s.ball - 1, by - Rs - R * 0.55);
        ghost(s.ball + 1, by + Rs + R * 0.2);
        ctx.restore();
      }

      // Glass dome
      const dome = ctx.createRadialGradient(cx, by, Rs * 0.5, cx, by, Rs);
      dome.addColorStop(0, 'rgba(160,255,170,.02)');
      dome.addColorStop(0.85, 'rgba(170,255,180,.12)');
      dome.addColorStop(1, 'rgba(220,255,220,.32)');
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.arc(cx, by, Rs, 0, Math.PI * 2);
      ctx.fill();

      // Gold halo behind the ball
      const halo = ctx.createRadialGradient(cx, by, R * 0.6, cx, by, R * 1.7);
      halo.addColorStop(0, lose ? 'rgba(255,80,100,.7)' : 'rgba(255,214,70,.75)');
      halo.addColorStop(1, 'rgba(255,214,70,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, by, R * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Orbit ring, back half
      const ringRx = R * 1.85;
      const ringRy = R * 0.34;
      const ringY = by + R * 0.08;
      const ringColor = lose ? '#ff5a78' : win ? '#fff07a' : '#ffcf3f';
      const ring = (a0: number, a1: number) => {
        ctx.save();
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 16 + pulse * 18 + (win ? 14 : 0);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 3;
        ellipse(ctx, cx, ringY, ringRx, ringRy, a0, a1);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ellipse(ctx, cx, ringY, ringRx * 1.12, ringRy * 1.2, a0, a1);
        ctx.stroke();
        ctx.restore();
      };
      ring(Math.PI, Math.PI * 2);

      // Ball (or the reel while drawing)
      if (spinning) {
        const p = Math.min(1, (now - s.spinStart!) / SPIN_MS);
        const offset = easeOut(p) * (s.strip.length - 1);
        const itemH = R * 2.5;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - bw / 2, 0, bw, beamBot);
        ctx.clip();
        const first = Math.max(0, Math.floor(offset) - 2);
        for (let k = first; k <= Math.min(s.strip.length - 1, first + 5); k++) {
          const y = by + (k - offset) * itemH;
          if (1 - p > 0.3) {
            ctx.globalAlpha = 0.3;
            drawBall(ctx, s.strip[k], cx, y + itemH * 0.1, R);
          }
          ctx.globalAlpha = 1;
          drawBall(ctx, s.strip[k], cx, y, R);
        }
        ctx.restore();
        if (p >= 1) {
          s.spinStart = null;
          s.strip = [s.ball];
          s.onDone();
        }
      } else {
        const bob = still ? 0 : Math.sin(t * 2) * 3;
        const pop = win && since < 0.4 && !still ? 1 + Math.sin((since / 0.4) * Math.PI) * 0.12 : 1;
        drawBall(ctx, s.ball, cx, by + bob, R * pop);
      }

      // Orbit ring, front half, with a spark running round it
      ring(0, Math.PI);
      if (!still) {
        const a = t * (draw ? 6 : 1.6);
        for (let k = 0; k < 3; k++) {
          const ang = a + (k * Math.PI * 2) / 3;
          const sx = cx + Math.cos(ang) * ringRx;
          const sy = ringY + Math.sin(ang) * ringRy;
          ctx.save();
          ctx.globalAlpha = Math.sin(ang) > 0 ? 1 : 0.35;
          ctx.shadowColor = '#fff6c0';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#fffbe0';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Dome rim and highlight
      ctx.strokeStyle = 'rgba(220,255,220,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, by, Rs, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, by, Rs * 0.9, Math.PI * 1.1, Math.PI * 1.4);
      ctx.stroke();
      if (lose && since < 1.2) {
        ctx.fillStyle = `rgba(255,60,90,${0.25 * (1 - since / 1.2)})`;
        ctx.beginPath();
        ctx.arc(cx, by, Rs, 0, Math.PI * 2);
        ctx.fill();
      }
      // Countdown ring round the dome, seconds badge on top, big 3-2-1 at the end
      if (s.countdown) {
        const cd = s.countdown;
        const msLeft = Math.max(0, cd.frozenMs ?? cd.endsAt - Date.now());
        const frac = Math.min(1, msLeft / cd.totalMs);
        const secs = Math.ceil(msLeft / 1000);
        const color = secs <= 3 ? '#ff3d5e' : secs <= 5 ? '#ffcf3f' : '#39ff6a';
        const rr = Rs + 9;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0,20,6,.55)';
        ctx.beginPath();
        ctx.arc(cx, by, rr, 0, Math.PI * 2);
        ctx.stroke();
        if (frac > 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 16;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.arc(cx, by, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
          ctx.stroke();
          // Glowing head of the ring
          const ha = -Math.PI / 2 + Math.PI * 2 * frac;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ha) * rr, by + Math.sin(ha) * rr, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Seconds badge at the top of the ring
        const bR = Math.max(22, R * 0.42);
        const bY = by - rr;
        const tick = 1 - (msLeft % 1000) / 1000;
        const bump = still || secs > 5 ? 1 : 1 + 0.12 * Math.max(0, 1 - tick * 4);
        ctx.save();
        ctx.translate(cx, bY);
        ctx.scale(bump, bump);
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#021809';
        ctx.beginPath();
        ctx.arc(0, 0, bR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = secs <= 5 ? color : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(bR * 1.05);
        ctx.fillText(String(secs), 0, bR * 0.06);
        ctx.restore();

        // Final three seconds: a big number pops over the stage
        if (secs <= 3 && secs > 0 && cd.frozenMs === null) {
          const scale = still ? 1 : 1.5 - tick * 0.5;
          const alpha = still ? 0.85 : Math.max(0, 1 - tick * 0.9);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, by);
          ctx.scale(scale, scale);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = font(R * 2.1);
          ctx.lineWidth = 8;
          ctx.strokeStyle = '#2a0610';
          ctx.shadowColor = '#ff3d5e';
          ctx.shadowBlur = 30;
          ctx.strokeText(String(secs), 0, R * 0.08);
          ctx.fillStyle = '#ffe9a8';
          ctx.fillText(String(secs), 0, R * 0.08);
          ctx.restore();
        }
      }
      ctx.restore();

      // Sparkles rising from the pedestal
      if (!still && Math.random() < (draw ? 0.6 : 0.25)) {
        s.particles.push({
          x: cx + (Math.random() - 0.5) * W * 0.4,
          y: pedY - H * 0.04,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.6 - Math.random() * 1.2,
          spin: 0,
          angle: 0,
          size: 1 + Math.random() * 2,
          color: Math.random() < 0.5 ? '#fff3a0' : '#b8ff8a',
          life: 1,
          decay: 0.008 + Math.random() * 0.01,
          kind: 'spark',
        });
      }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const p of s.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind !== 'spark') {
          p.vy += 0.18;
          p.vx *= 0.99;
        }
        p.angle += p.spin;
        p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (p.kind === 'coin') {
          ctx.scale(Math.abs(Math.cos(p.angle * 2)) * 0.8 + 0.2, 1);
          ctx.fillStyle = '#ffd84d';
          ctx.shadowColor = '#ffd84d';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d99a0b';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'spark') {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
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

  const label = target === null ? 'No ball yet' : `Ball ${target}`;
  return <canvas ref={canvasRef} className="stage-canvas" role="img" aria-label={label} />;
}
