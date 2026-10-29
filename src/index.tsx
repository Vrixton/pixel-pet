import React, {
  useState,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  CSSProperties,
} from 'react';
import { PetMenu, type PetMenuAction, type PetMenuFocus } from './PetMenu';
import './styles.css';

export type { PetMenuAction } from './PetMenu';

export interface DialogStyleProps {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  fontFamily?: string;
}

export type PetEmotion = 'happy' | 'angry' | 'curious';
export type PetAction = 'idle' | 'walk' | 'sleep';
export type PetVariant = 'cat' | 'dog' | 'axolotl' | 'parakeet' | 'hamster';
export type PetMode = 'live' | 'showcase';
export type PetMessages = Partial<Record<PetEmotion | 'greeting', React.ReactNode>>;
export type RestAt = 'left' | 'center' | 'right';
export type RestCommand = RestAt | 'nearest';

const REST_SPOTS: RestAt[] = ['left', 'center', 'right'];

export interface PetMenuLabels {
  menu?: string;
  close?: string;
}

export interface PetSayOptions {
  emotion?: PetEmotion;
  duration?: number;
}

export interface PixelPetHandle {
  say: (message: React.ReactNode, options?: PetSayOptions) => void;
  hush: () => void;
  emote: (emotion: PetEmotion) => void;
  rest: (at: RestCommand) => void;
}

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const DIALOG_EDGE_GAP = 4;
const DIALOG_MAX_WIDTH = 240;
const DEFAULT_SPEECH_DURATION = 5000;
const CLICK_BUBBLE_DURATION = 3000;
const MESSAGE_MARKERS = /(\{name\}|\*\*[^*]+\*\*|__[^_]+__)/;

const DEFAULT_MESSAGES: Record<PetEmotion, string> = {
  happy: '{name} is feeling **happy**!',
  angry: '{name} is feeling **overwhelmed**!',
  curious: '{name} is very **curious**',
};
const DEFAULT_GREETING = "Hi, I'm {name}!";
const DEFAULT_MENU_LABEL = '{name} actions';
const DEFAULT_CLOSE_LABEL = 'Close menu';
const SPRITE_MAX_WIDTH = 65;
const INITIAL_POSITION = 100;
const SHEET_WIDTH = 669;
const PIXEL_UNIT_TOLERANCE = 1e-6;
const WALK_SPEED = 0.04;
const WALK_FRAMES = 9;
const WALK_FRAME_WIDTH = 60;
const WALK_ROW_Y = 73;
const WALK_ROW_END = 600;
const WALK_STRIDE_IN_FRAME_WIDTHS = 52 / 60;
const WALK_RAMP = 200;
const TRIP_DURATION = 3000;
const TRIP_MAX_SPEED = WALK_SPEED * 3;
const NEAREST_TIE_BAND = 0.1;
const WALK_TURN_PAUSE = (2 * WALK_STRIDE_IN_FRAME_WIDTHS * WALK_FRAME_WIDTH) / WALK_FRAMES / WALK_SPEED;
const MAX_FRAME_GAP = 100;
const INACTIVITY_DELAY = 120000;
const IDLE_COOLDOWN = 30000;
const NAP_DURATION = 2500;
const STARTLE_DURATION = 300;
const MENU_INSIST_OPENS = 4;
const MENU_INSIST_WINDOW = 5000;
const MENU_REFUSAL_DURATION = 2000;

const subscribeToReducedMotion = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
};

const getPrefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeToReducedMotion, getPrefersReducedMotion, () => false);

const getRestX = (at: RestAt, stageWidth: number) => {
  const maxX = Math.max(stageWidth - SPRITE_MAX_WIDTH, 0);
  if (at === 'left') return 0;
  if (at === 'right') return maxX;
  return maxX / 2;
};

const toCssString = (value: string) =>
  `"${[...value]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (code === 0) return '\uFFFD';
      if (code <= 0x1f || code === 0x7f) return `\\${code.toString(16)} `;
      if (char === '"' || char === '\\') return `\\${char}`;
      return char;
    })
    .join('')}"`;

const CSS_URL = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s]*))\s*\)/;
const CSS_ESCAPE = /\\([0-9a-fA-F]{1,6})[ \t\n]?|\\([\s\S])/g;

const fromCssCodePoint = (code: number) =>
  code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\uFFFD' : String.fromCodePoint(code);

const readCssUrl = (value: string) => {
  const match = value.match(CSS_URL);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw?.replace(CSS_ESCAPE, (_, hex?: string, char?: string) =>
    hex ? fromCssCodePoint(Number.parseInt(hex, 16)) : char === '\n' ? '' : char!,
  );
};

interface RestState {
  at: RestAt;
  phase: 'walking' | 'asleep';
  origin: 'method' | 'prop';
}

type Facing = 'left' | 'right';

type WalkIntent =
  | { kind: 'wander' }
  | { kind: 'trip'; rest: RestState; targetX: number; speed: number };

interface WalkMotion {
  frameId: number;
  lastTime: number | null;
  speed: number;
  cruise: number;
  pausedUntil: number;
  pauseIntent: WalkIntent | null;
}

const getContainedPlacement = (
  stageWidth: number,
  anchorCenter: number,
  boxWidth: number,
  maxBoxWidth = DIALOG_MAX_WIDTH,
) => {
  const maxWidth = Math.max(Math.min(maxBoxWidth, stageWidth - DIALOG_EDGE_GAP * 2), 0);
  const width = Math.min(boxWidth, maxWidth);
  const minLeft = DIALOG_EDGE_GAP;
  const maxLeft = stageWidth - DIALOG_EDGE_GAP - width;
  const left = Math.max(Math.min(anchorCenter - width / 2, maxLeft), minLeft);

  return { left, maxWidth };
};

export interface PixelPetProps {
  petName?: string;
  variant?: PetVariant;
  spriteSrc?: string;
  color?: string;
  label?: string;
  mode?: PetMode;
  walk?: boolean;
  messages?: PetMessages;
  actions?: PetMenuAction[];
  menuLabels?: PetMenuLabels;
  resting?: RestAt | null;
  onRestingChange?: (at: RestAt | null) => void;
  dialogStyle?: DialogStyleProps;
  emotionDialogStyles?: Partial<Record<PetEmotion, DialogStyleProps>>;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<PixelPetHandle>;
}

const DEFAULT_EMOTION_STYLES: Record<PetEmotion, DialogStyleProps> = {
  happy: {
    backgroundColor: '#1e1c06eb',
    borderColor: '#ffeb3b',
  },
  angry: {
    backgroundColor: '#210908eb',
    borderColor: '#F04037',
  },
  curious: {
    backgroundColor: '#1f341deb',
    borderColor: '#8BE383',
  },
};

const MENU_FALLBACK_VARIABLES: Record<keyof DialogStyleProps, string> = {
  backgroundColor: '--_pixel-pet-dialog-bg',
  textColor: '--_pixel-pet-dialog-fg',
  borderColor: '--_pixel-pet-dialog-border',
  borderWidth: '--_pixel-pet-dialog-border-width',
  borderRadius: '--_pixel-pet-dialog-radius',
  fontFamily: '--_pixel-pet-dialog-font',
};

const DEFAULT_SPEECH_STYLE: DialogStyleProps = {
  backgroundColor: '#05080ceb',
  borderColor: 'var(--pixel-pet-color, #FDDBA0)',
};

export const PixelPet: React.FC<PixelPetProps> = ({
  petName = 'Minerva',
  variant = 'cat',
  spriteSrc,
  color,
  label,
  mode = 'live',
  walk = true,
  messages,
  actions,
  menuLabels,
  resting,
  onRestingChange,
  dialogStyle = {},
  emotionDialogStyles = {},
  onClick,
  ref,
}) => {
  const [action, setAction] = useState<PetAction>('idle');
  const prefersReducedMotion = usePrefersReducedMotion();
  const isShowcase = mode === 'showcase';
  const canWalk = walk && !prefersReducedMotion && !isShowcase;
  const hasMenu = !isShowcase && actions !== undefined && actions.length > 0;
  const menuId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialogPlacement, setDialogPlacement] = useState<{ left: number; maxWidth: number } | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<{ left: number; maxWidth: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  if (!hasMenu && isMenuOpen) setIsMenuOpen(false);
  const [menuFocus, setMenuFocus] = useState<PetMenuFocus>('first');
  const isMenuVisible = hasMenu && isMenuOpen;
  const isMenuVisibleRef = useRef<boolean>(isMenuVisible);
  const isRestingControlled = resting !== undefined;
  const [restState, setRestState] = useState<RestState | null>(() =>
    isRestingControlled && resting !== null && !isShowcase
      ? { at: resting, phase: 'asleep', origin: 'prop' }
      : null,
  );
  const restStateRef = useRef<RestState | null>(restState);
  const isResting = restState !== null;
  const asleepAt = restState?.phase === 'asleep' ? restState.at : null;
  const standingAtRef = useRef<RestAt | null>(null);
  const previousRestingRef = useRef<RestAt | null | undefined>(resting);
  const onRestingChangeRef = useRef(onRestingChange);
  const [activeEmotion, setActiveEmotion] = useState<PetEmotion | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isUserTriggered, setIsUserTriggered] = useState<boolean>(false);
  const [isHoverMuted, setIsHoverMuted] = useState<boolean>(false);
  const [isStartled, setIsStartled] = useState<boolean>(false);
  const [speech, setSpeech] = useState<{ message: React.ReactNode; emotion: PetEmotion | null } | null>(
    null,
  );

  const posXRef = useRef<number>(INITIAL_POSITION);
  const travelledRef = useRef<number>(0);
  const pixelUnitRef = useRef<number>(1);
  const naturalWidthRef = useRef<number>(0);
  const walkFrameRef = useRef<number>(-1);
  const strideRef = useRef<number>(0);
  const sheetScaleRef = useRef<number>(1);
  const [stageWidth, setStageWidth] = useState<number>(0);
  const stageWidthRef = useRef<number>(0);
  const [direction, setDirection] = useState<Facing>('right');
  const facingRef = useRef<Facing>('right');
  const [isStepping, setIsStepping] = useState<boolean>(false);
  const intentRef = useRef<WalkIntent | null>(null);
  const motionRef = useRef<WalkMotion>({
    frameId: 0,
    lastTime: null,
    speed: 0,
    cruise: WALK_SPEED,
    pausedUntil: 0,
    pauseIntent: null,
  });
  const motionStepRef = useRef<(time: number) => void>(() => {});

  const fillName = (text: string) => text.split('{name}').join(petName);

  const formatMessage = (message: React.ReactNode, emotion: PetEmotion | null): React.ReactNode => {
    if (typeof message !== 'string') return message;
    return message.split(MESSAGE_MARKERS).map((part, index) => {
      if (index % 2 === 0) return part;
      if (part === '{name}' || part.startsWith('__')) {
        return (
          <span key={index} className="pixel-pet-highlight-pet">
            {part === '{name}' ? petName : part.slice(2, -2)}
          </span>
        );
      }
      return (
        <span key={index} className={`pixel-pet-highlight-${emotion ?? 'pet'}`}>
          {part.slice(2, -2)}
        </span>
      );
    });
  };

  const emotionMessages: Record<PetEmotion, React.ReactNode> = {
    happy: formatMessage(messages?.happy ?? DEFAULT_MESSAGES.happy, 'happy'),
    angry: formatMessage(messages?.angry ?? DEFAULT_MESSAGES.angry, 'angry'),
    curious: formatMessage(messages?.curious ?? DEFAULT_MESSAGES.curious, 'curious'),
  };

  const actionRef = useRef<PetAction>(action);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCooldownRef = useRef<boolean>(false);
  const idleCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmotionFrozenRef = useRef<boolean>(false);
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastEmotionRef = useRef<PetEmotion>('happy');
  const clickTimestampsRef = useRef<number[]>([]);
  const clickBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpenTimestampsRef = useRef<number[]>([]);
  const menuRefusedUntilRef = useRef<number>(0);

  const isSpeakingRef = useRef<boolean>(false);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDurationRef = useRef<number>(DEFAULT_SPEECH_DURATION);

  const triggerEmotion = (emotion: PetEmotion, fromUser = false) => {
    if (actionRef.current === 'sleep') {
      setAction('idle');
    }

    lastEmotionRef.current = emotion;
    setActiveEmotion(emotion);
    setIsUserTriggered(fromUser);

    if (emotionTimerRef.current) {
      clearTimeout(emotionTimerRef.current);
    }

    emotionTimerRef.current = setTimeout(() => {
      if (!isEmotionFrozenRef.current) {
        setActiveEmotion(null);
      }
    }, 5000);
  };

  const updateSpeech = (value: { message: React.ReactNode; emotion: PetEmotion | null } | null) => {
    isSpeakingRef.current = value !== null;
    setSpeech(value);
  };

  const resolveNearest = (): RestAt => {
    const width = stageRef.current?.clientWidth ?? 0;
    const toLeft = posXRef.current;
    const toRight = Math.max(width - SPRITE_MAX_WIDTH, 0) - posXRef.current;
    if (Math.abs(toLeft - toRight) < width * NEAREST_TIE_BAND) return facingRef.current;
    return toLeft < toRight ? 'left' : 'right';
  };

  const updateRestState = (value: RestState | null) => {
    restStateRef.current = value;
    standingAtRef.current = null;
    setRestState(value);
  };

  const arriveAt = ({ at, origin }: RestState) => {
    if (origin === 'prop') {
      updateRestState({ at, phase: 'asleep', origin });
      return;
    }

    if (isRestingControlled) {
      updateRestState(null);
      standingAtRef.current = at;
    } else {
      updateRestState({ at, phase: 'asleep', origin });
    }
    onRestingChangeRef.current?.(at);
  };

  const wakeFromRest = (state: RestState) => {
    if (state.phase === 'walking' && state.origin === 'method') {
      updateRestState(null);
      return;
    }

    if (!isRestingControlled) updateRestState(null);
    onRestingChangeRef.current?.(null);
  };

  const clearSpeechTimer = () => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
  };

  const scheduleSpeechEnd = (duration: number) => {
    clearSpeechTimer();
    if (duration === Infinity) return;
    speechTimerRef.current = setTimeout(() => updateSpeech(null), duration);
  };

  useImperativeHandle(
    ref,
    () => ({
      say: (message, options = {}) => {
        if (restStateRef.current) return;
        setAction((prevAction) => (prevAction === 'sleep' ? 'idle' : prevAction));
        updateSpeech({ message, emotion: options.emotion ?? null });
        speechDurationRef.current = options.duration ?? DEFAULT_SPEECH_DURATION;
        scheduleSpeechEnd(speechDurationRef.current);
      },
      hush: () => {
        clearSpeechTimer();
        updateSpeech(null);
      },
      emote: (emotion) => {
        if (isShowcase || restStateRef.current) return;
        triggerEmotion(emotion);
      },
      rest: (command) => {
        if (isShowcase || restStateRef.current) return;

        const at = command === 'nearest' ? resolveNearest() : command;
        const trip: RestState = { at, phase: 'walking', origin: 'method' };
        if (canWalk) {
          updateRestState(trip);
          return;
        }

        applyPosition(getRestX(at, stageRef.current?.clientWidth ?? 0));
        arriveAt(trip);
      },
    }),
    [isShowcase, canWalk, isRestingControlled],
  );

  useLayoutEffect(() => {
    onRestingChangeRef.current = onRestingChange;
  });

  useLayoutEffect(() => {
    if (previousRestingRef.current === resting) return;
    previousRestingRef.current = resting;
    if (!isRestingControlled || isShowcase) return;

    if (resting === null) {
      updateRestState(null);
      return;
    }

    const isThere = standingAtRef.current === resting || !canWalk;
    updateRestState({ at: resting, phase: isThere ? 'asleep' : 'walking', origin: 'prop' });
  }, [resting]);

  useEffect(() => {
    if (!isResting) return;

    clearSpeechTimer();
    updateSpeech(null);
    setActiveEmotion(null);
    setIsMenuOpen(false);
    setAction('idle');
  }, [isResting]);

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    let napTimer: ReturnType<typeof setTimeout>;
    let startleTimer: ReturnType<typeof setTimeout>;

    const fallAsleep = () => {
      setActiveEmotion(null);
      updateSpeech(null);
      setAction('sleep');
    };

    const nap = () => {
      inactivityTimer = setTimeout(nap, INACTIVITY_DELAY);
      if (restStateRef.current || isMenuVisibleRef.current || isSpeakingRef.current) return;

      setActiveEmotion(null);
      setAction('sleep');
      napTimer = setTimeout(() => {
        if (actionRef.current !== 'sleep') return;
        setAction('idle');
        setIsStartled(true);
        startleTimer = setTimeout(() => setIsStartled(false), STARTLE_DURATION);
      }, NAP_DURATION);
    };

    const resetInactivity = () => {
      if (isShowcase) {
        setAction((prevAction) => (prevAction === 'sleep' ? 'idle' : prevAction));
      }

      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(isShowcase ? fallAsleep : nap, INACTIVITY_DELAY);
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetInactivity, { passive: true });
    });
    resetInactivity();

    return () => {
      clearTimeout(inactivityTimer);
      clearTimeout(napTimer);
      clearTimeout(startleTimer);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetInactivity);
      });
    };
  }, [isShowcase]);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    isMenuVisibleRef.current = isMenuVisible;
  }, [isMenuVisible]);

  useEffect(() => {
    if (isShowcase) return;

    const emotionInterval = setInterval(() => {
      if (
        actionRef.current === 'sleep' ||
        isSpeakingRef.current ||
        isMenuVisibleRef.current ||
        restStateRef.current
      ) {
        return;
      }

      const emotions: PetEmotion[] = ['happy', 'angry', 'curious'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

      triggerEmotion(randomEmotion);
    }, 30000);

    return () => {
      clearInterval(emotionInterval);
    };
  }, [isShowcase]);

  useEffect(() => {
    return () => {
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      if (clickBubbleTimerRef.current) clearTimeout(clickBubbleTimerRef.current);
      if (idleCooldownTimerRef.current) clearTimeout(idleCooldownTimerRef.current);
    };
  }, []);

  const startIdleCooldown = () => {
    idleCooldownRef.current = true;
    if (idleCooldownTimerRef.current) clearTimeout(idleCooldownTimerRef.current);
    idleCooldownTimerRef.current = setTimeout(() => {
      idleCooldownRef.current = false;
    }, IDLE_COOLDOWN);
  };

  useEffect(() => {
    if (action === 'sleep' || !canWalk || isMenuVisible || isResting) return;

    if (action === 'walk') {
      const walkDuration = Math.floor(Math.random() * (180000 - 5000 + 1)) + 5000;

      actionTimerRef.current = setTimeout(() => {
        setAction('idle');
        startIdleCooldown();
      }, walkDuration);
    } else {
      const decideNextAction = () => {
        if (!idleCooldownRef.current && Math.random() > 0.4) {
          standingAtRef.current = null;
          setAction('walk');
          return;
        }

        actionTimerRef.current = setTimeout(decideNextAction, 5000);
      };

      decideNextAction();
    }

    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [action, canWalk, isMenuVisible, isResting]);

  const getDrawnX = () => {
    const unit = pixelUnitRef.current;
    const dpr = window.devicePixelRatio || 1;
    return Math.round(Math.round(posXRef.current / unit) * unit * dpr) / dpr;
  };

  const getSheetWidth = (sprite: HTMLElement) =>
    Number(getComputedStyle(sprite).backgroundSize.match(/^([\d.]+)px/)?.[1]) || naturalWidthRef.current;

  const stepWalkFrames = (distance: number) => {
    const sprite = petRef.current;
    if (!sprite) return;

    if (walkFrameRef.current < 0) {
      strideRef.current = WALK_STRIDE_IN_FRAME_WIDTHS * (sprite.offsetWidth || WALK_FRAME_WIDTH);
      sheetScaleRef.current = (getSheetWidth(sprite) || SHEET_WIDTH) / SHEET_WIDTH;
    }
    travelledRef.current += Math.abs(distance);
    const frame = Math.floor(travelledRef.current / (strideRef.current / WALK_FRAMES)) % WALK_FRAMES;
    if (frame === walkFrameRef.current) return;

    walkFrameRef.current = frame;
    const scale = sheetScaleRef.current;
    const frameX = Math.round((frame * WALK_ROW_END) / WALK_FRAMES) * scale;
    sprite.style.backgroundPosition = `-${frameX}px -${WALK_ROW_Y * scale}px`;
  };

  const resetWalkFrames = () => {
    travelledRef.current = 0;
    walkFrameRef.current = -1;
    petRef.current?.style.removeProperty('background-position');
  };

  const applyPosition = (x: number) => {
    posXRef.current = x;
    if (restStateRef.current?.phase === 'asleep') return;
    if (walkerRef.current) walkerRef.current.style.transform = `translateX(${getDrawnX()}px)`;
  };

  const measurePixelUnit = () => {
    const sprite = petRef.current;
    const naturalWidth = naturalWidthRef.current;
    if (!sprite || !naturalWidth) return;

    const unit = getSheetWidth(sprite) / naturalWidth;
    if (Math.abs(unit - pixelUnitRef.current) < PIXEL_UNIT_TOLERANCE) return;
    pixelUnitRef.current = unit;
    applyPosition(posXRef.current);
  };

  useEffect(() => {
    naturalWidthRef.current = 0;
    pixelUnitRef.current = 1;
    const sprite = petRef.current;
    const url = sprite && readCssUrl(getComputedStyle(sprite).backgroundImage);
    if (!url) return;

    const image = new Image();
    const handleLoad = () => {
      naturalWidthRef.current = image.naturalWidth;
      measurePixelUnit();
    };

    const handleError = () => {
      console.warn(`PixelPet could not load the sprite sheet at "${url}".`);
    };

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
    image.src = url;
    return () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };
  }, [variant, spriteSrc]);

  const face = (facing: Facing) => {
    facingRef.current = facing;
    setDirection(facing);
  };

  const stopMotion = () => {
    const motion = motionRef.current;
    cancelAnimationFrame(motion.frameId);
    motion.frameId = 0;
    motion.speed = 0;
    setIsStepping(false);
  };

  const startMotion = () => {
    const motion = motionRef.current;
    if (motion.frameId) return;
    motion.lastTime = null;
    measurePixelUnit();
    setIsStepping(true);
    motion.frameId = requestAnimationFrame((time) => motionStepRef.current(time));
  };

  const finishWander = () => {
    intentRef.current = null;
    stopMotion();
    setAction('idle');
    startIdleCooldown();
  };

  const stepMotion = (time: number) => {
    const motion = motionRef.current;
    const elapsed = motion.lastTime === null ? 0 : Math.min(time - motion.lastTime, MAX_FRAME_GAP);
    motion.lastTime = time;
    const scheduleNext = () => {
      motion.frameId = requestAnimationFrame((next) => motionStepRef.current(next));
    };
    const pauseToTurn = (facing: Facing, intent: WalkIntent) => {
      motion.speed = 0;
      face(facing);
      motion.pausedUntil = time + WALK_TURN_PAUSE;
      motion.pauseIntent = intent;
      scheduleNext();
    };

    const intent = intentRef.current;
    if (time < motion.pausedUntil && intent === motion.pauseIntent) {
      scheduleNext();
      return;
    }
    motion.pausedUntil = 0;

    const x = posXRef.current;
    const maxX = Math.max(stageWidthRef.current - SPRITE_MAX_WIDTH, 0);
    const sign = facingRef.current === 'right' ? 1 : -1;
    const toEdge = Math.max(sign > 0 ? maxX - x : x, 0);
    let wanted = facingRef.current;
    let remaining = toEdge;

    if (intent?.kind === 'wander') {
      motion.cruise = WALK_SPEED;
    } else if (intent?.kind === 'trip') {
      motion.cruise = intent.speed;
      const offset = intent.targetX - x;
      if (Math.abs(offset) > 0.01) wanted = offset > 0 ? 'right' : 'left';
      if (wanted === facingRef.current) remaining = Math.abs(offset);
    }

    const turning = intent !== null && wanted !== facingRef.current;
    const accel = motion.cruise / WALK_RAMP;
    if (intent && !turning) {
      motion.speed = Math.min(motion.speed + accel * elapsed, motion.cruise, Math.sqrt(2 * accel * remaining));
    } else {
      motion.speed = Math.max(motion.speed - accel * elapsed, 0);
    }

    const stride = Math.min(motion.speed * elapsed, remaining);
    if (stride > 0) {
      applyPosition(x + sign * stride);
      stepWalkFrames(stride);
    }
    const arrived = remaining - stride <= 0.01;

    if (!intent) {
      if (motion.speed === 0 || arrived) {
        stopMotion();
        return;
      }
      scheduleNext();
      return;
    }

    if (turning) {
      if (motion.speed > 0 && !arrived) {
        scheduleNext();
        return;
      }
      pauseToTurn(wanted, intent);
      return;
    }

    if (!arrived) {
      scheduleNext();
      return;
    }

    if (intent.kind === 'trip') {
      intentRef.current = null;
      stopMotion();
      if (intent.rest === restStateRef.current) arriveAt(intent.rest);
      return;
    }

    if (Math.random() > 0.5) {
      finishWander();
      return;
    }

    pauseToTurn(facingRef.current === 'right' ? 'left' : 'right', intent);
  };

  useLayoutEffect(() => {
    motionStepRef.current = stepMotion;
  });

  const canWander =
    action === 'walk' &&
    activeEmotion === null &&
    speech === null &&
    canWalk &&
    !isMenuVisible &&
    !isResting &&
    stageWidth - SPRITE_MAX_WIDTH > 0;

  useEffect(() => {
    if (canWander) {
      if (intentRef.current?.kind === 'trip') return;
      intentRef.current = { kind: 'wander' };
      startMotion();
    } else {
      if (intentRef.current?.kind === 'wander') intentRef.current = null;
      if (!canWalk && intentRef.current === null) stopMotion();
    }
  }, [canWander]);

  useEffect(() => {
    const stage = stageRef.current;
    if (restState?.phase !== 'walking' || !stage) {
      if (intentRef.current?.kind === 'trip') intentRef.current = null;
      return;
    }

    const targetX = getRestX(restState.at, stage.clientWidth);
    if (!canWalk) {
      intentRef.current = null;
      stopMotion();
      applyPosition(targetX);
      arriveAt(restState);
      return;
    }

    const current = intentRef.current;
    const speed =
      current?.kind === 'trip' && current.rest === restState
        ? current.speed
        : Math.min(Math.max(Math.abs(targetX - posXRef.current) / TRIP_DURATION, WALK_SPEED), TRIP_MAX_SPEED);
    intentRef.current = { kind: 'trip', rest: restState, targetX, speed };
    startMotion();
  }, [restState, stageWidth, canWalk]);

  useEffect(() => {
    // Runs again when <Activity> shows the pet; if the cleanup stopped it mid-brake, nothing restarts the loop.
    if (!motionRef.current.frameId) setIsStepping(false);

    return () => {
      const motion = motionRef.current;
      cancelAnimationFrame(motion.frameId);
      motion.frameId = 0;
      motion.speed = 0;
      motion.lastTime = null;
    };
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (restState?.phase !== 'asleep' || !stage) return;

    applyPosition(getRestX(restState.at, stage.clientWidth));
  }, [restState, stageWidth]);

  useLayoutEffect(() => {
    const walker = walkerRef.current;
    if (!walker) return;

    REST_SPOTS.forEach((at) => walker.classList.toggle(`pixel-pet-rest-${at}`, at === asleepAt));
    if (asleepAt) {
      walker.style.removeProperty('transform');
    } else {
      applyPosition(posXRef.current);
    }
  }, [asleepAt]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateStageWidth = (width: number) => {
      standingAtRef.current = null;
      stageWidthRef.current = width;
      setStageWidth(width);
      applyPosition(Math.max(Math.min(posXRef.current, width - SPRITE_MAX_WIDTH), 0));
    };

    updateStageWidth(stage.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateStageWidth(entry.contentRect.width);
    });
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  const reactToUser = (emotion: PetEmotion) => {
    if (isSpeakingRef.current) {
      clearSpeechTimer();
      updateSpeech(null);
    }

    isEmotionFrozenRef.current = false;
    setIsHoverMuted(true);
    if (clickBubbleTimerRef.current) clearTimeout(clickBubbleTimerRef.current);
    clickBubbleTimerRef.current = setTimeout(() => setIsUserTriggered(false), CLICK_BUBBLE_DURATION);
    triggerEmotion(emotion, true);
  };

  const openMenu = (focus: PetMenuFocus) => {
    const now = Date.now();
    if (now < menuRefusedUntilRef.current) return;

    const recentOpens = [...menuOpenTimestampsRef.current, now].filter(
      (timestamp) => now - timestamp <= MENU_INSIST_WINDOW,
    );

    if (recentOpens.length >= MENU_INSIST_OPENS) {
      menuOpenTimestampsRef.current = [];
      menuRefusedUntilRef.current = now + MENU_REFUSAL_DURATION;
      reactToUser('angry');
      return;
    }

    menuOpenTimestampsRef.current = recentOpens;
    setMenuFocus(focus);
    setIsMenuOpen(true);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (restState) {
      wakeFromRest(restState);
      return;
    }

    const now = Date.now();

    if (action === 'sleep') {
      setAction('idle');
    }

    if (hasMenu) {
      if (isMenuVisible) {
        setIsMenuOpen(false);
      } else {
        openMenu('first');
      }
      return;
    }

    if (isShowcase) {
      updateSpeech({ message: messages?.greeting ?? DEFAULT_GREETING, emotion: null });
      speechDurationRef.current = CLICK_BUBBLE_DURATION;
      scheduleSpeechEnd(CLICK_BUBBLE_DURATION);
      return;
    }

    const recentClicks = [...clickTimestampsRef.current, now].filter(
      (timestamp) => now - timestamp <= 10000
    );
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length > 5) {
      clickTimestampsRef.current = [];
      reactToUser('angry');
    } else {
      reactToUser(lastEmotionRef.current);
    }
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    petRef.current?.focus();
  };

  const selectMenuAction = (menuAction: PetMenuAction) => {
    closeMenu();
    menuAction.onSelect();
  };

  const handlePetKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!hasMenu || restState) return;

    if (event.key === 'Escape' && isMenuVisible) {
      event.preventDefault();
      event.stopPropagation();
      setIsMenuOpen(false);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !isMenuVisible) {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const handlePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    setIsHovered(true);
    if (isSpeakingRef.current) clearSpeechTimer();
    if (activeEmotion) {
      isEmotionFrozenRef.current = true;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    setIsHovered(false);
    setIsHoverMuted(false);
    if (isSpeakingRef.current) scheduleSpeechEnd(speechDurationRef.current);
    if (activeEmotion) {
      isEmotionFrozenRef.current = false;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      emotionTimerRef.current = setTimeout(() => {
        setActiveEmotion(null);
      }, 5000);
    }
  };

  const isSpeaking = speech !== null && action !== 'sleep' && !isResting;
  const visibleEmotion =
    action === 'sleep' || isMenuVisible || isResting
      ? null
      : isSpeaking
        ? speech.emotion
        : isShowcase
          ? null
          : activeEmotion;
  const isDialogVisible =
    !isMenuVisible &&
    (isSpeaking ||
      (visibleEmotion !== null && ((isHovered && !isHoverMuted) || isFocused || isUserTriggered)));

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const walker = walkerRef.current;
    const dialog = dialogRef.current;
    if (!isDialogVisible || !stage || !walker || !dialog) return;

    const drawnX = getDrawnX();
    const { left, maxWidth } = getContainedPlacement(stage.clientWidth, drawnX + walker.offsetWidth / 2, dialog.offsetWidth);

    setDialogPlacement({ left: left - drawnX, maxWidth });
  }, [isDialogVisible, visibleEmotion, speech, stageWidth, isStepping]);

  useEffect(() => {
    if (!isMenuVisible) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || petRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [isMenuVisible]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const walker = walkerRef.current;
    const menu = menuRef.current;
    if (!isMenuVisible) {
      setMenuPlacement(null);
      return;
    }
    if (!stage || !walker || !menu) return;

    const drawnX = getDrawnX();
    const { left, maxWidth } = getContainedPlacement(
      stage.clientWidth,
      drawnX + walker.offsetWidth / 2,
      menu.offsetWidth,
      Infinity,
    );

    setMenuPlacement({ left: left - drawnX, maxWidth });
  }, [isMenuVisible, actions, stageWidth, isStepping]);

  const getCurrentStateClass = () => {
    if (isStepping) return 'pixel-pet-state-walk';
    if (restState) return restState.phase === 'walking' ? 'pixel-pet-state-walk' : 'pixel-pet-state-sleep';
    if (isMenuVisible) return 'pixel-pet-state-idle';
    if (visibleEmotion) return `pixel-pet-state-${visibleEmotion}`;
    if (action === 'walk') return 'pixel-pet-state-idle';
    return `pixel-pet-state-${action}`;
  };

  const stateClass = getCurrentStateClass();

  useLayoutEffect(() => {
    if (stateClass !== 'pixel-pet-state-walk') resetWalkFrames();
  }, [stateClass]);

  const getMenuFallbacks = () =>
    Object.fromEntries(
      Object.entries(dialogStyle)
        .filter(([field, value]) => value !== undefined && field in MENU_FALLBACK_VARIABLES)
        .map(([field, value]) => [MENU_FALLBACK_VARIABLES[field as keyof DialogStyleProps], value]),
    ) as CSSProperties;

  const getDialogStyle = (emotion: PetEmotion | null): CSSProperties => {
    const defaultEmotionConfig = emotion ? DEFAULT_EMOTION_STYLES[emotion] : DEFAULT_SPEECH_STYLE;

    const customEmotionConfig = (emotion && emotionDialogStyles[emotion]) || {};

    const bgColor =
      customEmotionConfig.backgroundColor ||
      dialogStyle.backgroundColor ||
      defaultEmotionConfig.backgroundColor;

    const borderColor =
      customEmotionConfig.borderColor ||
      dialogStyle.borderColor ||
      defaultEmotionConfig.borderColor;
    return {
      backgroundColor: bgColor,
      color: customEmotionConfig.textColor || dialogStyle.textColor || '#ffffff',
      border: `${customEmotionConfig.borderWidth || dialogStyle.borderWidth || '1px'} solid ${borderColor}`,
      borderRadius: customEmotionConfig.borderRadius || dialogStyle.borderRadius || '0',
      fontFamily: customEmotionConfig.fontFamily || dialogStyle.fontFamily || 'monospace'
    };
  };

  return (
    <div
      className="pixel-pet"
      ref={stageRef}
      style={color ? ({ '--pixel-pet-color': color } as CSSProperties) : undefined}
    >
      <div
        ref={walkerRef}
        className={`pixel-pet-container${isStartled && !asleepAt ? ' pixel-pet-startle' : ''}${
          asleepAt ? ` pixel-pet-rest-${asleepAt}` : ''
        }`}
        style={asleepAt ? undefined : { transform: `translateX(${INITIAL_POSITION}px)` }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}>

        <div className="pixel-pet-status" role="status">
          {isDialogVisible && (
            <div
              ref={dialogRef}
              className="pixel-pet-dialog"
              style={{
                ...getDialogStyle(visibleEmotion),
                ...(dialogPlacement && {
                  left: dialogPlacement.left,
                  maxWidth: dialogPlacement.maxWidth,
                }),
              }}
            >
              {isSpeaking
                ? formatMessage(speech.message, speech.emotion)
                : visibleEmotion && emotionMessages[visibleEmotion]}
            </div>
          )}
        </div>

        {isMenuVisible && (
          <PetMenu
            ref={menuRef}
            id={menuId}
            initialFocus={menuFocus}
            label={fillName(menuLabels?.menu ?? DEFAULT_MENU_LABEL)}
            closeLabel={fillName(menuLabels?.close ?? DEFAULT_CLOSE_LABEL)}
            actions={actions}
            renderLabel={(text) => formatMessage(text, null)}
            style={{
              ...getMenuFallbacks(),
              ...(menuPlacement && {
                left: menuPlacement.left,
                maxWidth: `min(var(--pixel-pet-menu-max-width, ${DIALOG_MAX_WIDTH}px), ${menuPlacement.maxWidth}px)`,
              }),
            }}
            onSelect={selectMenuAction}
            onClose={closeMenu}
            restoreFocus={() => petRef.current?.focus()}
          />
        )}

        <button
          ref={petRef}
          type="button"
          aria-label={fillName(label ?? petName)}
          aria-haspopup={hasMenu ? 'menu' : undefined}
          aria-expanded={hasMenu ? isMenuVisible : undefined}
          aria-controls={isMenuVisible ? menuId : undefined}
          className={`pixel-pet-sprite pixel-pet-${variant} ${stateClass} ${
            direction === 'left' ? 'pixel-pet-flip-x' : ''
          }`}
          style={spriteSrc ? { backgroundImage: `url(${toCssString(spriteSrc)})` } : undefined}
          onClick={handleClick}
          onKeyDown={handlePetKeyDown}
          onFocus={(event) => setIsFocused(event.currentTarget.matches(':focus-visible'))}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  );
};