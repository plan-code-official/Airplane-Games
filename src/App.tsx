import { useState, useEffect, useRef, useMemo } from 'react';
import { type Question, getQuestionsByCategory } from './data/questions';
import { audio } from './utils/audio';
import { getGameQuestions, startGameSession, submitGameAnswers, completeGameSession } from './utils/gameApi';

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  opacity: number;
  isBlack?: boolean;
}

interface ExplosionParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
}

interface LaserPath {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: 'cyan' | 'red';
  visible: boolean;
}

interface ObstacleBullet {
  id: number;
  x: number;
  y: number;
  speed: number;
}

interface PlayerBullet {
  id: number;
  x: number;
  y: number;
  speed: number;
}

interface CloudOption {
  idx: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  isActive: boolean;
}

interface DropHeart {
  id: number;
  x: number;
  y: number;
}

interface WeaponDrop {
  id: number;
  x: number;
  y: number;
}

interface ShieldDrop {
  id: number;
  x: number;
  y: number;
}


function App() {
  const { lessonId, token } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      lessonId: params.get('lessonId'),
      token: params.get('token')
    };
  }, []);

  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [gameOverStats, setGameOverStats] = useState<{ coins?: number, stars?: number, experience?: number, score?: number, percentage?: number } | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isSubmittingStats, setIsSubmittingStats] = useState(false);
  const [submitStatsError, setSubmitStatsError] = useState<string | null>(null);

  // Session tracking refs
  const sessionAnswersRef = useRef<{ questionId: number, selectedAnswer: string, timeTaken: number }[]>([]);
  const questionStartTimeRef = useRef<number>(0);

  // Game Configuration & Play State
  const [gameState, setGameState] = useState<'welcome' | 'playing' | 'gameover'>('welcome');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [apiQuestions, setApiQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  useEffect(() => {
    if (!lessonId) {
      setIsLoadingQuestions(false);
      return;
    }

    getGameQuestions(3, lessonId, token)
      .then(data => {
        if (data.success && data.data && data.data.questions) {
          const mapped: Question[] = data.data.questions.map((q: any) => {
            let parsedOptions = q.options;
            if (typeof parsedOptions === 'string') {
              try { parsedOptions = JSON.parse(parsedOptions); } catch (e) { parsedOptions = []; }
            }
            const textOptions = Array.isArray(parsedOptions)
              ? parsedOptions.map((o: any) => typeof o === 'string' ? o : (o.text || ''))
              : [];

            const correctAnswerText = q.correctAnswer;
            const answerIndex = textOptions.findIndex((t: string) => t === correctAnswerText);

            return {
              id: q.id,
              question: q.question,
              options: textOptions,
              answerIndex: answerIndex >= 0 ? answerIndex : 0,
              category: 'general',
              categoryName: data.data.lessonName,
              audioUrl: q.audioUrl || null
            };
          });
          setApiQuestions(mapped);
        }
      })
      .catch(err => console.error("Error fetching questions:", err))
      .finally(() => setIsLoadingQuestions(false));
  }, [lessonId, token]);
  const [questions, _setQuestions] = useState<Question[]>([]);
  const questionsRef = useRef<Question[]>([]);
  const setQuestions = (q: Question[]) => {
    questionsRef.current = q;
    _setQuestions(q);
  };

  const [currentQuestionIndex, _setCurrentQuestionIndex] = useState<number>(0);
  const currentQuestionIndexRef = useRef<number>(0);
  const setCurrentQuestionIndex = (idx: number) => {
    currentQuestionIndexRef.current = idx;
    _setCurrentQuestionIndex(idx);
  };

  const [lives, _setLives] = useState<number>(3);
  const livesRef = useRef<number>(3);
  const setLives = (val: number | ((prev: number) => number)) => {
    if (typeof val === 'function') {
      _setLives(prev => {
        const next = val(prev);
        livesRef.current = next;
        return next;
      });
    } else {
      livesRef.current = val;
      _setLives(val);
    }
  };

  const [planeLane, setPlaneLane] = useState<number>(1);
  const [stars, setStars] = useState<number>(0);
  const starsRef = useRef<number>(0);
  const setStarsSync = (s: number) => {
    starsRef.current = s;
    setStars(s);
  };

  // Dynamic Joystick States
  const [joystickStart, setJoystickStart] = useState<{ x: number; y: number } | null>(null);
  const [joystickCurrent, setJoystickCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isInvincible, setIsInvincible] = useState<boolean>(false);
  const [hasActiveShield, setHasActiveShield] = useState<boolean>(false);
  const [isBossCrashing, setIsBossCrashing] = useState<boolean>(false);

  // Interaction State
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerChecked, _setIsAnswerChecked] = useState<boolean>(false);
  const isAnswerCheckedRef = useRef<boolean>(false);
  const setIsAnswerChecked = (v: boolean) => {
    isAnswerCheckedRef.current = v;
    _setIsAnswerChecked(v);
  };

  const [isFlyingOver, setIsFlyingOver] = useState<boolean>(false); // Victory animation
  const [movementDir, setMovementDir] = useState<'up' | 'down' | 'none'>('none');

  // Styling and Animation Effects
  const [planeEffect, setPlaneEffect] = useState<'normal' | 'boost' | 'shake'>('normal');
  const [smokeParticles, setSmokeParticles] = useState<Particle[]>([]);
  const [explosionParticles, setExplosionParticles] = useState<ExplosionParticle[]>([]);
  const [laser, setLaser] = useState<LaserPath>({ x1: 0, y1: 0, x2: 0, y2: 0, color: 'cyan', visible: false });
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const particleIdRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<any>(null);

  const skyRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLImageElement>(null);

  const monsterRef = useRef<HTMLImageElement>(null);

  // Gameplay loop coordinates and physics refs
  const planeXRef = useRef<number>(20);
  const planeYRef = useRef<number>(50);
  const planeLaneRef = useRef<number>(1);
  const isInvincibleRef = useRef<boolean>(false);
  const hasShieldRef = useRef<boolean>(false);
  const invincibilityTimeRef = useRef<number>(0);

  const joystickStartRef = useRef<{ x: number; y: number } | null>(null);
  const joystickCurrentRef = useRef<{ x: number; y: number } | null>(null);

  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  const obstaclesRef = useRef<{ id: number; x: number; y: number; speed: number; type: number; hasShot?: boolean; hp?: number }[]>([
    { id: 1, x: 110, y: 25, speed: 0.35, type: 1, hasShot: false, hp: 2 },
    { id: 2, x: 150, y: 55, speed: 0.4, type: 2, hasShot: false, hp: 2 },
    { id: 3, x: 190, y: 75, speed: 0.3, type: 3, hasShot: false, hp: 2 }
  ]);

  const [bulletIds, setBulletIds] = useState<number[]>([]);
  const obstacleBulletsRef = useRef<ObstacleBullet[]>([]);
  const bulletIdCounterRef = useRef<number>(0);

  // Player bullets state & refs
  const [playerBulletIds, setPlayerBulletIds] = useState<number[]>([]);
  const playerBulletsRef = useRef<PlayerBullet[]>([]);
  const playerBulletIdCounterRef = useRef<number>(0);

  // Collectible hearts
  const [heartIds, setHeartIds] = useState<number[]>([]);
  const heartsRef = useRef<DropHeart[]>([]);
  const heartIdCounterRef = useRef<number>(0);

  // Collectible weapon upgrades
  const [weaponDropIds, setWeaponDropIds] = useState<number[]>([]);
  const weaponDropsRef = useRef<WeaponDrop[]>([]);
  const weaponDropIdCounterRef = useRef<number>(0);
  const monstersKilledRef = useRef<number>(0);
  const nextUpgradeKillsRef = useRef<number>(5);
  const weaponLevelRef = useRef<number>(1);
  const weaponUpgradeTimeRef = useRef<number>(0);

  // Collectible shields
  const [shieldDropIds, setShieldDropIds] = useState<number[]>([]);
  const shieldDropsRef = useRef<ShieldDrop[]>([]);
  const shieldDropIdCounterRef = useRef<number>(0);

  // Moving cloud options ref
  const cloudsRef = useRef<CloudOption[]>([]);

  // Auto fire interval ref
  const autoFireIntervalRef = useRef<any>(null);

  // Joystick touch ID ref for multi-touch tracking
  const joystickTouchIdRef = useRef<number | null>(null);

  const initClouds = (question: Question) => {
    if (!question) return;
    const lanePositionsNum = [75, 55, 35, 15];
    cloudsRef.current = question.options.map((option, idx) => ({
      idx,
      text: option,
      x: 100 + (idx * 6), // Staggered slightly
      y: lanePositionsNum[idx],
      speed: 0.08 + Math.random() * 0.04, // Smooth slow speed so player has time to read
      isActive: true
    }));
  };

  const startGame = async (category: string) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    try {
      setIsStartingSession(true);
      const sessionResult = await startGameSession(3, lessonId, token);
      if (sessionResult.success && sessionResult.data) {
        setCurrentSessionId(sessionResult.data.id);
      }
    } catch (e) {
      console.error("Failed to start session:", e);
    } finally {
      setIsStartingSession(false);
    }

    setSelectedCategory(category);
    const selectedQuestions = apiQuestions.length > 0 ? apiQuestions : getQuestionsByCategory(category);
    const shuffled = [...selectedQuestions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setLives(3);
    setPlaneLane(1);
    setStarsSync(0);
    setIsBossCrashing(false);

    obstacleBulletsRef.current = [];
    setBulletIds([]);
    bulletIdCounterRef.current = 0;

    playerBulletsRef.current = [];
    setPlayerBulletIds([]);
    playerBulletIdCounterRef.current = 0;

    setJoystickStart(null);
    setJoystickCurrent(null);
    joystickStartRef.current = null;
    joystickCurrentRef.current = null;
    planeXRef.current = 20;
    planeYRef.current = 50;
    planeLaneRef.current = 1;
    isInvincibleRef.current = false;
    setIsInvincible(false);
    hasShieldRef.current = false;
    setHasActiveShield(false);
    setSelectedAnswer(null);
    setIsAnswerChecked(false);

    heartsRef.current = [];
    setHeartIds([]);
    heartIdCounterRef.current = 0;

    weaponDropsRef.current = [];
    setWeaponDropIds([]);
    weaponDropIdCounterRef.current = 0;
    monstersKilledRef.current = 0;
    nextUpgradeKillsRef.current = 4;
    weaponLevelRef.current = 1;
    weaponUpgradeTimeRef.current = 0;

    shieldDropsRef.current = [];
    setShieldDropIds([]);
    shieldDropIdCounterRef.current = 0;

    setIsFlyingOver(false);
    setMovementDir('none');
    setGameState('playing');

    sessionAnswersRef.current = [];
    questionStartTimeRef.current = Date.now();

    if (shuffled.length > 0) {
      initClouds(shuffled[0]);
    }

    // Play sound and engines
    audio.setMute(isMuted);
    audio.playSuccess();
    audio.startEngine(50);

    setTimeout(() => {
      if (shuffled.length > 0) {
        audio.speakText(shuffled[0].question, 'ar-SA', shuffled[0].audioUrl);
      }
    }, 1000);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMute(nextMuted);
    if (nextMuted) {
      audio.stopEngine();
    } else {
      if (gameState === 'playing') {
        audio.startEngine(50);
      }
    }
  };


  // Auto-fire timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoFireIntervalRef.current) {
        clearInterval(autoFireIntervalRef.current);
      }
    };
  }, []);

  // Keyboard input tracker & Action Fire triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Touch/Mouse Dynamic Joystick Event Handlers
  const handleStartJoystick = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.lane-target-btn') ||
      target.closest('.hud-back-btn') ||
      target.closest('.sound-toggle-inline') ||
      target.closest('.sound-toggle') ||
      target.closest('.hud-next-btn') ||
      target.closest('.sky-blur-backdrop') ||
      target.closest('.action-fire-btn') ||
      target.closest('.mobile-controls-overlay')
    ) {
      return;
    }

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      // Find the touch that is not on the fire button
      const touch = Array.from(e.changedTouches).find(t => {
        const touchTarget = t.target as HTMLElement;
        return !touchTarget.closest('.action-fire-btn') && !touchTarget.closest('.mobile-controls-overlay');
      });
      if (!touch) return;
      clientX = touch.clientX;
      clientY = touch.clientY;
      joystickTouchIdRef.current = touch.identifier;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = skyRef.current?.getBoundingClientRect();
    if (rect) {
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      setJoystickStart({ x: localX, y: localY });
      setJoystickCurrent({ x: localX, y: localY });
      joystickStartRef.current = { x: localX, y: localY };
      joystickCurrentRef.current = { x: localX, y: localY };
    }
  };

  const handleMoveJoystick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!joystickStartRef.current) return;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      const touch = Array.from(e.touches).find(t => t.identifier === joystickTouchIdRef.current);
      if (!touch) return;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = skyRef.current?.getBoundingClientRect();
    if (rect) {
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      setJoystickCurrent({ x: localX, y: localY });
      joystickCurrentRef.current = { x: localX, y: localY };
    }
  };

  const handleEndJoystick = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      const hasJoystickTouch = Array.from(e.touches).some(t => t.identifier === joystickTouchIdRef.current);
      if (hasJoystickTouch) return;
    }

    setJoystickStart(null);
    setJoystickCurrent(null);
    joystickStartRef.current = null;
    joystickCurrentRef.current = null;
    joystickTouchIdRef.current = null;
  };

  const getStickDelta = () => {
    if (!joystickStart || !joystickCurrent) return { x: 0, y: 0 };
    const dx = joystickCurrent.x - joystickStart.x;
    const dy = joystickCurrent.y - joystickStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 35;
    if (dist < maxRadius) {
      return { x: dx, y: dy };
    } else {
      return { x: (dx / dist) * maxRadius, y: (dy / dist) * maxRadius };
    }
  };
  const stickDelta = getStickDelta();

  // Gameplay / Obstacles Loop & Invincibility Checking
  useEffect(() => {
    if (gameState !== 'playing') return;

    let animId: number;

    planeXRef.current = 20;
    planeYRef.current = 50;
    planeLaneRef.current = 1;
    isInvincibleRef.current = false;
    setIsInvincible(false);

    obstaclesRef.current = [
      { id: 1, x: 110, y: 25, speed: 0.35, type: 1, hasShot: false, hp: 2 },
      { id: 2, x: 150, y: 55, speed: 0.4, type: 2, hasShot: false, hp: 2 },
      { id: 3, x: 190, y: 75, speed: 0.3, type: 3, hasShot: false, hp: 2 }
    ];

    const loop = (_time: number) => {

      if (isBossCrashing) {
        animId = requestAnimationFrame(loop);
        return;
      }

      // 1. Keyboards movement
      const speed = 0.38;
      let dx = 0;
      let dy = 0;
      if (keysPressedRef.current['ArrowUp'] || keysPressedRef.current['w'] || keysPressedRef.current['W']) {
        dy += speed;
      }
      if (keysPressedRef.current['ArrowDown'] || keysPressedRef.current['s'] || keysPressedRef.current['S']) {
        dy -= speed;
      }
      if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a'] || keysPressedRef.current['A']) {
        dx -= speed;
      }
      if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d'] || keysPressedRef.current['D']) {
        dx += speed;
      }

      planeXRef.current = Math.max(5, Math.min(55, planeXRef.current + dx));
      planeYRef.current = Math.max(10, Math.min(85, planeYRef.current + dy));

      if (keysPressedRef.current[' '] || keysPressedRef.current['Enter']) {
        firePlayerBullet();
      }

      // 2. Joysticks movement
      if (joystickStartRef.current && joystickCurrentRef.current) {
        const jdx = joystickCurrentRef.current.x - joystickStartRef.current.x;
        const jdy = joystickCurrentRef.current.y - joystickStartRef.current.y;
        const dist = Math.sqrt(jdx * jdx + jdy * jdy);
        if (dist > 5) {
          const maxRadius = 35;
          const factor = Math.min(dist, maxRadius) / maxRadius;
          const angle = Math.atan2(jdy, jdx);
          planeXRef.current = Math.max(5, Math.min(55, planeXRef.current + Math.cos(angle) * factor * 0.6));
          planeYRef.current = Math.max(10, Math.min(85, planeYRef.current - Math.sin(angle) * factor * 0.6));
        }
      }

      // Update plane position directly on DOM
      const planeWrapper = planeRef.current?.parentElement;
      if (planeWrapper) {
        planeWrapper.style.bottom = `${planeYRef.current}%`;
        planeWrapper.style.left = `${planeXRef.current}%`;
      }

      // Track and highlight closest target lane
      const targetLanes = [75, 55, 35, 15];
      let closestLaneIdx = 0;
      let minDiff = Infinity;
      targetLanes.forEach((pos, idx) => {
        const diff = Math.abs(planeYRef.current - pos);
        if (diff < minDiff) {
          minDiff = diff;
          closestLaneIdx = idx;
        }
      });
      if (closestLaneIdx !== planeLaneRef.current) {
        planeLaneRef.current = closestLaneIdx;
        setPlaneLane(closestLaneIdx);
      }

      // 3. Minion obstacles movement
      obstaclesRef.current.forEach((obs) => {
        obs.x -= obs.speed;
        if (obs.x < -15) {
          obs.x = 110 + Math.random() * 20;
          obs.y = 15 + Math.random() * 65;
          obs.speed = 0.3 + Math.random() * 0.2;
          obs.hasShot = false;
        }

        // Spawn horizontal bullet when spaceship crosses screen edge from right
        if (!obs.hasShot && obs.x < 98) {
          obs.hasShot = true;
          const newId = ++bulletIdCounterRef.current;
          obstacleBulletsRef.current.push({
            id: newId,
            x: obs.x - 3,
            y: obs.y + 4,
            speed: 0.65
          });
          setBulletIds(prev => [...prev, newId]);
        }

        const obsEl = document.getElementById(`obstacle-${obs.id}`);
        if (obsEl) {
          obsEl.style.left = `${obs.x}%`;
          obsEl.style.bottom = `${obs.y}%`;
          obsEl.style.display = 'block';
        }
      });

      // 3b. Update obstacle bullets movement & collision
      const activeBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      activeBullets.forEach((bullet) => {
        bullet.x -= bullet.speed;
        const bulletEl = document.getElementById(`bullet-${bullet.id}`);
        if (bulletEl) {
          bulletEl.style.left = `${bullet.x}%`;
        }

        // Check collision with player plane
        if (!isInvincibleRef.current && planeRef.current && !isFlyingOver) {
          const rect1 = planeRef.current.getBoundingClientRect();
          const bulletRect = bulletEl ? bulletEl.getBoundingClientRect() : null;
          if (bulletRect) {
            const c1x = rect1.left + rect1.width / 2;
            const c1y = rect1.top + rect1.height / 2;
            const c2x = bulletRect.left + bulletRect.width / 2;
            const c2y = bulletRect.top + bulletRect.height / 2;
            const dist = Math.sqrt((c1x - c2x) ** 2 + (c1y - c2y) ** 2);
            if (dist < 42) {
              handleObstacleHit();
              isInvincibleRef.current = true;
              setIsInvincible(true);
              invincibilityTimeRef.current = Date.now() + 1500;
              bullet.x = -20; // Trigger removal
            }
          }
        }
      });

      const cleanBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      if (cleanBullets.length !== obstacleBulletsRef.current.length) {
        obstacleBulletsRef.current = cleanBullets;
        setBulletIds(cleanBullets.map(b => b.id));
      }

      // 3c. Update clouds movement & collision
      cloudsRef.current.forEach((cloud) => {
        if (!isFlyingOver) {
          // Always drift at regular speed as requested
          cloud.x -= cloud.speed;
          if (cloud.x < -35) {
            cloud.x = 105;
          }
        }

        const cloudEl = document.getElementById(`cloud-option-${cloud.idx}`);
        if (cloudEl) {
          cloudEl.style.left = `${cloud.x}%`;
          cloudEl.style.bottom = `${cloud.y}%`;

          // Only the chosen/hit cloud (isActive === false) disappears
          if (!cloud.isActive) {
            cloudEl.style.opacity = '0';
            cloudEl.style.pointerEvents = 'none';
          } else {
            cloudEl.style.opacity = '1';
            if (isAnswerChecked) {
              cloudEl.style.pointerEvents = 'none';
            } else {
              cloudEl.style.pointerEvents = 'auto';
            }
          }
        }

        // Check collision with player plane
        if (!isAnswerCheckedRef.current && !isFlyingOver && cloud.isActive && planeRef.current && cloudEl) {
          const planeRect = planeRef.current.getBoundingClientRect();
          const cloudRect = cloudEl.getBoundingClientRect();

          const overlap = !(
            planeRect.right < cloudRect.left ||
            planeRect.left > cloudRect.right ||
            planeRect.bottom < cloudRect.top ||
            planeRect.top > cloudRect.bottom
          );

          if (overlap) {
            cloud.isActive = false;
            handleCloudCollision(cloud);
          }
        }
      });

      // 3d. Update player bullets movement & collision with monsters
      const activePlayerBullets = playerBulletsRef.current.filter(b => b.x < 110);
      activePlayerBullets.forEach((bullet) => {
        bullet.x += bullet.speed;
        const bulletEl = document.getElementById(`player-bullet-${bullet.id}`);
        if (bulletEl) {
          bulletEl.style.left = `${bullet.x}%`;
        }

        obstaclesRef.current.forEach((obs) => {
          const obsEl = document.getElementById(`obstacle-${obs.id}`);
          if (obsEl && obs.x < 110 && bullet.x < 110) {
            const obsRect = obsEl.getBoundingClientRect();
            const bulletRect = bulletEl ? bulletEl.getBoundingClientRect() : null;
            if (bulletRect) {
              const c1x = obsRect.left + obsRect.width / 2;
              const c1y = obsRect.top + obsRect.height / 2;
              const c2x = bulletRect.left + bulletRect.width / 2;
              const c2y = bulletRect.top + bulletRect.height / 2;
              const dist = Math.sqrt((c1x - c2x) ** 2 + (c1y - c2y) ** 2);

              if (dist < 45) {
                // Decrement monster health
                obs.hp = (obs.hp || 2) - 1;
                bullet.x = 200; // Trigger bullet removal

                if (skyRef.current) {
                  const skyRect = skyRef.current.getBoundingClientRect();
                  const isMobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
                  const pt = getLocalPoint(
                    obsRect.left + obsRect.width * 0.5,
                    obsRect.top + obsRect.height * 0.5,
                    skyRect,
                    isMobilePortrait
                  );
                  fireExplosion(pt.x, pt.y, 'red');
                }

                if (obs.hp <= 0) {
                  audio.playExplosion();
                  obsEl.style.display = 'none';

                  // Handle drops (Heart or Weapon)
                  monstersKilledRef.current += 1;
                  if (monstersKilledRef.current >= nextUpgradeKillsRef.current) {
                    const wId = ++weaponDropIdCounterRef.current;
                    weaponDropsRef.current.push({ id: wId, x: obs.x, y: obs.y });
                    setWeaponDropIds(prev => [...prev, wId]);

                    monstersKilledRef.current = 0;
                    nextUpgradeKillsRef.current = 3 + Math.floor(Math.random() * 4); // next drop after 3 to 6 kills
                  } else if (Math.random() < 0.15) {
                    // Spawn a shield with 15% chance
                    const sId = ++shieldDropIdCounterRef.current;
                    shieldDropsRef.current.push({ id: sId, x: obs.x, y: obs.y });
                    setShieldDropIds(prev => [...prev, sId]);
                  } else if (livesRef.current < 3 && Math.random() < 0.3) {
                    // Spawn a heart with 30% chance if lives < 3 and weapon/shield didn't spawn
                    const hId = ++heartIdCounterRef.current;
                    heartsRef.current.push({ id: hId, x: obs.x, y: obs.y });
                    setHeartIds(prev => [...prev, hId]);
                  }

                  // Reset/respawn the monster
                  obs.x = 115 + Math.random() * 20;
                  obs.y = 15 + Math.random() * 65;
                  obs.speed = 0.3 + Math.random() * 0.2;
                  obs.hasShot = false;
                  obs.hp = 2;
                } else {
                  obsEl.classList.add('hit-flash');
                  setTimeout(() => {
                    obsEl.classList.remove('hit-flash');
                  }, 100);
                }
              }
            }
          }
        });
      });

      const cleanPlayerBullets = playerBulletsRef.current.filter(b => b.x < 110);
      if (cleanPlayerBullets.length !== playerBulletsRef.current.length) {
        playerBulletsRef.current = cleanPlayerBullets;
        setPlayerBulletIds(cleanPlayerBullets.map(b => b.id));
      }

      // 4. Invincibility cooldown check
      if (isInvincibleRef.current && Date.now() > invincibilityTimeRef.current) {
        isInvincibleRef.current = false;
        setIsInvincible(false);
        if (hasShieldRef.current) {
          hasShieldRef.current = false;
          setHasActiveShield(false);
        }
      }

      // Weapon upgrade cooldown check
      if (weaponLevelRef.current > 1 && Date.now() > weaponUpgradeTimeRef.current) {
        weaponLevelRef.current = 1;
      }

      // 5. Check minion collisions
      if (!isInvincibleRef.current && planeRef.current && !isFlyingOver) {
        obstaclesRef.current.forEach((obs) => {
          const obsEl = document.getElementById(`obstacle-${obs.id}`);
          if (obsEl) {
            const rect1 = planeRef.current!.getBoundingClientRect();
            const rect2 = obsEl.getBoundingClientRect();
            const c1x = rect1.left + rect1.width / 2;
            const c1y = rect1.top + rect1.height / 2;
            const c2x = rect2.left + rect2.width / 2;
            const c2y = rect2.top + rect2.height / 2;
            const dist = Math.sqrt((c1x - c2x) ** 2 + (c1y - c2y) ** 2);
            const collide = dist < 60;
            if (collide) {
              handleObstacleHit();
              isInvincibleRef.current = true;
              setIsInvincible(true);
              invincibilityTimeRef.current = Date.now() + 1500;
            }
          }
        });
      }

      // 6. Update and check collectible hearts
      let activeHearts = heartsRef.current;
      let heartsChanged = false;
      const uncollectedHearts: DropHeart[] = [];

      activeHearts.forEach(heart => {
        heart.x -= 0.35; // move left
        if (heart.x < -10) {
          heartsChanged = true;
          return;
        }

        // check collision with plane
        if (!isInvincibleRef.current && !isFlyingOver && planeRef.current) {
          const planeRect = planeRef.current.getBoundingClientRect();
          const heartEl = document.getElementById(`heart-${heart.id}`);
          if (heartEl) {
            const heartRect = heartEl.getBoundingClientRect();
            const overlap = !(
              planeRect.right < heartRect.left ||
              planeRect.left > heartRect.right ||
              planeRect.bottom < heartRect.top ||
              planeRect.top > heartRect.bottom
            );

            if (overlap) {
              heartsChanged = true;
              audio.playSuccess();
              setLives(prev => {
                if (prev < 3) return prev + 1;
                return prev;
              });
              setPlaneEffect('boost');
              setTimeout(() => setPlaneEffect('normal'), 500);
              return; // skip adding to uncollectedHearts
            }
          }
        }
        uncollectedHearts.push(heart);
      });

      if (heartsChanged) {
        heartsRef.current = uncollectedHearts;
        setHeartIds(uncollectedHearts.map(h => h.id));
      }

      // 7. Update and check collectible weapons
      let activeWeapons = weaponDropsRef.current;
      let weaponsChanged = false;
      const uncollectedWeapons: WeaponDrop[] = [];

      activeWeapons.forEach(weapon => {
        weapon.x -= 0.35; // move left
        if (weapon.x < -10) {
          weaponsChanged = true;
          return;
        }

        // check collision with plane
        if (!isInvincibleRef.current && !isFlyingOver && planeRef.current) {
          const planeRect = planeRef.current.getBoundingClientRect();
          const weaponEl = document.getElementById(`weapon-${weapon.id}`);
          if (weaponEl) {
            const weaponRect = weaponEl.getBoundingClientRect();
            const overlap = !(
              planeRect.right < weaponRect.left ||
              planeRect.left > weaponRect.right ||
              planeRect.bottom < weaponRect.top ||
              planeRect.top > weaponRect.bottom
            );

            if (overlap) {
              weaponsChanged = true;
              audio.playSuccess();
              weaponLevelRef.current = Math.min(3, weaponLevelRef.current + 1);
              weaponUpgradeTimeRef.current = Date.now() + 10000; // 10 seconds of upgraded weapon
              setPlaneEffect('boost');
              setTimeout(() => setPlaneEffect('normal'), 500);
              return; // skip adding to uncollectedWeapons
            }
          }
        }
        uncollectedWeapons.push(weapon);
      });

      if (weaponsChanged) {
        weaponDropsRef.current = uncollectedWeapons;
        setWeaponDropIds(uncollectedWeapons.map(w => w.id));
      }

      // 8. Update and check collectible shields
      let activeShields = shieldDropsRef.current;
      let shieldsChanged = false;
      const uncollectedShields: ShieldDrop[] = [];

      activeShields.forEach(shield => {
        shield.x -= 0.35; // move left
        if (shield.x < -10) {
          shieldsChanged = true;
          return;
        }

        // check collision with plane
        if (!isInvincibleRef.current && !isFlyingOver && planeRef.current) {
          const planeRect = planeRef.current.getBoundingClientRect();
          const shieldEl = document.getElementById(`shield-${shield.id}`);
          if (shieldEl) {
            const shieldRect = shieldEl.getBoundingClientRect();
            const overlap = !(
              planeRect.right < shieldRect.left ||
              planeRect.left > shieldRect.right ||
              planeRect.bottom < shieldRect.top ||
              planeRect.top > shieldRect.bottom
            );

            if (overlap) {
              shieldsChanged = true;
              audio.playSuccess();
              isInvincibleRef.current = true;
              setIsInvincible(true);
              hasShieldRef.current = true;
              setHasActiveShield(true);
              invincibilityTimeRef.current = Date.now() + 5000; // 5 seconds of invincibility
              setPlaneEffect('boost');
              setTimeout(() => setPlaneEffect('normal'), 500);
              return; // skip adding to uncollectedShields
            }
          }
        }
        uncollectedShields.push(shield);
      });

      if (shieldsChanged) {
        shieldDropsRef.current = uncollectedShields;
        setShieldDropIds(uncollectedShields.map(s => s.id));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, isBossCrashing, isFlyingOver]);

  // Active damage smoke effect on the player's plane
  useEffect(() => {
    if (gameState !== 'playing') {
      setSmokeParticles([]);
      return;
    }
    const interval = setInterval(() => {
      setSmokeParticles(prev => {
        const newParticles: Particle[] = [];

        // Engine tail smoke
        newParticles.push({
          id: particleIdRef.current++,
          left: -15,
          top: 35 + Math.random() * 25,
          size: 15 + Math.random() * 15,
          opacity: 0.8,
          isBlack: false
        });

        // Black smoke for plane damage
        const damageLevel = 3 - lives;
        if (damageLevel > 0) {
          for (let i = 0; i < damageLevel; i++) {
            if (Math.random() > 0.3) {
              newParticles.push({
                id: particleIdRef.current++,
                left: Math.random() * 80 + 20,
                top: Math.random() * 40 + 20,
                size: 20 + Math.random() * 20 * damageLevel,
                opacity: 0.6 + (damageLevel * 0.1),
                isBlack: true
              });
            }
          }
        }

        const updated = prev
          .map(p => ({
            ...p, left: p.left - 12, size: p.size + 1.2, opacity: p.opacity - 0.07
          }))
          .filter(p => p.opacity > 0);
        return [...newParticles, ...updated];
      });
    }, 120);
    return () => clearInterval(interval);
  }, [gameState, lives]);

  const handleObstacleHit = () => {
    audio.playExplosion();
    setPlaneEffect('shake');
    setLives(prev => {
      const nextLives = prev - 1;
      if (nextLives <= 0) {
        setTimeout(() => handleEndGame(false), 1500);
      } else {
        audio.speakText("احذر! اصطدمت بالعائق!", 'ar-SA');
      }
      return nextLives;
    });
    setTimeout(() => {
      setPlaneEffect('normal');
    }, 1000);
  };

  // Explosion particles animation
  useEffect(() => {
    if (explosionParticles.length === 0) return;
    let animationFrameId: number;
    let lastTime = performance.now();
    const updateParticles = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      setExplosionParticles(prev => {
        const next = prev.map(p => ({
          ...p,
          x: p.x + Math.cos(p.angle) * p.speed * dt,
          y: p.y + Math.sin(p.angle) * p.speed * dt,
          size: p.size * 0.95
        }));
        return next.filter(p => p.size > 0.5);
      });
      animationFrameId = requestAnimationFrame(updateParticles);
    };
    animationFrameId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animationFrameId);
  }, [explosionParticles.length]);

  const fireExplosion = (x: number, y: number, _color?: 'cyan' | 'red') => {
    const newParticles: ExplosionParticle[] = Array.from({ length: 20 }).map((_, i) => ({
      id: Date.now() + i,
      x, y,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 300 + 100,
      size: Math.random() * 8 + 4
    }));
    setExplosionParticles(newParticles);
  };

  const getLocalPoint = (clientX: number, clientY: number, skyRect: DOMRect, isMobilePortrait: boolean) => {
    if (isMobilePortrait) {
      const Cx = window.innerWidth / 2;
      const Cy = window.innerHeight / 2;
      const dx = clientX - Cx;
      const dy = clientY - Cy;
      const localW = window.innerHeight;
      const localH = window.innerWidth;
      return { x: dy + localW / 2, y: -dx + localH / 2 };
    } else {
      return { x: clientX - skyRect.left, y: clientY - skyRect.top };
    }
  };

  const lastFiredRef = useRef<number>(0);
  const firePlayerBullet = () => {
    if (gameState !== 'playing' || isFlyingOver) return;

    const now = Date.now();
    if (now - lastFiredRef.current < 150) return;
    lastFiredRef.current = now;

    const level = weaponLevelRef.current;
    const newBulletIds: number[] = [];

    if (level === 1) {
      const bulletId = ++playerBulletIdCounterRef.current;
      playerBulletsRef.current.push({ id: bulletId, x: planeXRef.current + 8.2, y: planeYRef.current + 7.2, speed: 1.5 });
      newBulletIds.push(bulletId);
    } else if (level === 2) {
      const b1 = ++playerBulletIdCounterRef.current;
      const b2 = ++playerBulletIdCounterRef.current;
      playerBulletsRef.current.push({ id: b1, x: planeXRef.current + 8.2, y: planeYRef.current + 9.2, speed: 1.5 });
      playerBulletsRef.current.push({ id: b2, x: planeXRef.current + 8.2, y: planeYRef.current + 5.2, speed: 1.5 });
      newBulletIds.push(b1, b2);
    } else {
      const b1 = ++playerBulletIdCounterRef.current;
      const b2 = ++playerBulletIdCounterRef.current;
      const b3 = ++playerBulletIdCounterRef.current;
      playerBulletsRef.current.push({ id: b1, x: planeXRef.current + 8.2, y: planeYRef.current + 7.2, speed: 1.5 });
      playerBulletsRef.current.push({ id: b2, x: planeXRef.current + 8.2, y: planeYRef.current + 11.2, speed: 1.5 });
      playerBulletsRef.current.push({ id: b3, x: planeXRef.current + 8.2, y: planeYRef.current + 3.2, speed: 1.5 });
      newBulletIds.push(b1, b2, b3);
    }

    setPlayerBulletIds(prev => [...prev, ...newBulletIds]);
    audio.playLaser();
  };

  const startAutoFire = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (autoFireIntervalRef.current) return;

    firePlayerBullet();
    autoFireIntervalRef.current = setInterval(() => {
      firePlayerBullet();
    }, 150);
  };

  const stopAutoFire = () => {
    if (autoFireIntervalRef.current) {
      clearInterval(autoFireIntervalRef.current);
      autoFireIntervalRef.current = null;
    }
  };

  const handleCloudCollision = (cloud: CloudOption) => {
    if (isAnswerCheckedRef.current || isFlyingOver) return;

    setSelectedAnswer(cloud.idx);
    const currentQuestion = questionsRef.current[currentQuestionIndexRef.current];
    const correct = cloud.idx === currentQuestion.answerIndex;

    const timeTaken = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    sessionAnswersRef.current.push({
      questionId: currentQuestion.id,
      selectedAnswer: cloud.text,
      timeTaken
    });

    const cloudEl = document.getElementById(`cloud-option-${cloud.idx}`);
    let explodeX = window.innerWidth * 0.7;
    let explodeY = window.innerHeight * 0.5;
    if (cloudEl && skyRef.current) {
      const cloudRect = cloudEl.getBoundingClientRect();
      const skyRect = skyRef.current.getBoundingClientRect();
      const isMobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
      const pt = getLocalPoint(
        cloudRect.left + cloudRect.width * 0.5,
        cloudRect.top + cloudRect.height * 0.5,
        skyRect,
        isMobilePortrait
      );
      explodeX = pt.x;
      explodeY = pt.y;
    }

    if (correct) {
      audio.playExplosion();
      fireExplosion(explodeX, explodeY, 'cyan');
      handleCheckAnswer(true);
    } else {
      audio.playFailure();
      fireExplosion(explodeX, explodeY, 'red');

      setIsAnswerChecked(true);

      const planeWrapper = planeRef.current?.parentElement;
      if (planeWrapper && skyRef.current) {
        const planeRect = planeWrapper.getBoundingClientRect();
        const skyRect = skyRef.current.getBoundingClientRect();
        const isMobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
        const planePt = getLocalPoint(
          planeRect.left + planeRect.width * 0.5,
          planeRect.top + planeRect.height * 0.5,
          skyRect,
          isMobilePortrait
        );
        setTimeout(() => {
          triggerMonsterRetaliation(planePt);
        }, 800);
      } else {
        handleDamagePlane();
      }
    }
  };


  const triggerMonsterRetaliation = (planePt: { x: number, y: number }) => {
    if (skyRef.current && monsterRef.current) {
      const skyRect = skyRef.current.getBoundingClientRect();
      const monsterRect = monsterRef.current.getBoundingClientRect();
      const isMobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;

      const monsterMouthX = isMobilePortrait ? monsterRect.left + monsterRect.width * 0.5 : monsterRect.left;
      const monsterMouthY = isMobilePortrait ? monsterRect.top : monsterRect.top + monsterRect.height * 0.5;

      const monsterPt = getLocalPoint(monsterMouthX, monsterMouthY, skyRect, isMobilePortrait);

      setLaser({ x1: monsterPt.x, y1: monsterPt.y, x2: planePt.x, y2: planePt.y, color: 'red', visible: true });
      audio.playLaser();

      setTimeout(() => {
        setLaser(prev => ({ ...prev, visible: false }));
        audio.playExplosion();
        fireExplosion(planePt.x, planePt.y, 'red');
        handleDamagePlane();
      }, 300);
    } else {
      handleDamagePlane();
    }
  };

  const handleDamagePlane = () => {
    setPlaneEffect('shake');

    setLives(prev => {
      const newLives = prev - 1;
      livesRef.current = newLives;
      if (newLives <= 0) {
        setIsBossCrashing(true);
        fireExplosion(planeXRef.current + 5, planeYRef.current + 5, 'red');
        audio.playExplosion();
        setTimeout(() => handleEndGame(false), 1500);
      } else {
        audio.playFailure();
        audio.speakText("إجابة خاطئة! احذر، الطائرة تتضرر!", 'ar-SA');
        setTimeout(() => {
          setPlaneEffect('normal');
        }, 1000);
      }
      return newLives;
    });

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
    if (livesRef.current > 0) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNextQuestion();
      }, 1200);
    }
  };

  const handleCheckAnswer = (correct: boolean) => {

    setIsAnswerChecked(true);

    if (correct) {
      setStarsSync(starsRef.current + 1);
      setPlaneEffect('boost');

      audio.playSuccess();
      audio.speakText("إجابة صحيحة! أحسنت يا بطل!", 'ar-SA');
    }

    setTimeout(() => {
      setPlaneEffect('normal');
    }, 1000);

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNextQuestion();
    }, 1200);
  };

  const handleNextQuestion = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    questionStartTimeRef.current = Date.now();


    const currentQIdx = currentQuestionIndexRef.current;
    if (currentQIdx + 1 < questionsRef.current.length) {
      const nextIndex = currentQIdx + 1;
      setCurrentQuestionIndex(nextIndex);
      initClouds(questionsRef.current[nextIndex]);
      setTimeout(() => {
        audio.speakText(questionsRef.current[nextIndex].question, 'ar-SA', questionsRef.current[nextIndex].audioUrl);
      }, 1000);
    } else {
      setIsFlyingOver(true);
      audio.playWin();
      setTimeout(() => handleEndGame(true), 2500);
    }
  };

  const handleEndGame = async (won: boolean) => {
    stopAutoFire();
    setGameState('gameover');
    setIsFlyingOver(false);
    audio.stopEngine();

    if (currentSessionId) {
      setIsSubmittingStats(true);
      setSubmitStatsError(null);
      try {
        await submitGameAnswers(currentSessionId, sessionAnswersRef.current, token);
        const res = await completeGameSession(currentSessionId, token);
        if (res.success && res.data) {
          setGameOverStats({
            coins: res.data.coins,
            stars: res.data.stars,
            experience: res.data.experience,
            score: res.data.score,
            percentage: res.data.percentage
          });
        } else {
          setSubmitStatsError("فشل في جلب النتائج. يرجى المحاولة مرة أخرى.");
        }
      } catch (e) {
        console.error("Error submitting answers or completing session", e);
        setSubmitStatsError("حدث خطأ أثناء حفظ النتائج. يرجى المحاولة لاحقاً.");
      } finally {
        setIsSubmittingStats(false);
      }
    }

    if (won) {
      audio.speakText("رائع! لقد نجحت في إنهاء جميع الأسئلة وتجنب العقبات بنجاح، أنت بطل حقيقي!", 'ar-SA');
    } else {
      audio.playLose();
      audio.speakText("لقد نفذت القلوب وتدمرت الطائرة. حاول مرة أخرى للتفوق!", 'ar-SA');
    }
  };

  const handleBackToMenu = () => {
    window.location.href = "https://frontend-six-xi-37.vercel.app/";
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isMobilePortrait = typeof window !== 'undefined' && window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
  const lanePositions = isMobilePortrait
    ? ['72%', '53%', '34%', '15%']
    : ['75%', '55%', '35%', '15%'];

  const getPlaneClass = () => {
    let classes = ['airplane-wrapper'];
    if (isFlyingOver) classes.push('plane-flyover');
    if (planeEffect === 'boost') classes.push('engine-boost');
    if (planeEffect === 'shake') classes.push('shake-drop');
    if (movementDir === 'up') classes.push('tilt-up');
    if (movementDir === 'down') classes.push('tilt-down');
    if (isInvincible) classes.push('invincible-flash');

    // Add charring effect based on damage level
    const damageLevel = 3 - lives;
    if (damageLevel === 1) classes.push('charred-1');
    if (damageLevel >= 2) classes.push('charred-2');

    return classes.join(' ');
  };

  return (
    <div className="app-container">
      {gameState !== 'playing' && (
        <button
          className="sound-toggle"
          onClick={toggleMute}
          title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          style={{ zIndex: 100 }}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      )}

      {/* ================= WELCOME SCREEN ================= */}
      {gameState === 'welcome' && (
        <div className="welcome-screen">
          <div className="welcome-content">
            <div className="welcome-logo-container">
              <img src="/cartoon_airplane.png" className="welcome-plane" alt="طائرة كرتونية" />
            </div>
            <h1 className="welcome-title">مغامرة الطائرة الفضائية ✈️🚀</h1>
            <p className="welcome-subtitle">
              أطلق شعاع الليزر على الإجابة الصحيحة لتسجيل النقاط!
              تجنب الاصطدام بالعقبات الفضائية الطائرة وأجب على {apiQuestions.length} أسئلة بشكل صحيح للفوز.
            </p>

            {isLoadingQuestions ? (
              <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#fff', margin: '1rem 0' }}>جاري تحميل الأسئلة...</p>
            ) : apiQuestions.length > 0 ? (
              <button className="start-btn" onClick={() => startGame('all')} disabled={isStartingSession}>
                {isStartingSession ? 'جاري بدء اللعب...' : 'ابدأ المغامرة الآن! 🚀'}
              </button>
            ) : (
              <>
                <div className="category-selection">
                  <span className="category-label">اختر مغامرتك المفضلة:</span>
                  <div className="category-chips">
                    <button className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`} onClick={() => setSelectedCategory('all')}>🌟 كل المغامرات</button>
                    <button className={`category-chip ${selectedCategory === 'math' ? 'active' : ''}`} onClick={() => setSelectedCategory('math')}>🔢 الرياضيات الذكية</button>
                    <button className={`category-chip ${selectedCategory === 'science' ? 'active' : ''}`} onClick={() => setSelectedCategory('science')}>🌿 عالم العلوم</button>
                    <button className={`category-chip ${selectedCategory === 'general' ? 'active' : ''}`} onClick={() => setSelectedCategory('general')}>💡 معلومات عامة</button>
                  </div>
                </div>

                <button className="start-btn" onClick={() => startGame(selectedCategory)} disabled={isStartingSession}>
                  {isStartingSession ? 'جاري بدء اللعب...' : 'ابدأ المغامرة الآن! 🚀'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= GAME SCREEN (PLAYING) ================= */}
      {gameState === 'playing' && (
        <div
          className="sky-container"
          ref={skyRef}
          onMouseDown={handleStartJoystick}
          onMouseMove={handleMoveJoystick}
          onMouseUp={handleEndJoystick}
          onMouseLeave={handleEndJoystick}
          onTouchStart={handleStartJoystick}
          onTouchMove={handleMoveJoystick}
          onTouchEnd={handleEndJoystick}
        >

          {/* Virtual Joystick UI Overlay */}
          {joystickStart && (
            <div
              className="joystick-container"
              style={{
                left: joystickStart.x,
                top: joystickStart.y
              }}
            >
              <div
                className="joystick-stick"
                style={{
                  transform: `translate(${stickDelta.x}px, ${stickDelta.y}px)`
                }}
              />
            </div>
          )}

          {/* Top HUD Header */}
          <div className="sky-hud-header">
            <div className="hud-left">
              <button className="hud-back-btn" onClick={handleBackToMenu}>🏠 القائمة الرئيسية</button>
              <span className="hud-category">{currentQuestion?.categoryName}</span>
            </div>
            <div className="hud-center">
              {currentQuestion && !isFlyingOver && (
                <div className="hud-question-text-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  {currentQuestion.audioUrl && (
                    <button 
                      className="play-audio-btn" 
                      onClick={() => audio.speakText(currentQuestion.question, 'ar-SA', currentQuestion.audioUrl)}
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.2)', 
                        border: '1px solid rgba(255,255,255,0.4)', 
                        borderRadius: '50%', 
                        cursor: 'pointer', 
                        fontSize: '20px', 
                        width: '36px', 
                        height: '36px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      title="استمع للسؤال"
                    >
                      ▶️
                    </button>
                  )}
                  <span>{currentQuestion.question}</span>
                </div>
              )}
            </div>
            <div className="hud-right">
              <button className="sound-toggle-inline" onClick={toggleMute}>
                {isMuted ? "🔇" : "🔊"}
              </button>
              <div className="hud-lives">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`heart-icon ${i >= lives ? 'lost' : ''}`}>❤️</span>
                ))}
              </div>
              <div className="hud-stars">
                <span className="stars-score">⭐ {stars}/{questions.length}</span>
                <span style={{ marginRight: '4px' }}>نجوم</span>
              </div>
              <span className="hud-question-number">السؤال {currentQuestionIndex + 1}</span>
            </div>
          </div>

          <div className="buildings-layer-bg" />
          <div className="clouds-container">
            <div className="cloud cloud-type-1" style={{ top: '15%', animationDuration: '30s' }} />
            <div className="cloud cloud-type-2" style={{ top: '45%', animationDuration: '45s' }} />
            <div className="cloud cloud-type-3" style={{ top: '70%', animationDuration: '35s' }} />
          </div>

          {/* Scrolling obstacles */}
          {obstaclesRef.current.map(obs => (
            <div
              key={obs.id}
              id={`obstacle-${obs.id}`}
              className="scrolling-obstacle"
              style={{
                left: `${obs.x}%`,
                bottom: `${obs.y}%`
              }}
            >
              <img src="/monster.png?v=2" alt="عائق" style={{ transform: 'scaleX(-1)' }} />
            </div>
          ))}

          {/* Obstacle horizontal bullets */}
          {bulletIds.map(id => {
            const bullet = obstacleBulletsRef.current.find(b => b.id === id);
            return (
              <div
                key={id}
                id={`bullet-${id}`}
                className="obstacle-bullet"
                style={{
                  bottom: `${bullet?.y || 0}%`,
                  left: `${bullet?.x || 0}%`
                }}
              />
            );
          })}

          {/* Collectible hearts */}
          {heartIds.map(id => {
            const heart = heartsRef.current.find(h => h.id === id);
            if (!heart) return null;
            return (
              <div
                key={id}
                id={`heart-${id}`}
                className="drop-heart"
                style={{
                  position: 'absolute',
                  left: `${heart.x}%`,
                  bottom: `${heart.y}%`,
                  fontSize: '2rem',
                  textShadow: '0 0 10px rgba(255, 0, 0, 0.8)',
                  zIndex: 25,
                  animation: 'pulse 1s infinite alternate'
                }}
              >
                ❤️
              </div>
            );
          })}

          {/* Collectible Weapons */}
          {weaponDropIds.map(id => {
            const weapon = weaponDropsRef.current.find(w => w.id === id);
            if (!weapon) return null;
            return (
              <div
                key={id}
                id={`weapon-${id}`}
                className="drop-weapon"
                style={{
                  position: 'absolute',
                  left: `${weapon.x}%`,
                  bottom: `${weapon.y}%`,
                  fontSize: '2.5rem',
                  textShadow: '0 0 15px rgba(0, 255, 255, 0.9)',
                  zIndex: 25,
                  animation: 'pulse 1s infinite alternate'
                }}
              >
                ⚡
              </div>
            );
          })}

          {/* Collectible Shields */}
          {shieldDropIds.map(id => {
            const shield = shieldDropsRef.current.find(s => s.id === id);
            if (!shield) return null;
            return (
              <div
                key={id}
                id={`shield-${id}`}
                className="drop-shield"
                style={{
                  position: 'absolute',
                  left: `${shield.x}%`,
                  bottom: `${shield.y}%`,
                  fontSize: '2.5rem',
                  textShadow: '0 0 15px rgba(0, 255, 0, 0.9)',
                  zIndex: 25,
                  animation: 'pulse 1s infinite alternate'
                }}
              >
                🛡️
              </div>
            );
          })}

          {/* Player bullets */}
          {playerBulletIds.map(id => {
            const bullet = playerBulletsRef.current.find(b => b.id === id);
            if (!bullet) return null;
            return (
              <div
                key={id}
                id={`player-bullet-${id}`}
                className="player-bullet"
                style={{
                  bottom: `${bullet.y}%`,
                  left: `${bullet.x}%`,
                  position: 'absolute',
                  zIndex: 14
                }}
              />
            );
          })}



          {/* Airplane Sprite Wrapper */}
          <div
            className={getPlaneClass()}
            style={{
              bottom: `${planeYRef.current}%`,
              left: `${planeXRef.current}%`,
              position: 'absolute',
              transition: isFlyingOver ? 'all 2.5s ease-in-out' : 'none'
            }}
          >
            <img ref={planeRef} src="/cartoon_airplane.png" className="airplane-img" alt="طائرة" />

            {/* Glowing 3D Glass Sphere Shield Effect */}
            {hasActiveShield && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '150%',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.6) 0%, rgba(0,255,255,0.2) 30%, rgba(0,150,255,0.4) 80%, rgba(0,50,255,0.6) 100%)',
                  boxShadow: '0 0 30px rgba(0,255,255,0.6), inset 0 0 30px rgba(255,255,255,0.8), inset -20px -20px 40px rgba(0,100,255,0.5)',
                  border: '2px solid rgba(255, 255, 255, 0.6)',
                  backdropFilter: 'blur(2px)',
                  zIndex: 2,
                  animation: 'pulse-centered 1s infinite alternate',
                  pointerEvents: 'none'
                }}
              />
            )}

            {smokeParticles.map(p => (
              <div
                key={p.id}
                className="smoke-particle"
                style={{
                  left: `${p.left}px`,
                  top: `${p.top}px`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  opacity: p.opacity,
                  backgroundColor: p.isBlack ? `rgba(20, 20, 20, ${p.opacity})` : `rgba(255, 255, 255, ${p.opacity})`
                }}
              />
            ))}
          </div>

          {/* Floating Answer Cloud Targets aligned with lanes */}
          {currentQuestion && !isFlyingOver && (
            <div className="clouds-options-container">
              {currentQuestion.options.map((option, idx) => {
                let cloudClass = "cloud-option-btn";
                if (isAnswerChecked) {
                  if (idx === currentQuestion.answerIndex) {
                    cloudClass += " correct";
                  } else if (idx === selectedAnswer) {
                    cloudClass += " incorrect";
                  } else {
                    cloudClass += " faded";
                  }
                } else if (planeLane === idx) {
                  cloudClass += " selected-lane";
                }

                return (
                  <div
                    key={idx}
                    id={`cloud-option-${idx}`}
                    className={cloudClass}
                    style={{
                      position: 'absolute',
                      bottom: lanePositions[idx],
                      left: '110%', // updated by game loop
                      zIndex: 25,
                    }}
                  >
                    <div className="cloud-bubble">
                      <span className="cloud-badge">
                        {idx === 0 ? "أ" : idx === 1 ? "ب" : idx === 2 ? "ج" : "د"}
                      </span>
                      <span className="cloud-text">{option}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Laser SVG Layer */}
          {laser.visible && (
            <svg className="laser-svg-layer">
              <defs>
                <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <line
                x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2}
                stroke={laser.color === "cyan" ? "#00E5FF" : "#EF4444"}
                strokeWidth="6" strokeLinecap="round"
                filter={laser.color === "cyan" ? "url(#glowCyan)" : "url(#glowRed)"}
              />
              <line
                x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2}
                stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round"
              />
            </svg>
          )}

          {/* Explosion Particles Layer */}
          {explosionParticles.length > 0 && (
            <div className="explosion-layer">
              {explosionParticles.map((p) => (
                <div
                  key={p.id}
                  className="laser-explosion-particle"
                  style={{
                    left: p.x, top: p.y, width: p.size, height: p.size,
                    background: laser.color === "cyan" ? "#00E5FF" : "#EF4444",
                    boxShadow: `0 0 10px ${laser.color === "cyan" ? "#00E5FF" : "#EF4444"}`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="buildings-layer-fg" />

          {/* Styled Mobile Overlay Controls */}
          <div className="mobile-controls-overlay">
            <button
              className="action-fire-btn"
              disabled={isFlyingOver}
              onMouseDown={startAutoFire}
              onMouseUp={stopAutoFire}
              onMouseLeave={stopAutoFire}
              onTouchStart={startAutoFire}
              onTouchEnd={stopAutoFire}
            >
              <div className="fire-btn-inner">
                <span className="fire-icon">☄️</span>
                <span className="fire-text">إطلاق</span>
              </div>
            </button>
          </div>


        </div>
      )}

      {/* ================= GAME OVER SCREEN ================= */}
      {gameState === 'gameover' && (
        <div className="game-over-screen">
          <div className="result-card">
            {isSubmittingStats ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>جاري حفظ النتائج... ⏳</h2>
                <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
              </div>
            ) : submitStatsError ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ef4444' }}>⚠️ خطأ</h2>
                <p>{submitStatsError}</p>
                <button className="retry-btn" onClick={handleBackToMenu} style={{ background: '#64748b', boxShadow: 'none', marginTop: '1rem' }}>
                  العودة للشاشة الرئيسية 🏠
                </button>
              </div>
            ) : (
              <>
                {lives > 0 ? (
                  <>
                    <span className="result-badge">🏆✈️✨</span>
                    <h2 className="result-title win">أنت بطل حقيقي!</h2>
                    <p className="result-desc">
                      لقد استطعت الإجابة بذكاء وتجنب جميع العقبات الفضائية بنجاح!
                    </p>
                  </>
                ) : (
                  <>
                    <span className="result-badge">🔥💥🥺</span>
                    <h2 className="result-title lose">الطائرة تفحمت!</h2>
                    <p className="result-desc">
                      أصيبت طائرتك بالعقبات الفضائية ونفذت محاولاتك. حاول مرة أخرى!
                    </p>
                  </>
                )}

                <div className="result-stats">
                  <div className="stat-item base-stat">
                    <span className="stat-val">⭐ {stars}/{questions.length}</span>
                    <span className="stat-lbl">الإجابات الصحيحة</span>
                  </div>
                  <div className="stat-item base-stat">
                    <span className="stat-val">❤️ {lives}/3</span>
                    <span className="stat-lbl">القلوب المتبقية</span>
                  </div>

                  {gameOverStats && gameOverStats.score !== undefined && (
                    <div className="stat-item score-stat">
                      <span className="stat-val">🎯 {gameOverStats.score}</span>
                      <span className="stat-lbl">إجمالي النقاط</span>
                    </div>
                  )}
                  {gameOverStats && gameOverStats.percentage !== undefined && (
                    <div className="stat-item percentage-stat">
                      <span className="stat-val">📊 %{gameOverStats.percentage}</span>
                      <span className="stat-lbl">النسبة المئوية</span>
                    </div>
                  )}

                  {gameOverStats && gameOverStats.coins !== undefined && (
                    <div className="stat-item coins-stat">
                      <span className="stat-val">🪙 {gameOverStats.coins}</span>
                      <span className="stat-lbl">عملات مكتسبة</span>
                    </div>
                  )}
                  {gameOverStats && gameOverStats.stars !== undefined && gameOverStats.stars > 0 && (
                    <div className="stat-item stars-stat">
                      <span className="stat-val">🌟 +{gameOverStats.stars}</span>
                      <span className="stat-lbl">نجوم إضافية</span>
                    </div>
                  )}
                  {gameOverStats && gameOverStats.experience !== undefined && (
                    <div className="stat-item exp-stat">
                      <span className="stat-val">⚡ {gameOverStats.experience}</span>
                      <span className="stat-lbl">نقاط خبرة</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button className="retry-btn" onClick={() => startGame(selectedCategory)}>
                    العب مرة أخرى 🔄
                  </button>
                  <button className="retry-btn" onClick={handleBackToMenu} style={{ background: '#64748b', boxShadow: 'none' }}>
                    العودة للشاشة الرئيسية 🏠
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
