import { useEffect, useRef, useState } from 'react';
import celebrationRobots from './assets/celbr.png';
import { createCelebrationSound } from './celebrationSound';
import './Celebration.css';

const CELEBRATION_LENGTH = 6800;
const FADE_LENGTH = 760;
const FIREWORK_COLORS = ['#00D9FF', '#168CFF', '#63FF5D', '#F9FCFC', '#F9D00F'];
const MAX_PARTICLES = 980;
const MAX_CONFETTI = 300;
const INITIAL_CONFETTI = 165;

function makeBurst(width, height, elapsed) {
  const x = width * (0.04 + Math.random() * 0.92);
  const y = height * (0.08 + Math.random() * 0.62);
  const pattern = Math.floor(Math.random() * 4);
  const size = Math.random();
  const particles = [];
  const count = size > 0.78 ? 52 + Math.floor(Math.random() * 18) : 30 + Math.floor(Math.random() * 22);
  const speedBase = Math.min(width, height) * (size > 0.78 ? 0.0012 : 0.0009 + Math.random() * 0.0005);

  for (let i = 0; i < count; i += 1) {
    const angle = pattern === 1
      ? (Math.PI * 2 * i) / count + (i % 2 ? 0.08 : -0.08)
      : (Math.PI * 2 * i) / count + (Math.random() - 0.5) * (pattern === 2 ? 0.36 : pattern === 3 ? 0.58 : 0.16);
    const speed = (0.7 + Math.random() * 0.7) * speedBase * (pattern === 2 ? 0.82 : pattern === 3 ? 1.18 : 1);
    particles.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      size: size > 0.78 ? 2.2 + Math.random() * 2.4 : 1.4 + Math.random() * 2.2,
      life: pattern === 2 ? 1050 + Math.random() * 700 : 820 + Math.random() * 650,
      gravity: pattern === 2 ? 0.014 : pattern === 3 ? 0.006 : 0.009,
      born: elapsed,
    });
  }
  return particles;
}

function makeConfetti(width, height, count, fromTop = false) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: fromTop ? -10 - Math.random() * 100 : Math.random() * height,
    width: 2.5 + Math.random() * 4.5,
    height: 4 + Math.random() * 8,
    speed: 0.38 + Math.random() * 0.95,
    drift: (Math.random() - 0.5) * 0.62,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.045,
    color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
    phase: Math.random() * Math.PI * 2,
    shape: Math.floor(Math.random() * 3),
  }));
}

function CelebrationFireworks({ running, muted, soundUrl }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!running || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const sound = createCelebrationSound({ muted, soundUrl });
    sound.start();
    const particles = [];
    let confetti = [];
    let animationFrame;
    let nextBurst = 140 + Math.random() * 180;
    let nextConfetti = 100;
    let startedAt = performance.now();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      canvas.width = Math.ceil(viewportWidth * ratio);
      canvas.height = Math.ceil(viewportHeight * ratio);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      confetti = makeConfetti(viewportWidth, viewportHeight, INITIAL_CONFETTI);
    };

    const animate = (now) => {
      const elapsed = now - startedAt;
      context.clearRect(0, 0, viewportWidth, viewportHeight);

      if (!reducedMotion && elapsed >= nextBurst && elapsed < CELEBRATION_LENGTH - 650) {
        particles.push(...makeBurst(viewportWidth, viewportHeight, elapsed));
        if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
        sound.burst(elapsed > 1200 ? 1 : 0.7);
        nextBurst = elapsed + 150 + Math.random() * 270;
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const age = elapsed - particle.born;
        if (age >= particle.life) {
          particles.splice(index, 1);
          continue;
        }
        const opacity = Math.pow(1 - age / particle.life, 1.45);
        particle.px = particle.x;
        particle.py = particle.y;
        particle.x += particle.vx * 16;
        particle.y += particle.vy * 16;
        particle.vx *= 0.982;
        particle.vy = particle.vy * 0.982 + particle.gravity;

        context.globalAlpha = opacity;
        context.strokeStyle = particle.color;
        context.lineWidth = particle.size;
        context.shadowColor = particle.color;
        context.shadowBlur = 12;
        context.beginPath();
        context.moveTo(particle.px, particle.py);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * 0.7, 0, Math.PI * 2);
        context.fill();
      }

      if (!reducedMotion) {
        if (elapsed >= nextConfetti) {
          confetti.push(...makeConfetti(viewportWidth, viewportHeight, 6 + Math.floor(Math.random() * 7), true));
          if (confetti.length > MAX_CONFETTI) confetti.splice(0, confetti.length - MAX_CONFETTI);
          nextConfetti = elapsed + 100 + Math.random() * 150;
        }

        for (let index = confetti.length - 1; index >= 0; index -= 1) {
          const piece = confetti[index];
          piece.y += piece.speed * 2.2;
          piece.x += piece.drift + Math.sin(elapsed * 0.0014 + piece.phase) * 0.22;
          piece.rotation += piece.rotationSpeed;
          if (piece.y > viewportHeight + 16) {
            confetti.splice(index, 1);
            continue;
          }
          context.save();
          context.globalAlpha = 0.72;
          context.translate(piece.x, piece.y);
          context.rotate(piece.rotation);
          context.fillStyle = piece.color;
          context.shadowColor = piece.color;
          context.shadowBlur = 5;
          if (piece.shape === 1) {
            context.rotate(Math.PI / 4);
            context.fillRect(-piece.width / 2, -piece.width / 2, piece.width, piece.width);
          } else if (piece.shape === 2) {
            context.beginPath();
            context.moveTo(0, -piece.height / 2);
            context.lineTo(piece.width / 2, piece.height / 2);
            context.lineTo(-piece.width / 2, piece.height / 2);
            context.closePath();
            context.fill();
          } else {
            context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
          }
          context.restore();
        }
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      if (!reducedMotion) animationFrame = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      sound.stop();
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      particles.length = 0;
      confetti = [];
    };
  }, [running, muted, soundUrl]);

  return <canvas className="celebration-fireworks" ref={canvasRef} aria-hidden="true" />;
}

/**
 * Reusable full-viewport victory sequence.
 * Set active to true and use onComplete to reveal the caller's result UI.
 */
export default function Celebration({ isVisible, onComplete, muted = false, soundUrl, imageSrc = celebrationRobots }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!isVisible) return undefined;
    setIsLeaving(false);
    const fadeTimer = window.setTimeout(() => setIsLeaving(true), CELEBRATION_LENGTH);
    const completeTimer = window.setTimeout(onComplete, CELEBRATION_LENGTH + FADE_LENGTH);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <section className={`celebration ${isLeaving ? 'celebration--leaving' : ''}`} role="status" aria-live="polite" aria-label="احتفال بالفوز">
      <CelebrationFireworks running={!isLeaving} muted={muted} soundUrl={soundUrl} />
      <div className="celebration-aurora" aria-hidden="true" />
      <div className="celebration-content">
        <img className="celebration-robots" src={imageSrc} alt="روبوتان يحتفلان" />
        <div className="celebration-word" dir="rtl">{'\u0645\u0628\u0627\u0631\u0643'}</div>
      </div>
    </section>
  );
}
