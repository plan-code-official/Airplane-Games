import { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Flame, Play, Shield, Smartphone, Volume2, VolumeX, Zap } from 'lucide-react';
import { type Question, type QuestionOption } from './data/questions';
import { audio } from './utils/audio';
import { getGameQuestions, startGameSession, submitGameAnswers, completeGameSession } from './utils/gameApi';
import daadCoins from "./assets/daddcoin.webp";
import questionCoinImg from "./assets/QuestionCoin.png";
import questionNumberBg from "./assets/QuestionNumber.png";
import descriptionImg from "./assets/description.png";
import welcomeExitButton from './assets/Exit1.png';
import welcomeStartButton from './assets/Start.png';
import ResultsPanel from './ResultsPanel/ResultsPanel';
import Celebration from './Celebration/Celebration';
import GameWelcomeScreen from './components/GameWelcomeScreen/GameWelcomeScreen';
import exitHudIcon from './assets/ExitButton.svg';
import heartHudIcon from './assets/heart.png';
 
interface ExplosionParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: 'cyan' | 'red';
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

interface Obstacle {
  id: number;
  x: number;
  y: number;
  speed: number;
  type: number;
  hasShot?: boolean;
  hp?: number;
}

interface SpriteAlphaMask {
  width: number;
  height: number;
  pixels: Uint8Array;
  noseColumn: number;
  noseRow: number;
}

interface SpriteRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const createSpriteAlphaMask = (
  image: HTMLImageElement,
  includePixel: (x: number, y: number) => boolean = () => true
): SpriteAlphaMask | null => {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0);
  const alpha = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight).data;
  const width = 128;
  const height = Math.ceil(width * image.naturalHeight / image.naturalWidth);
  const pixels = new Uint8Array(width * height);

  for (let cellY = 0; cellY < height; cellY += 1) {
    const sourceTop = Math.floor(cellY * image.naturalHeight / height);
    const sourceBottom = Math.max(sourceTop + 1, Math.ceil((cellY + 1) * image.naturalHeight / height));
    for (let cellX = 0; cellX < width; cellX += 1) {
      const sourceLeft = Math.floor(cellX * image.naturalWidth / width);
      const sourceRight = Math.max(sourceLeft + 1, Math.ceil((cellX + 1) * image.naturalWidth / width));
      let opaque = false;
      for (let y = sourceTop; y < sourceBottom && !opaque; y += 1) {
        for (let x = sourceLeft; x < sourceRight; x += 1) {
          if (includePixel(x, y) && alpha[(y * image.naturalWidth + x) * 4 + 3] > 24) {
            opaque = true;
            break;
          }
        }
      }
      pixels[cellY * width + cellX] = opaque ? 1 : 0;
    }
  }

  let noseColumn = width - 1;
  while (noseColumn > 0) {
    let hasPixel = false;
    for (let y = 0; y < height; y += 1) {
      if (pixels[y * width + noseColumn]) {
        hasPixel = true;
        break;
      }
    }
    if (hasPixel) break;
    noseColumn -= 1;
  }
  let firstNoseRow = 0;
  let lastNoseRow = height - 1;
  while (firstNoseRow < height && !pixels[firstNoseRow * width + noseColumn]) firstNoseRow += 1;
  while (lastNoseRow >= firstNoseRow && !pixels[lastNoseRow * width + noseColumn]) lastNoseRow -= 1;

  return { width, height, pixels, noseColumn, noseRow: (firstNoseRow + lastNoseRow) / 2 };
};

const alphaMaskTouchesRect = (
  mask: SpriteAlphaMask,
  sprite: SpriteRect,
  target: SpriteRect,
  mirrorX = false
) => {
  const left = Math.max(sprite.left, target.left);
  const right = Math.min(sprite.left + sprite.width, target.left + target.width);
  const top = Math.max(sprite.top, target.top);
  const bottom = Math.min(sprite.top + sprite.height, target.top + target.height);
  if (left >= right || top >= bottom || sprite.width <= 0 || sprite.height <= 0) return false;

  const firstX = Math.max(0, Math.floor(((left - sprite.left) / sprite.width) * mask.width));
  const lastX = Math.min(mask.width - 1, Math.floor(((right - sprite.left) / sprite.width) * mask.width));
  const firstY = Math.max(0, Math.floor(((top - sprite.top) / sprite.height) * mask.height));
  const lastY = Math.min(mask.height - 1, Math.floor(((bottom - sprite.top) / sprite.height) * mask.height));
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      const sourceX = mirrorX ? mask.width - 1 - x : x;
      if (mask.pixels[y * mask.width + sourceX]) return true;
    }
  }
  return false;
};

const alphaMasksOverlap = (
  firstMask: SpriteAlphaMask,
  firstRect: SpriteRect,
  secondMask: SpriteAlphaMask,
  secondRect: SpriteRect,
  secondMirrorX = false
) => {
  const left = Math.max(firstRect.left, secondRect.left);
  const right = Math.min(firstRect.left + firstRect.width, secondRect.left + secondRect.width);
  const top = Math.max(firstRect.top, secondRect.top);
  const bottom = Math.min(firstRect.top + firstRect.height, secondRect.top + secondRect.height);
  if (left >= right || top >= bottom) return false;

  const firstX = Math.max(0, Math.floor(((left - firstRect.left) / firstRect.width) * firstMask.width));
  const lastX = Math.min(firstMask.width - 1, Math.floor(((right - firstRect.left) / firstRect.width) * firstMask.width));
  const firstY = Math.max(0, Math.floor(((top - firstRect.top) / firstRect.height) * firstMask.height));
  const lastY = Math.min(firstMask.height - 1, Math.floor(((bottom - firstRect.top) / firstRect.height) * firstMask.height));

  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      if (!firstMask.pixels[y * firstMask.width + x]) continue;
      const cell: SpriteRect = {
        left: firstRect.left + x * firstRect.width / firstMask.width,
        top: firstRect.top + y * firstRect.height / firstMask.height,
        width: firstRect.width / firstMask.width,
        height: firstRect.height / firstMask.height
      };
      if (alphaMaskTouchesRect(secondMask, secondRect, cell, secondMirrorX)) return true;
    }
  }
  return false;
};

const getAnswerLanePositions = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches
    ? [63, 47, 31, 15]
    : [65, 48, 31, 14];

const getMonsterBoxSize = (stageWidth: number, compact: boolean) =>
  compact ? Math.min(104, Math.max(82, stageWidth * 0.11)) : 250;

const getQuestionOptionText = (option: string | QuestionOption) =>
  typeof option === 'string' ? option : option.text;

const requestMobileFullscreen = () => {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  if (document.fullscreenElement || window.matchMedia('(display-mode: fullscreen)').matches) return;
  const request = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  void request?.catch(() => {});
};

const ObstacleLayer = memo(function ObstacleLayer({
  obstacles,
  stageWidth,
  stageHeight,
  boxSize
}: {
  obstacles: Obstacle[];
  stageWidth: number;
  stageHeight: number;
  boxSize: number;
}) {
  return (
    <>
      {obstacles.map((obs) => (
        <div
          key={obs.id}
          id={`obstacle-${obs.id}`}
          className="scrolling-obstacle"
          style={{
            left: 0,
            bottom: 0,
            width: boxSize,
            height: boxSize,
            translate: `${(obs.x / 100) * stageWidth}px ${(-obs.y / 100) * stageHeight}px`
          }}
        >
          <img src="/monster.png?v=2" alt="عائق" style={{ transform: 'scaleX(-1)' }} />
        </div>
      ))}
    </>
  );
});


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
  const [gameState, setGameState] = useState<'welcome' | 'playing' | 'celebration' | 'gameover'>('welcome');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [apiQuestions, setApiQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  // Touch dragging and mouse movement target the plane without React state updates.
  const touchMovePointerRef = useRef<number | null>(null);
  const mouseTargetRef = useRef<{ x: number, y: number } | null>(null);

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
            const normalizedOptions: Array<string | QuestionOption> = Array.isArray(parsedOptions)
              ? parsedOptions.map((option: any) => {
                  if (typeof option === 'string') return option;
                  return {
                    text: String(option?.text ?? ''),
                    imageUrl: option?.imageUrl ?? option?.image ?? null
                  };
                })
              : [];

            const correctAnswerText = q.correctAnswer;
            const answerIndex = normalizedOptions.findIndex(option => getQuestionOptionText(option) === correctAnswerText);

            return {
              id: q.id,
              question: String(q.question ?? q.text ?? ''),
              options: normalizedOptions,
              answerIndex: answerIndex >= 0 ? answerIndex : 0,
              category: 'general',
              categoryName: data.data.lessonName,
              audioUrl: q.audioUrl || q.audio || null,
              imageUrl: q.imageUrl || q.image || null
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
  
  const [isPhonePortrait, setIsPhonePortrait] = useState<boolean>(false);

  // Styling and Animation Effects
  const [planeEffect, setPlaneEffect] = useState<'normal' | 'boost' | 'shake'>('normal');
  const planeEffectRef = useRef(planeEffect);
  useEffect(() => {
    planeEffectRef.current = planeEffect;
  }, [planeEffect]);
  const [laser, setLaser] = useState<LaserPath>({ x1: 0, y1: 0, x2: 0, y2: 0, color: 'cyan', visible: false });
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const particleIdRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<any>(null);

  const skyRef = useRef<HTMLDivElement>(null);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const [, setStageLayoutRevision] = useState(0);
  const planeSizePctRef = useRef({
    width: 0, height: 0, left: 0, bottom: 0,
    spriteWidth: 0, spriteHeight: 0
  });
  const planeAlphaMaskRef = useRef<SpriteAlphaMask | null>(null);
  const monsterAlphaMaskRef = useRef<SpriteAlphaMask | null>(null);
  const monsterMaskLoadStartedRef = useRef(false);
  const updatePlaneMetricsRef = useRef<() => void>(() => {});
  const planeRef = useRef<HTMLImageElement>(null);
  const playerBulletLayerRef = useRef<HTMLCanvasElement>(null);
  const drawPlayerBulletsRef = useRef<() => void>(() => {});
  const abilityCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawAbilitiesRef = useRef<(time: number) => void>(() => {});
  const explosionCanvasRef = useRef<HTMLCanvasElement>(null);
  const explosionParticlesRef = useRef<ExplosionParticle[]>([]);
  const explosionFrameRef = useRef<number | null>(null);
  const drawExplosionsRef = useRef<(time: number) => void>(() => {});

  const monsterRef = useRef<HTMLImageElement>(null);

  // Gameplay loop coordinates and physics refs
  const planeXRef = useRef<number>(20);
  const planeYRef = useRef<number>(50);
  const planeLaneRef = useRef<number>(1);
  const isInvincibleRef = useRef<boolean>(false);
  const hasShieldRef = useRef<boolean>(false);
  const invincibilityTimeRef = useRef<number>(0);


  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  const obstaclesRef = useRef<Obstacle[]>([
    { id: 1, x: 110, y: 25, speed: 0.35, type: 1, hasShot: false, hp: 2 },
    { id: 2, x: 150, y: 55, speed: 0.4, type: 2, hasShot: false, hp: 2 },
    { id: 3, x: 190, y: 75, speed: 0.3, type: 3, hasShot: false, hp: 2 }
  ]);

  const obstacleBulletsRef = useRef<ObstacleBullet[]>([]);
  const bulletIdCounterRef = useRef<number>(0);

  // Player bullets state & refs
  const playerBulletsRef = useRef<PlayerBullet[]>([]);
  const playerBulletIdCounterRef = useRef<number>(0);

  // Collectible hearts
  const heartsRef = useRef<DropHeart[]>([]);
  const heartIdCounterRef = useRef<number>(0);

  // Collectible weapon upgrades
  const weaponDropsRef = useRef<WeaponDrop[]>([]);
  const weaponDropIdCounterRef = useRef<number>(0);
  const monstersKilledRef = useRef<number>(0);
  const nextUpgradeKillsRef = useRef<number>(5);
  const weaponLevelRef = useRef<number>(1);
  const weaponUpgradeTimeRef = useRef<number>(0);

  // Collectible shields
  const shieldDropsRef = useRef<ShieldDrop[]>([]);
  const shieldDropIdCounterRef = useRef<number>(0);

  // Moving cloud options ref
  const cloudsRef = useRef<CloudOption[]>([]);
  const cloudSizeRef = useRef<Map<number, { width: number; height: number }>>(new Map());

  // Auto fire interval ref
  const autoFireIntervalRef = useRef<any>(null);


  const initClouds = (question: Question) => {
    if (!question) return;
    const lanePositionsNum = getAnswerLanePositions();
    cloudsRef.current = question.options.map((option, idx) => ({
      idx,
      text: getQuestionOptionText(option),
      x: 100 + (idx * 6), // Staggered slightly
      y: lanePositionsNum[idx],
      speed: 0.08 + Math.random() * 0.04, // Smooth slow speed so player has time to read
      isActive: true
    }));
  };

  useEffect(() => {
    const elements = cloudsRef.current
      .map(cloud => document.getElementById(`cloud-option-${cloud.idx}`))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    const measure = () => {
      const sizes = new Map<number, { width: number; height: number }>();
      cloudsRef.current.forEach((cloud) => {
        const element = document.getElementById(`cloud-option-${cloud.idx}`);
        if (element) sizes.set(cloud.idx, { width: element.offsetWidth, height: element.offsetHeight });
      });
      cloudSizeRef.current = sizes;
    };
    measure();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    elements.forEach(element => observer?.observe(element));
    return () => observer?.disconnect();
  }, [currentQuestionIndex, gameState, isFlyingOver, isPhonePortrait, questions]);

  useEffect(() => {
    const checkOrientation = () => {
      // Reliable phone detection (excluding tablets like iPad)
      const isPhone = /iPhone|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPhonePortrait(isPhone && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleStartClick = (category: string) => {
    startGame(category);
  };

  const startGame = async (category: string) => {
    requestMobileFullscreen();
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
    const selectedQuestions = apiQuestions;
    const shuffled = [...selectedQuestions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setLives(3);
    setPlaneLane(1);
    setStarsSync(0);
    setIsBossCrashing(false);

    obstacleBulletsRef.current = [];
    bulletIdCounterRef.current = 0;

    playerBulletsRef.current = [];
    playerBulletIdCounterRef.current = 0;

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
    heartIdCounterRef.current = 0;

    weaponDropsRef.current = [];
    weaponDropIdCounterRef.current = 0;
    monstersKilledRef.current = 0;
    nextUpgradeKillsRef.current = 4;
    weaponLevelRef.current = 1;
    weaponUpgradeTimeRef.current = 0;

    shieldDropsRef.current = [];
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
      // Auto-speech removed per request. Audio will only play when user clicks the play button.
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

  const updatePlaneTargetFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = skyRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.max(5, Math.min(55, ((e.clientX - rect.left) / rect.width) * 100));
    const verticalProgress = (e.clientY - rect.top) / rect.height;
    const minPlaneY = -planeSizePctRef.current.bottom;
    const y = 85 + (minPlaneY - 85) * verticalProgress;
    mouseTargetRef.current = { x, y };
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('.sky-hud-header, .mobile-controls-overlay, button, a')) return;
    e.preventDefault();
    touchMovePointerRef.current = e.pointerId;
    updatePlaneTargetFromPointer(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      updatePlaneTargetFromPointer(e);
      return;
    }
    if (touchMovePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updatePlaneTargetFromPointer(e);
  };

  const handleStagePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchMovePointerRef.current !== e.pointerId) return;
    touchMovePointerRef.current = null;
  };

  // Gameplay / Obstacles Loop & Invincibility Checking
  useEffect(() => {
    if (gameState !== 'playing') return;

    let animId: number;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const isCompactScreen = window.matchMedia('(pointer: coarse), (max-width: 950px)').matches;
    const minFrameDuration = isMobile ? 1000 / 30 : 0;
    const mobileGameSpeed = isMobile ? 0.86 : 1;
    let previousFrameTime = 0;
    let lastUpdateTime = 0;
    let answerLanePositions = getAnswerLanePositions();

    const updateStageSize = () => {
      const width = skyRef.current?.clientWidth || window.innerWidth;
      const height = skyRef.current?.clientHeight || window.innerHeight;
      stageSizeRef.current = {
        width,
        height
      };
      setStageLayoutRevision(revision => revision + 1);
      answerLanePositions = getAnswerLanePositions();
      cloudsRef.current.forEach((cloud) => {
        cloud.y = answerLanePositions[cloud.idx] ?? cloud.y;
      });
      const spriteWidth = planeRef.current?.offsetWidth || 185;
      const spriteHeight = planeRef.current?.offsetHeight || spriteWidth * 682 / 1024;
      const alphaLeft = 103 / 1024;
      const alphaTop = 111 / 682;
      const alphaWidth = (891 - 103 + 1) / 1024;
      const alphaHeight = (529 - 111 + 1) / 682;
      planeSizePctRef.current = {
        width: (spriteWidth * alphaWidth / width) * 100,
        height: (spriteHeight * alphaHeight / height) * 100,
        left: (spriteWidth * alphaLeft / width) * 100,
        bottom: (spriteHeight * (1 - alphaTop - alphaHeight) / height) * 100,
        spriteWidth: (spriteWidth / width) * 100,
        spriteHeight: (spriteHeight / height) * 100
      };

      // Build a compact occupancy mask once. A rectangular hitbox includes the
      // transparent corners around this sprite, which is why bullets appeared
      // to hit while visibly below or beside the plane.
      const image = planeRef.current;
      if (image?.complete && image.naturalWidth > 0 && !planeAlphaMaskRef.current) {
        // Exhaust plumes are visible effects, not part of the aircraft hull.
        planeAlphaMaskRef.current = createSpriteAlphaMask(image, (x, y) =>
          x >= image.naturalWidth * 0.22 && y <= image.naturalHeight * 0.74
        );
      }

      if (!monsterAlphaMaskRef.current && !monsterMaskLoadStartedRef.current) {
        monsterMaskLoadStartedRef.current = true;
        const monsterImage = new Image();
        monsterImage.onload = () => {
          // The enemy image is mirrored in the scene. Clip its rear exhaust in
          // source coordinates before using the mirrored mask for collisions.
          monsterAlphaMaskRef.current = createSpriteAlphaMask(monsterImage, x =>
            x >= monsterImage.naturalWidth * 0.28
          );
        };
        monsterImage.src = '/monster.png?v=2';
      }
    };
    updatePlaneMetricsRef.current = updateStageSize;
    updateStageSize();
    window.addEventListener('resize', updateStageSize);

    planeXRef.current = 20;
    planeYRef.current = 50;
    planeLaneRef.current = 1;
    isInvincibleRef.current = false;
    setIsInvincible(false);

    const getSafeObstacleY = (preferredY?: number) => {
      const stageHeight = stageSizeRef.current.height || window.innerHeight;
      const boxSize = getMonsterBoxSize(stageSizeRef.current.width || window.innerWidth, isCompactScreen);
      const headerHeight = skyRef.current?.querySelector('.sky-hud-header')?.getBoundingClientRect().height
        ?? (isCompactScreen ? 56 : 72);
      const minY = 12;
      const maxY = Math.max(minY, 100 - ((headerHeight + 16 + boxSize) / stageHeight) * 100);
      return preferredY === undefined
        ? minY + Math.random() * (maxY - minY)
        : Math.max(minY, Math.min(maxY, preferredY));
    };

    obstaclesRef.current = [
      { id: 1, x: 110, y: getSafeObstacleY(25), speed: 0.35, type: 1, hasShot: false, hp: 2 },
      { id: 2, x: 150, y: getSafeObstacleY(55), speed: 0.4, type: 2, hasShot: false, hp: 2 },
      { id: 3, x: 190, y: getSafeObstacleY(60), speed: 0.3, type: 3, hasShot: false, hp: 2 }
    ];

    const loop = (time: number) => {
      if (minFrameDuration && time - previousFrameTime < minFrameDuration) {
        animId = requestAnimationFrame(loop);
        return;
      }
      previousFrameTime = time;
      const frameScale = Math.min((time - (lastUpdateTime || time - 1000 / 60)) / (1000 / 60), 2.5) * mobileGameSpeed;
      lastUpdateTime = time;
      const boostScale = planeEffectRef.current === 'boost' ? 1.15 : 1;
      const planeWidthPct = planeSizePctRef.current.width * boostScale;
      const planeHeightPct = planeSizePctRef.current.height * boostScale;
      const enemyBulletWidthPct = ((isCompactScreen ? 12 : 25) / stageSizeRef.current.width) * 100;
      const enemyBulletHeightPct = ((isCompactScreen ? 4 : 8) / stageSizeRef.current.height) * 100;

      if (isBossCrashing) {
        animId = requestAnimationFrame(loop);
        return;
      }

      // 1. Keyboards movement
      const speed = 0.38 * frameScale;
      let dx = 0;
      let dy = 0;
      let usedKeyboard = false;
      if (keysPressedRef.current['ArrowUp'] || keysPressedRef.current['w'] || keysPressedRef.current['W']) {
        dy += speed; usedKeyboard = true;
      }
      if (keysPressedRef.current['ArrowDown'] || keysPressedRef.current['s'] || keysPressedRef.current['S']) {
        dy -= speed; usedKeyboard = true;
      }
      if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['a'] || keysPressedRef.current['A']) {
        dx -= speed; usedKeyboard = true;
      }
      if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['d'] || keysPressedRef.current['D']) {
        dx += speed; usedKeyboard = true;
      }

      if (usedKeyboard) {
        mouseTargetRef.current = null;
      } else if (mouseTargetRef.current) {
        const targetX = mouseTargetRef.current.x;
        const targetY = mouseTargetRef.current.y;
        const diffX = targetX - planeXRef.current;
        const diffY = targetY - planeYRef.current;
        const followFactor = 1 - Math.pow(isMobile ? 0.65 : 0.9, frameScale);
        if (Math.abs(diffX) > 0.5) dx += diffX * followFactor;
        if (Math.abs(diffY) > 0.5) dy += diffY * followFactor;
      }

      if (isMobile && dx < 0) dx *= 0.65;

      planeXRef.current = Math.max(5, Math.min(55, planeXRef.current + dx));
      const minPlaneY = -planeSizePctRef.current.bottom;
      planeYRef.current = Math.max(minPlaneY, Math.min(85, planeYRef.current + dy));

      const planeSpriteWidthPx = (planeSizePctRef.current.spriteWidth / 100) * stageSizeRef.current.width;
      const planeSpriteHeightPx = (planeSizePctRef.current.spriteHeight / 100) * stageSizeRef.current.height;
      const planeSpriteLeftPx = (planeXRef.current / 100) * stageSizeRef.current.width - planeSpriteWidthPx * (boostScale - 1) / 2;
      const planeSpriteBottomPx = (planeYRef.current / 100) * stageSizeRef.current.height - planeSpriteHeightPx * (boostScale - 1) / 2;
      const planeSpriteWidthScaledPx = planeSpriteWidthPx * boostScale;
      const planeSpriteHeightScaledPx = planeSpriteHeightPx * boostScale;
      const planeSpriteTopPx = stageSizeRef.current.height - planeSpriteBottomPx - planeSpriteHeightScaledPx;
      const planeSpriteRect: SpriteRect = {
        left: planeSpriteLeftPx,
        top: planeSpriteTopPx,
        width: planeSpriteWidthScaledPx,
        height: planeSpriteHeightScaledPx
      };
      const planeHitboxLeft = planeXRef.current - planeSizePctRef.current.spriteWidth * (boostScale - 1) / 2 + planeSizePctRef.current.left * boostScale;
      const planeHitboxBottom = planeYRef.current - planeSizePctRef.current.spriteHeight * (boostScale - 1) / 2 + planeSizePctRef.current.bottom * boostScale;
      const planeCenterX = planeHitboxLeft + planeWidthPct / 2;
      const planeCenterY = planeHitboxBottom + planeHeightPct / 2;
      const planeFallbackRect: SpriteRect = {
        left: (planeHitboxLeft / 100) * stageSizeRef.current.width,
        top: stageSizeRef.current.height - ((planeHitboxBottom + planeHeightPct) / 100) * stageSizeRef.current.height,
        width: (planeWidthPct / 100) * stageSizeRef.current.width,
        height: (planeHeightPct / 100) * stageSizeRef.current.height
      };
      const planeTouchesRect = (target: SpriteRect) => planeAlphaMaskRef.current
        ? alphaMaskTouchesRect(planeAlphaMaskRef.current, planeSpriteRect, target)
        : planeFallbackRect.left < target.left + target.width &&
          planeFallbackRect.left + planeFallbackRect.width > target.left &&
          planeFallbackRect.top < target.top + target.height &&
          planeFallbackRect.top + planeFallbackRect.height > target.top;
      const pickupRect = (x: number, y: number, size: number): SpriteRect => ({
        left: (x / 100) * stageSizeRef.current.width,
        top: stageSizeRef.current.height - (y / 100) * stageSizeRef.current.height - size,
        width: size,
        height: size
      });

      if (keysPressedRef.current[' '] || keysPressedRef.current['Enter']) {
        firePlayerBullet();
      }

      // Update plane position directly on DOM
      const planeWrapper = planeRef.current?.parentElement;
      if (planeWrapper) {
        planeWrapper.style.translate = `${(planeXRef.current / 100) * stageSizeRef.current.width}px ${(-planeYRef.current / 100) * stageSizeRef.current.height}px`;
      }

      // Track and highlight closest target lane
      let closestLaneIdx = 0;
      let minDiff = Infinity;
      answerLanePositions.forEach((laneBottom, idx) => {
        const optionHeight = cloudSizeRef.current.get(idx)?.height ?? 60;
        const laneCenter = laneBottom + (optionHeight / 2 / stageSizeRef.current.height) * 100;
        const diff = Math.abs(planeCenterY - laneCenter);
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
        obs.x -= obs.speed * frameScale;
        if (obs.x < -15) {
          obs.x = 110 + Math.random() * 20;
          obs.y = getSafeObstacleY();
          obs.speed = 0.3 + Math.random() * 0.2;
          obs.hasShot = false;
        }

        const obsEl = document.getElementById(`obstacle-${obs.id}`);
        if (obsEl) {
          obsEl.style.translate = `${(obs.x / 100) * stageSizeRef.current.width}px ${(-obs.y / 100) * stageSizeRef.current.height}px`;
          obsEl.style.display = 'block';
        }

        // Spawn from the front tip of the mirrored enemy sprite.
        if (!obs.hasShot && obs.x < 98) {
          obs.hasShot = true;
          const newId = ++bulletIdCounterRef.current;
          const monsterMask = monsterAlphaMaskRef.current;
          const monsterBoxSize = getMonsterBoxSize(stageSizeRef.current.width, isCompactScreen);
          const monsterImageHeight = monsterBoxSize / 1.5;
          const monsterImageTop = (monsterBoxSize - monsterImageHeight) / 2;
          const monsterVisibleLeft = monsterBoxSize * ((1536 - 1 - 1413) / 1536);
          const noseX = monsterMask
            ? monsterBoxSize * (1 - (monsterMask.noseColumn + 0.5) / monsterMask.width)
            : monsterVisibleLeft;
          const noseYFromTop = monsterMask
            ? monsterImageTop + ((monsterMask.noseRow + 0.5) / monsterMask.height) * monsterImageHeight
            : monsterImageTop + 0.58 * monsterImageHeight;
          obstacleBulletsRef.current.push({
            id: newId,
            x: obs.x + (noseX / stageSizeRef.current.width) * 100,
            y: obs.y + ((monsterBoxSize - noseYFromTop) / stageSizeRef.current.height) * 100,
            speed: 0.65
          });
        }
      });

      const skyW = window.innerWidth;
      const skyH = window.innerHeight;
      const getPxDist = (x1Pct, y1Pct, x2Pct, y2Pct) => {
        const px1 = (x1Pct / 100) * skyW;
        const py1 = skyH - (y1Pct / 100) * skyH;
        const px2 = (x2Pct / 100) * skyW;
        const py2 = skyH - (y2Pct / 100) * skyH;
        return Math.sqrt((px1 - px2)**2 + (py1 - py2)**2);
      };
      
      const checkOverlapPct = (x1, y1, x2, y2, thresholdX, thresholdY) => {
        return Math.abs(x1 - x2) < thresholdX && Math.abs(y1 - y2) < thresholdY;
      };

      const monsterSpriteRect = (obs: Obstacle): SpriteRect => {
        const boxSize = getMonsterBoxSize(stageSizeRef.current.width, isCompactScreen);
        const imageHeight = boxSize / 1.5;
        const imageTop = (boxSize - imageHeight) / 2;
        return {
          left: (obs.x / 100) * stageSizeRef.current.width,
          top: stageSizeRef.current.height - (obs.y / 100) * stageSizeRef.current.height - boxSize + imageTop,
          width: boxSize,
          height: imageHeight
        };
      };

      // 3b. Update obstacle bullets movement & collision
      const activeBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      activeBullets.forEach((bullet) => {
        bullet.x -= bullet.speed * frameScale;

        // Check collision in scene percentages without reading each bullet's
        // DOM bounds (which forced layout once per active projectile).
        if (!isInvincibleRef.current && !isFlyingOver) {
          const mask = planeAlphaMaskRef.current;
          const bulletLeftPx = (bullet.x / 100) * stageSizeRef.current.width;
          const bulletTopPx = stageSizeRef.current.height - (bullet.y / 100) * stageSizeRef.current.height - enemyBulletHeightPct / 2 / 100 * stageSizeRef.current.height;
          const bulletRightPx = bulletLeftPx + enemyBulletWidthPct / 100 * stageSizeRef.current.width;
          const bulletBottomPx = bulletTopPx + enemyBulletHeightPct / 100 * stageSizeRef.current.height;
          let overlapsPlane = false;

          if (mask && planeSpriteWidthScaledPx > 0 && planeSpriteHeightScaledPx > 0) {
            const left = Math.max(0, Math.floor(((bulletLeftPx - planeSpriteLeftPx) / planeSpriteWidthScaledPx) * mask.width));
            const right = Math.min(mask.width - 1, Math.floor(((bulletRightPx - planeSpriteLeftPx) / planeSpriteWidthScaledPx) * mask.width));
            const top = Math.max(0, Math.floor(((bulletTopPx - planeSpriteTopPx) / planeSpriteHeightScaledPx) * mask.height));
            const bottom = Math.min(mask.height - 1, Math.floor(((bulletBottomPx - planeSpriteTopPx) / planeSpriteHeightScaledPx) * mask.height));

            for (let maskY = top; maskY <= bottom && !overlapsPlane; maskY += 1) {
              for (let maskX = left; maskX <= right; maskX += 1) {
                if (mask.pixels[maskY * mask.width + maskX]) {
                  overlapsPlane = true;
                  break;
                }
              }
            }
          } else {
            const bulletBottom = bullet.y - enemyBulletHeightPct / 2;
            const bulletTop = bullet.y + enemyBulletHeightPct / 2;
            const overlapsPlaneX = bullet.x < planeHitboxLeft + planeWidthPct &&
              bullet.x + enemyBulletWidthPct > planeHitboxLeft;
            const overlapsPlaneY = bulletTop > planeHitboxBottom &&
              bulletBottom < planeHitboxBottom + planeHeightPct;
            overlapsPlane = overlapsPlaneX && overlapsPlaneY;
          }

          if (overlapsPlane) {
            handleObstacleHit();
            isInvincibleRef.current = true;
            setIsInvincible(true);
            invincibilityTimeRef.current = Date.now() + 1500;
            bullet.x = -20; // Trigger removal
          }
        }
      });

      const cleanBullets = obstacleBulletsRef.current.filter(b => b.x > -10);
      if (cleanBullets.length !== obstacleBulletsRef.current.length) {
        obstacleBulletsRef.current = cleanBullets;
      }

      // 3c. Update clouds movement & collision
      cloudsRef.current.forEach((cloud) => {
        if (!isFlyingOver) {
          cloud.x -= cloud.speed * frameScale;
          if (cloud.x < -35) {
            cloud.x = 105;
          }
        }

        const cloudEl = document.getElementById(`cloud-option-${cloud.idx}`);
        if (cloudEl) {
          cloudEl.style.translate = `${(cloud.x / 100) * stageSizeRef.current.width}px 0px`;

          if (!cloud.isActive) {
            cloudEl.style.opacity = '0';
            cloudEl.style.pointerEvents = 'none';
          } else {
            cloudEl.style.opacity = '1';
            cloudEl.style.pointerEvents = isAnswerChecked ? 'none' : 'auto';
          }
        }

        // Check collision with player plane
        if (!isAnswerCheckedRef.current && !isFlyingOver && cloud.isActive) {
          const optionSize = cloudSizeRef.current.get(cloud.idx) ?? { width: 240, height: 70 };
          const answerBottomPx = (cloud.y / 100) * stageSizeRef.current.height;
          const answerRect: SpriteRect = {
            left: (cloud.x / 100) * stageSizeRef.current.width,
            top: stageSizeRef.current.height - answerBottomPx - optionSize.height - 24,
            width: optionSize.width,
            height: optionSize.height + 24
          };
          if (planeTouchesRect(answerRect)) {
            cloud.isActive = false;
            handleCloudCollision(cloud);
          }
        }
      });

      // 3d. Update player bullets movement & collision with monsters
      const activePlayerBullets = playerBulletsRef.current.filter(b => b.x < 110);
      activePlayerBullets.forEach((bullet) => {
        bullet.x += bullet.speed * frameScale;

        obstaclesRef.current.forEach((obs) => {
          if (obs.x < 110 && bullet.x < 110) {
            const enemyMask = monsterAlphaMaskRef.current;
            const enemyRect = monsterSpriteRect(obs);
            const bulletWidthPx = isCompactScreen ? 12 : 25;
            const bulletHeightPx = isCompactScreen ? 4 : 8;
            const bulletRect: SpriteRect = {
              left: (bullet.x / 100) * stageSizeRef.current.width,
              top: stageSizeRef.current.height - (bullet.y / 100) * stageSizeRef.current.height - bulletHeightPx / 2,
              width: bulletWidthPx,
              height: bulletHeightPx
            };
            const hitsEnemy = enemyMask
              ? alphaMaskTouchesRect(enemyMask, enemyRect, bulletRect, true)
              : getPxDist(bullet.x, bullet.y, obs.x, obs.y) < 45;

            if (hitsEnemy) {
              // Decrement monster health
              obs.hp = (obs.hp || 2) - 1;
              bullet.x = 200; // Trigger bullet removal

              const ptX = bulletRect.left + bulletRect.width / 2;
              const ptY = bulletRect.top + bulletRect.height / 2;
              fireExplosion(ptX, ptY, 'red');

              if (obs.hp <= 0) {
                audio.playExplosion();
                const obsEl = document.getElementById(`obstacle-${obs.id}`);
                if (obsEl) obsEl.style.display = 'none';

                // Handle drops
                monstersKilledRef.current += 1;
                if (monstersKilledRef.current >= nextUpgradeKillsRef.current) {
                  const wId = ++weaponDropIdCounterRef.current;
                  weaponDropsRef.current.push({ id: wId, x: obs.x, y: obs.y });
                  monstersKilledRef.current = 0;
                  nextUpgradeKillsRef.current = 3 + Math.floor(Math.random() * 4);
                } else if (Math.random() < 0.15) {
                  const sId = ++shieldDropIdCounterRef.current;
                  shieldDropsRef.current.push({ id: sId, x: obs.x, y: obs.y });
                } else if (livesRef.current < 3 && Math.random() < 0.3) {
                  const hId = ++heartIdCounterRef.current;
                  heartsRef.current.push({ id: hId, x: obs.x, y: obs.y });
                }

                // Reset/respawn
                obs.x = 115 + Math.random() * 20;
                obs.y = getSafeObstacleY();
                obs.speed = 0.3 + Math.random() * 0.2;
                obs.hasShot = false;
                obs.hp = 2;
              } else {
                const obsEl = document.getElementById(`obstacle-${obs.id}`);
                if (obsEl) {
                  obsEl.classList.add('hit-flash');
                  setTimeout(() => obsEl.classList.remove('hit-flash'), 100);
                }
              }
            }
          }
        });
      });

      playerBulletsRef.current = activePlayerBullets.filter(bullet => {
        if (bullet.x < 110) return true;
        return false;
      });

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
      if (!isInvincibleRef.current && !isFlyingOver) {
        obstaclesRef.current.forEach((obs) => {
          const planeMask = planeAlphaMaskRef.current;
          const monsterMask = monsterAlphaMaskRef.current;
          const collidesWithMonster = planeMask && monsterMask
            ? alphaMasksOverlap(planeMask, planeSpriteRect, monsterMask, monsterSpriteRect(obs), true)
            : getPxDist(planeCenterX, planeCenterY, obs.x, obs.y) < 60;
          if (collidesWithMonster) {
            handleObstacleHit();
            isInvincibleRef.current = true;
            setIsInvincible(true);
            invincibilityTimeRef.current = Date.now() + 1500;
          }
        });
      }

      // 6. Update and check collectible hearts
      let activeHearts = heartsRef.current;
      let heartsChanged = false;
      const uncollectedHearts = [];

      activeHearts.forEach(heart => {
        heart.x -= 0.35 * frameScale;
        if (heart.x < -10) { heartsChanged = true; return; }

        if (!isFlyingOver && planeTouchesRect(pickupRect(heart.x, heart.y, 32))) {
          heartsChanged = true;
          audio.playSuccess();
          setLives(prev => prev < 3 ? prev + 1 : prev);
          setPlaneEffect('boost');
          setTimeout(() => setPlaneEffect('normal'), 500);
          return;
        }
        uncollectedHearts.push(heart);
      });

      if (heartsChanged) {
        heartsRef.current = uncollectedHearts;
      }

      // 7. Update and check collectible weapons
      let activeWeapons = weaponDropsRef.current;
      let weaponsChanged = false;
      const uncollectedWeapons = [];

      activeWeapons.forEach(weapon => {
        weapon.x -= 0.35 * frameScale;
        if (weapon.x < -10) { weaponsChanged = true; return; }

        if (!isFlyingOver && planeTouchesRect(pickupRect(weapon.x, weapon.y, 40))) {
          weaponsChanged = true;
          audio.playSuccess();
          weaponLevelRef.current = Math.min(3, weaponLevelRef.current + 1);
          weaponUpgradeTimeRef.current = Date.now() + 10000;
          setPlaneEffect('boost');
          setTimeout(() => setPlaneEffect('normal'), 500);
          return;
        }
        uncollectedWeapons.push(weapon);
      });

      if (weaponsChanged) {
        weaponDropsRef.current = uncollectedWeapons;
      }

      // 8. Update and check collectible shields
      let activeShields = shieldDropsRef.current;
      let shieldsChanged = false;
      const uncollectedShields = [];

      activeShields.forEach(shield => {
        shield.x -= 0.35 * frameScale;
        if (shield.x < -10) { shieldsChanged = true; return; }

        if (!isFlyingOver && planeTouchesRect(pickupRect(shield.x, shield.y, 40))) {
          shieldsChanged = true;
          audio.playSuccess();
          isInvincibleRef.current = true;
          setIsInvincible(true);
          hasShieldRef.current = true;
          setHasActiveShield(true);
          invincibilityTimeRef.current = Date.now() + 5000;
          return;
        }
        uncollectedShields.push(shield);
      });

      if (shieldsChanged) {
        shieldDropsRef.current = uncollectedShields;
      }

      drawPlayerBulletsRef.current();
      drawAbilitiesRef.current(time);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateStageSize);
      updatePlaneMetricsRef.current = () => {};
    };
  }, [gameState, isBossCrashing, isFlyingOver]);

  // Draw all player shots in one canvas pass instead of maintaining and
  // repositioning a DOM node for every projectile on every frame.
  useEffect(() => {
    const canvas = playerBulletLayerRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context || gameState !== 'playing') {
      drawPlayerBulletsRef.current = () => {};
      return;
    }

    const isMobile = window.matchMedia('(pointer: coarse), (max-width: 950px)').matches;
    let width = 0;
    let height = 0;
    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const drawBullet = (bullet: { x: number; y: number }, color: string, glow: string) => {
        const bulletWidth = isMobile ? 12 : 25;
        const bulletHeight = isMobile ? 4 : 8;
        const x = (bullet.x / 100) * width;
        const y = height - (bullet.y / 100) * height - bulletHeight / 2;
        context.fillStyle = color;
        context.shadowColor = isMobile ? 'transparent' : glow;
        context.shadowBlur = isMobile ? 0 : 5;
        context.beginPath();
        const radius = bulletHeight / 2;
        context.moveTo(x + radius, y);
        context.arcTo(x + bulletWidth, y, x + bulletWidth, y + bulletHeight, radius);
        context.arcTo(x + bulletWidth, y + bulletHeight, x, y + bulletHeight, radius);
        context.arcTo(x, y + bulletHeight, x, y, radius);
        context.arcTo(x, y, x + bulletWidth, y, radius);
        context.closePath();
        context.fill();
      };

      obstacleBulletsRef.current.forEach((bullet) => drawBullet(bullet, '#ff684b', '#ff4e50'));
      playerBulletsRef.current.forEach((bullet) => drawBullet(bullet, '#00dff5', '#00e5ff'));
      context.shadowBlur = 0;

      context.shadowBlur = 0;
    };

    resizeCanvas();
    drawPlayerBulletsRef.current = draw;
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      drawPlayerBulletsRef.current = () => {};
      context.clearRect(0, 0, width, height);
    };
  }, [gameState]);

  // Pickups use one canvas layer instead of React nodes and CSS animation.
  // The gameplay loop advances their ref positions and redraws only those icons.
  useEffect(() => {
    const canvas = abilityCanvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true, desynchronized: true });
    if (!canvas || !context || gameState !== 'playing') {
      drawAbilitiesRef.current = () => {};
      return;
    }

    const isMobile = window.matchMedia('(pointer: coarse), (max-width: 950px)').matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
    let width = 0;
    let height = 0;
    let previousRects: SpriteRect[] = [];
    const resizeCanvas = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      previousRects = [];
    };

    const drawIcon = (kind: 'heart' | 'weapon' | 'shield', x: number, y: number, size: number, color: string, time: number) => {
      const pulse = 1 + Math.sin(time / 180 + x / 80) * 0.055;
      const alpha = 0.86 + Math.sin(time / 180 + x / 80) * 0.14;
      const left = (x / 100) * width;
      const top = height - (y / 100) * height - size;

      context.save();
      context.globalAlpha = alpha;
      context.translate(left + size / 2, top + size / 2);
      context.scale((size / 24) * pulse, (size / 24) * pulse);
      context.translate(-12, -12);
      context.fillStyle = color;
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.lineJoin = 'round';
      context.shadowColor = color;
      context.shadowBlur = isMobile ? 3 : 9;
      context.beginPath();

      if (kind === 'heart') {
        context.moveTo(12, 21);
        context.bezierCurveTo(10.8, 19.9, 2, 13.8, 2, 8.4);
        context.bezierCurveTo(2, 4.7, 4.7, 2, 8, 2);
        context.bezierCurveTo(9.7, 2, 11, 3, 12, 4.6);
        context.bezierCurveTo(13, 3, 14.3, 2, 16, 2);
        context.bezierCurveTo(19.3, 2, 22, 4.7, 22, 8.4);
        context.bezierCurveTo(22, 13.8, 13.2, 19.9, 12, 21);
        context.closePath();
      } else if (kind === 'shield') {
        context.moveTo(12, 22);
        context.bezierCurveTo(10.2, 21.2, 4, 17.8, 4, 11);
        context.lineTo(4, 5.5);
        context.lineTo(12, 2);
        context.lineTo(20, 5.5);
        context.lineTo(20, 11);
        context.bezierCurveTo(20, 17.8, 13.8, 21.2, 12, 22);
        context.closePath();
      } else {
        context.moveTo(13.5, 1.5);
        context.lineTo(4.5, 13);
        context.lineTo(11, 13);
        context.lineTo(10.5, 22.5);
        context.lineTo(19.5, 10);
        context.lineTo(13, 10);
        context.closePath();
      }

      context.fill();
      context.stroke();
      context.restore();
      previousRects.push({ left, top, width: size, height: size });
    };

    const draw = (time: number) => {
      previousRects.forEach(rect => {
        context.clearRect(rect.left - 12, rect.top - 12, rect.width + 24, rect.height + 24);
      });
      previousRects = [];
      heartsRef.current.forEach(drop => drawIcon('heart', drop.x, drop.y, 32, '#ff3b65', time));
      weaponDropsRef.current.forEach(drop => drawIcon('weapon', drop.x, drop.y, 40, '#00d9ff', time));
      shieldDropsRef.current.forEach(drop => drawIcon('shield', drop.x, drop.y, 40, '#35dc77', time));
    };

    resizeCanvas();
    drawAbilitiesRef.current = draw;
    window.addEventListener('resize', resizeCanvas);
    return () => {
      drawAbilitiesRef.current = () => {};
      window.removeEventListener('resize', resizeCanvas);
      context.clearRect(0, 0, width, height);
      previousRects = [];
    };
  }, [gameState]);

  const handleObstacleHit = () => {
    audio.playExplosion();
    setPlaneEffect('shake');
    setLives(prev => {
      const nextLives = prev - 1;
      if (nextLives <= 0) {
        setTimeout(() => handleEndGame(false), 1500);
      } else {
        // audio.speakText removed
      }
      return nextLives;
    });
    setTimeout(() => {
      setPlaneEffect('normal');
    }, 1000);
  };

  // Keep fast projectile and explosion animation off React's render loop.
  useEffect(() => {
    const canvas = explosionCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || gameState !== 'playing') {
      explosionParticlesRef.current = [];
      return;
    }

    let previousTime = 0;
    let lastFrameTime = 0;
    const isMobile = window.matchMedia('(pointer: coarse), (max-width: 950px)').matches;
    const minFrameDuration = isMobile ? 1000 / 30 : 0;
    let canvasSize = { width: 0, height: 0 };
    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
      canvasSize = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.round(canvasSize.width * pixelRatio);
      canvas.height = Math.round(canvasSize.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawFrame = (time: number) => {
      explosionFrameRef.current = null;
      if (minFrameDuration && lastFrameTime && time - lastFrameTime < minFrameDuration) {
        explosionFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastFrameTime = time;
      const dt = Math.min((time - (previousTime || time)) / 1000, 0.04);
      previousTime = time;
      context.clearRect(0, 0, canvasSize.width, canvasSize.height);
      const particles = explosionParticlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += Math.cos(particle.angle) * particle.speed * dt;
        particle.y += Math.sin(particle.angle) * particle.speed * dt;
        particle.size -= 18 * dt;
        if (particle.size <= 0.5) {
          particles.splice(i, 1);
          continue;
        }
        context.globalAlpha = Math.min(1, particle.size / 5);
        context.fillStyle = particle.color === 'cyan' ? '#00e5ff' : '#ef4444';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (particles.length > 0) {
        explosionFrameRef.current = requestAnimationFrame(drawFrame);
      }
    };
    drawExplosionsRef.current = drawFrame;
    return () => {
      if (explosionFrameRef.current !== null) cancelAnimationFrame(explosionFrameRef.current);
      explosionFrameRef.current = null;
      drawExplosionsRef.current = () => {};
      window.removeEventListener('resize', resizeCanvas);
      context.clearRect(0, 0, canvas.width, canvas.height);
      explosionParticlesRef.current = [];
    };
  }, [gameState]);

  const fireExplosion = (x: number, y: number, color: 'cyan' | 'red' = 'red') => {
    const particles = explosionParticlesRef.current;
    const particleCount = window.matchMedia('(pointer: coarse)').matches ? 7 : 12;
    for (let i = 0; i < particleCount; i += 1) {
      particles.push({
        id: ++particleIdRef.current,
        x,
        y,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 220 + 70,
        size: Math.random() * 3 + 2,
        color
      });
    }
    if (particles.length > 72) particles.splice(0, particles.length - 72);
    if (explosionFrameRef.current === null) {
      explosionFrameRef.current = requestAnimationFrame(drawExplosionsRef.current);
    }
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
    const boostScale = planeEffectRef.current === 'boost' ? 1.15 : 1;
    const mask = planeAlphaMaskRef.current;
    const spriteLeft = planeXRef.current - planeSizePctRef.current.spriteWidth * (boostScale - 1) / 2;
    const spriteBottom = planeYRef.current - planeSizePctRef.current.spriteHeight * (boostScale - 1) / 2;
    const spawnX = spriteLeft + (mask
      ? ((mask.noseColumn + 1) / mask.width) * planeSizePctRef.current.spriteWidth * boostScale
      : (planeSizePctRef.current.left + planeSizePctRef.current.width) * boostScale);
    const spawnY = spriteBottom + (mask
      ? (1 - (mask.noseRow + 0.5) / mask.height) * planeSizePctRef.current.spriteHeight * boostScale
      : planeSizePctRef.current.bottom * boostScale);
    const addBullet = (id: number, x: number, y: number) => {
      playerBulletsRef.current.push({ id, x, y, speed: 1.5 });

      // Keep projectile work bounded if a device pauses animation frames
      // while the player continues holding fire.
      while (playerBulletsRef.current.length > 36) {
        playerBulletsRef.current.shift();
      }
    };

    if (level === 1) {
      const bulletId = ++playerBulletIdCounterRef.current;
      addBullet(bulletId, spawnX, spawnY);
    } else if (level === 2) {
      const b1 = ++playerBulletIdCounterRef.current;
      const b2 = ++playerBulletIdCounterRef.current;
      addBullet(b1, spawnX, spawnY);
      addBullet(b2, spawnX, spawnY + Math.min(1.5, planeSizePctRef.current.height * 0.18));
    } else {
      const b1 = ++playerBulletIdCounterRef.current;
      const b2 = ++playerBulletIdCounterRef.current;
      const b3 = ++playerBulletIdCounterRef.current;
      const spread = Math.min(2.5, planeSizePctRef.current.height * 0.18);
      addBullet(b1, spawnX, spawnY);
      addBullet(b2, spawnX, spawnY + spread);
      addBullet(b3, spawnX, spawnY + spread * 2);
    }

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

  const proceedAfterAnswer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const currentQIdx = currentQuestionIndexRef.current;
    const isLastQuestion = currentQIdx >= questionsRef.current.length - 1;

    if (isLastQuestion) {
      setIsFlyingOver(true);
      audio.playWin();
      setTimeout(() => handleEndGame(true), 2500);
    } else {
      setTimeout(() => {
        const nextIndex = currentQIdx + 1;
        setCurrentQuestionIndex(nextIndex);
        initClouds(questionsRef.current[nextIndex]);
        setIsAnswerChecked(false);
        setSelectedAnswer(null);
        questionStartTimeRef.current = Date.now();
      }, 1200);
    }
  };

  const handleDamagePlane = () => {
    setPlaneEffect('shake');

    setLives(prev => {
      const newLives = prev - 1;
      livesRef.current = newLives;
      if (newLives <= 0) {
        setIsBossCrashing(true);
        const planeRect = planeRef.current?.getBoundingClientRect();
        const skyRect = skyRef.current?.getBoundingClientRect();
        fireExplosion(
          planeRect && skyRect ? planeRect.left + planeRect.width / 2 - skyRect.left : 0,
          planeRect && skyRect ? planeRect.top + planeRect.height / 2 - skyRect.top : 0,
          'red'
        );
        audio.playExplosion();
        setTimeout(() => handleEndGame(false), 1500);
      } else {
        audio.playFailure();
        setTimeout(() => {
          setPlaneEffect('normal');
        }, 1000);
      }
      return newLives;
    });

    if (livesRef.current > 0) {
      proceedAfterAnswer();
    }
  };

  const handleCheckAnswer = (correct: boolean) => {
    setIsAnswerChecked(true);

    if (correct) {
      setStarsSync(starsRef.current + 1);
      setPlaneEffect('boost');
      audio.playSuccess();
    }

    setTimeout(() => {
      setPlaneEffect('normal');
    }, 1000);

    proceedAfterAnswer();
  };

  const handleEndGame = async (won: boolean) => {
    stopAutoFire();
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

    const allQuestionsCompleted = currentQuestionIndexRef.current >= questionsRef.current.length - 1;
    const isAlive = livesRef.current > 0;

    if (won && allQuestionsCompleted && isAlive && starsRef.current > 0) {
      setGameState('celebration');
    } else {
      audio.playLose();
      setGameState('gameover');
    }
  };

  const handleCelebrationComplete = useCallback(() => setGameState('gameover'), []);


  const handleBackToMenu = () => {
    window.history.back();
  };

  const currentQuestion = questions[currentQuestionIndex];
  const renderStageWidth = stageSizeRef.current.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
  const renderStageHeight = stageSizeRef.current.height || (typeof window !== 'undefined' ? window.innerHeight : 0);
  const isCompactStage = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse), (max-width: 950px)').matches;
  const renderMonsterBoxSize = getMonsterBoxSize(renderStageWidth, isCompactStage);
  const isMobilePortrait = typeof window !== 'undefined' && window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
  const lanePositions = useMemo(
    () => getAnswerLanePositions().map(position => `${position}%`),
    [isMobilePortrait]
  );

  const getPlaneClass = () => {
    let classes = ['airplane-wrapper'];
    if (isFlyingOver) classes.push('plane-flyover');
    if (planeEffect === 'boost') classes.push('engine-boost');
    if (planeEffect === 'shake') classes.push('shake-drop', 'damage-hit');
    if (movementDir === 'up') classes.push('tilt-up');
    if (movementDir === 'down') classes.push('tilt-down');
    if (isInvincible && !hasActiveShield) classes.push('invincible-flash');

    // Add charring effect based on damage level
    const damageLevel = 3 - lives;
    if (damageLevel > 0) classes.push('damage-smoke');
    if (damageLevel === 1) classes.push('charred-1');
    if (damageLevel >= 2) classes.push('charred-2');

    return classes.join(' ');
  };

  return (
    <div className="app-container">
      <div className="rotate-overlay">
        <div className="rotate-icon"><Smartphone aria-hidden="true" /></div>
        <h2>يرجى تدوير الشاشة</h2>
        <p>هذه اللعبة مصممة للعب في الوضع العرضي للحصول على أفضل تجربة.</p>
      </div>

      {gameState !== 'playing' && (
        <button
          className="sound-toggle"
          onClick={toggleMute}
          title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          style={{ zIndex: 100 }}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      )}

      {/* ================= NEW WELCOME SCREEN ================= */}
      {gameState === 'welcome' && (
        <div className="sky-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GameWelcomeScreen
          statsBgImage={questionNumberBg}
          statLeftIcon={questionCoinImg}
          statLeftAlt="Q"
          statLeftValue={apiQuestions.length || 10}
          statRightValue={apiQuestions.length ? apiQuestions.length * 10 : 100}
          statRightIcon={daadCoins}
          statRightAlt="Coin"
          heroImage={descriptionImg}
          heroAlt="How to play"
          startButtonImage={welcomeStartButton}
          exitButtonImage={welcomeExitButton}
          onStart={() => handleStartClick('all')}
          isLoading={isLoadingQuestions || isStartingSession}
          isReady={apiQuestions.length > 0}
        />
      </div>

      )}

      {/* ================= LANDSCAPE ROTATION SCREEN ================= */}
      {isPhonePortrait && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)', /* Low opacity dark overlay based on game theme */
          backdropFilter: 'blur(5px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#84ebff', /* Cyan color from theme */
          fontFamily: 'Lateef, var(--font-arabic)'
        }}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ animation: 'rotatePhone 1.5s ease-in-out infinite alternate', filter: 'drop-shadow(0 0 15px rgba(132,235,255,0.4))' }}>
            <path d="M17 1H7C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1 17 1ZM12 21C11.45 21 11 20.55 11 20C11 19.45 11.45 19 12 19C12.55 19 13 19.45 13 20C13 20.55 12.55 21 12 21ZM17 17H7V4H17V17Z" />
          </svg>
          <h2 style={{ marginTop: '40px', fontSize: '42px', textAlign: 'center', fontWeight: 'bold', textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>قم بتدوير الشاشة</h2>
          <p style={{ marginTop: '10px', fontSize: '26px', textAlign: 'center', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>يرجى تدوير الهاتف للعب</p>
          <style>{`
            @keyframes rotatePhone {
              0%, 20% { transform: rotate(0deg); }
              80%, 100% { transform: rotate(-90deg); }
            }
          `}</style>
        </div>
      )}

      {/* ================= GAME SCREEN (PLAYING) ================= */}
      {gameState === 'playing' && (
        <div
          className="sky-container"
          ref={skyRef}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerEnd}
          onPointerCancel={handleStagePointerEnd}
        >


          {/* Top HUD Header */}
          <div className="sky-hud-header">
            <button className="hud-exit-button" onClick={handleBackToMenu} title="خروج" aria-label="خروج">
              <img src={exitHudIcon} alt="" />
            </button>

            <div className="hud-center" aria-live="polite">
              <span className="hud-question-label">السؤال</span>
              <span className="hud-question-number">
                {currentQuestionIndex + 1}/{Math.max(questions.length, 1)}
              </span>
            </div>

            <div className="hud-right">
              <div className="hud-lives" aria-label={`${lives} من 3 قلوب`}>
                <span className="hud-lives-label">القلوب</span>
                <div className="hud-heart-row">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={`heart-icon ${i >= lives ? 'lost' : ''}`}>
                      <img src={heartHudIcon} alt="" aria-hidden="true" />
                    </span>
                  ))}
                </div>
              </div>
              <div className="hud-coins" aria-label={`العملات ${stars}`}>
                <img src={daadCoins} alt="" aria-hidden="true" />
                <span>{stars}</span>
              </div>
            </div>

            <div
              className="hud-progress-track"
              role="progressbar"
              aria-label="تقدم الأسئلة"
              aria-valuemin={0}
              aria-valuemax={Math.max(questions.length, 1)}
              aria-valuenow={Math.min(currentQuestionIndex + 1, Math.max(questions.length, 1))}
            >
              <span style={{ width: `${Math.min(100, ((currentQuestionIndex + 1) / Math.max(questions.length, 1)) * 100)}%` }} />
            </div>
          </div>

          {currentQuestion && !isFlyingOver && (
            <section className="question-prompt-panel" aria-label="السؤال الحالي" dir="auto">
              <div className="question-prompt-copy">
                {currentQuestion.question && <p>{currentQuestion.question}</p>}
                {(currentQuestion.audioUrl || currentQuestion.question) && (
                  <button
                    className="question-audio-btn"
                    type="button"
                    aria-label="استمع إلى السؤال"
                    title="استمع إلى السؤال"
                    onClick={() => {
                      const language = /[\u0600-\u06FF]/.test(currentQuestion.question) ? 'ar-SA' : 'en-US';
                      audio.speakText(currentQuestion.question, language, currentQuestion.audioUrl);
                    }}
                  >
                    <Play aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
              {currentQuestion.imageUrl && (
                <img
                  className="question-prompt-image"
                  src={currentQuestion.imageUrl}
                  alt="صورة السؤال"
                  decoding="async"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              )}
            </section>
          )}

          <div className="buildings-layer-bg" />
          <div className="clouds-container">
            <div className="cloud cloud-type-1" style={{ top: '15%', animationDuration: '30s' }} />
            <div className="cloud cloud-type-2" style={{ top: '45%', animationDuration: '45s' }} />
            <div className="cloud cloud-type-3" style={{ top: '70%', animationDuration: '35s' }} />
          </div>

          {/* Scrolling obstacles */}
          <ObstacleLayer
            obstacles={obstaclesRef.current}
            stageWidth={renderStageWidth}
            stageHeight={renderStageHeight}
            boxSize={renderMonsterBoxSize}
          />


          {/* Airplane Sprite Wrapper */}
          <div
            className={getPlaneClass()}
            style={{
              bottom: 0,
              left: 0,
              translate: `${(planeXRef.current / 100) * renderStageWidth}px ${(-planeYRef.current / 100) * renderStageHeight}px`,
              position: 'absolute',
              transition: isFlyingOver ? 'all 2.5s ease-in-out' : 'none'
            }}
          >
            <img
              ref={planeRef}
              src="/cartoon_airplane.png"
              className="airplane-img"
              alt="طائرة"
              onLoad={() => updatePlaneMetricsRef.current()}
            />

            {hasActiveShield && <div className="plane-shield-aura" aria-hidden="true" />}

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
                      bottom: `${cloudsRef.current[idx]?.y ?? Number.parseFloat(lanePositions[idx])}%`,
                      left: 0,
                      translate: `${((cloudsRef.current[idx]?.x ?? 110 + (idx * 6)) / 100) * renderStageWidth}px 0px`,
                      zIndex: 25,
                    }}
                  >
                    <div className="cloud-bubble">
                      <span className="cloud-badge">
                        {idx === 0 ? "أ" : idx === 1 ? "ب" : idx === 2 ? "ج" : "د"}
                      </span>
                  <span className="cloud-text">{getQuestionOptionText(option)}</span>
                  {typeof option !== 'string' && option.imageUrl && (
                    <img
                      className="cloud-option-image"
                      src={option.imageUrl}
                      alt={getQuestionOptionText(option)}
                      decoding="async"
                    />
                  )}
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

          <canvas ref={explosionCanvasRef} className="explosion-canvas" aria-hidden="true" />
          <canvas ref={playerBulletLayerRef} className="projectile-canvas" aria-hidden="true" />
          <canvas ref={abilityCanvasRef} className="ability-canvas" aria-hidden="true" />

          <div className="buildings-layer-fg" />

          {/* Styled Mobile Overlay Controls */}
          <div className="mobile-controls-overlay">
            {gameState === 'playing' && (
              <button
                className="action-fire-btn"
                disabled={isFlyingOver}
                onPointerDown={(e) => { e.preventDefault(); startAutoFire(e); }}
                onPointerUp={(e) => { e.preventDefault(); stopAutoFire(); }}
                onPointerCancel={(e) => { e.preventDefault(); stopAutoFire(); }}
                onMouseLeave={stopAutoFire}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                  color: 'white',
                  border: '3px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                  touchAction: 'none',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <Flame aria-hidden="true" size={24} />
                <span className="fire-text" style={{ fontSize: '10px', fontWeight: 'bold' }}>إطلاق</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= CELEBRATION SCREEN ================= */}
      {gameState === 'celebration' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
           <Celebration isVisible={true} onComplete={handleCelebrationComplete} />
        </div>
      )}

      {/* ================= GAME OVER SCREEN (RESULTS PANEL) ================= */}
      {gameState === 'gameover' && (
        <div className="sky-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ResultsPanel 
             score={gameOverStats?.score || stars} 
             totalScore={questions.length} 
             correctAnswers={stars} 
             wrongAnswers={questions.length - stars} 
             coins={gameOverStats?.coins || 0}
             onRetry={() => startGame(selectedCategory)}
             onBack={handleBackToMenu}
          />
        </div>
      )}
    </div>
  );
}

export default App;
