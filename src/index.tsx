import React, {
  useState,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  CSSProperties,
} from 'react';
import './styles.css';

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
export type PetMessages = Partial<Record<PetEmotion, React.ReactNode>>;

export interface PetSayOptions {
  emotion?: PetEmotion;
  duration?: number;
}

export interface PixelPetHandle {
  say: (message: React.ReactNode, options?: PetSayOptions) => void;
  hush: () => void;
}

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const DIALOG_EDGE_GAP = 4;
const DIALOG_MAX_WIDTH = 240;
const DEFAULT_SPEECH_DURATION = 5000;
const SPRITE_MAX_WIDTH = 65;
const INITIAL_POSITION = 100;
const WALK_SPEED = 0.04;
const MAX_FRAME_GAP = 100;

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

export interface PixelPetProps {
  petName?: string;
  variant?: PetVariant;
  spriteSrc?: string;
  color?: string;
  label?: string;
  walk?: boolean;
  messages?: PetMessages;
  dialogStyle?: DialogStyleProps;
  emotionDialogStyles?: Partial<Record<PetEmotion, DialogStyleProps>>;
  ref?: React.Ref<PixelPetHandle>;
}

const DEFAULT_EMOTION_STYLES: Record<PetEmotion, DialogStyleProps> = {
  happy: {
    backgroundColor: '#1e1c063d',
    borderColor: '#ffeb3b',
  },
  angry: {
    backgroundColor: '#21090833',
    borderColor: '#F04037',
  },
  curious: {
    backgroundColor: '#1f341d3a',
    borderColor: '#8BE383',
  },
};

const DEFAULT_SPEECH_STYLE: DialogStyleProps = {
  backgroundColor: '#05080cd9',
  borderColor: 'var(--pixel-pet-color, #FDDBA0)',
};

export const PixelPet: React.FC<PixelPetProps> = ({
  petName = 'Static',
  variant = 'cat',
  spriteSrc,
  color,
  label,
  walk = true,
  messages,
  dialogStyle = {},
  emotionDialogStyles = {},
  ref,
}) => {
  const [action, setAction] = useState<PetAction>('idle');
  const prefersReducedMotion = usePrefersReducedMotion();
  const canWalk = walk && !prefersReducedMotion;
  const stageRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPlacement, setDialogPlacement] = useState<{ left: number; maxWidth: number } | null>(null);
  const [activeEmotion, setActiveEmotion] = useState<PetEmotion | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isUserTriggered, setIsUserTriggered] = useState<boolean>(false);
  const [speech, setSpeech] = useState<{ message: React.ReactNode; emotion: PetEmotion | null } | null>(
    null,
  );

  const posXRef = useRef<number>(INITIAL_POSITION);
  const [stageWidth, setStageWidth] = useState<number>(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const emotionMessages: Record<PetEmotion, React.ReactNode> = {
    happy: messages?.happy ?? (
      <>
        <span className="pixel-pet-highlight-pet">{petName}</span> is feeling{' '}
        <span className="pixel-pet-highlight-happy">happy</span>!
      </>
    ),
    angry: messages?.angry ?? (
      <>
        <span className="pixel-pet-highlight-pet">{petName}</span> is feeling{' '}
        <span className="pixel-pet-highlight-angry">overwhelmed</span>!
      </>
    ),
    curious: messages?.curious ?? (
      <>
        <span className="pixel-pet-highlight-pet">{petName}</span> is very{' '}
        <span className="pixel-pet-highlight-curious">curious</span>
      </>
    ),
  };

  const actionRef = useRef<PetAction>(action);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCooldownRef = useRef<boolean>(false);
  const isEmotionFrozenRef = useRef<boolean>(false);
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastEmotionRef = useRef<PetEmotion>('happy');
  const clickTimestampsRef = useRef<number[]>([]);

  const isSpeakingRef = useRef<boolean>(false);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDurationRef = useRef<number>(DEFAULT_SPEECH_DURATION);

  const triggerEmotion = (emotion: PetEmotion, fromUser = false) => {
    if (action === 'sleep') {
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
        setAction((prevAction) => (prevAction === 'sleep' ? 'idle' : prevAction));
        updateSpeech({ message, emotion: options.emotion ?? null });
        speechDurationRef.current = options.duration ?? DEFAULT_SPEECH_DURATION;
        scheduleSpeechEnd(speechDurationRef.current);
      },
      hush: () => {
        clearSpeechTimer();
        updateSpeech(null);
      },
    }),
    [],
  );

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivity = () => {
      setAction((prevAction) => {
        if (prevAction === 'sleep') return 'idle';
        return prevAction;
      });

      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setActiveEmotion(null);
        updateSpeech(null);
        setAction('sleep');
      }, 120000);
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetInactivity, { passive: true });
    });
    resetInactivity();

    return () => {
      clearTimeout(inactivityTimer);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetInactivity);
      });
    };
  }, []);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    const emotionInterval = setInterval(() => {
      if (actionRef.current === 'sleep' || isSpeakingRef.current) return;

      const emotions: PetEmotion[] = ['happy', 'angry', 'curious'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

      triggerEmotion(randomEmotion);
    }, 30000);

    return () => {
      clearInterval(emotionInterval);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (action === 'sleep' || !canWalk) return;

    if (action === 'walk') {
      const walkDuration = Math.floor(Math.random() * (180000 - 5000 + 1)) + 5000;

      actionTimerRef.current = setTimeout(() => {
        setAction('idle');
        idleCooldownRef.current = true;

        setTimeout(() => {
          idleCooldownRef.current = false;
        }, 30000);
      }, walkDuration);
    } else {
      const decideNextAction = () => {
        if (!idleCooldownRef.current && Math.random() > 0.4) {
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
  }, [action, canWalk]);

  const applyPosition = (x: number) => {
    posXRef.current = x;
    if (walkerRef.current) walkerRef.current.style.transform = `translateX(${x}px)`;
  };

  useEffect(() => {
    if (action !== 'walk' || activeEmotion !== null || speech !== null || !canWalk) return;

    const minBoundary = 0;
    const maxBoundary = stageWidth - SPRITE_MAX_WIDTH;
    if (maxBoundary <= minBoundary) return;

    let frameId = 0;
    let lastTime: number | null = null;

    const step = (time: number) => {
      const elapsed = lastTime === null ? 0 : Math.min(time - lastTime, MAX_FRAME_GAP);
      lastTime = time;
      const nextX = posXRef.current + (direction === 'right' ? 1 : -1) * WALK_SPEED * elapsed;

      if (nextX <= minBoundary || nextX >= maxBoundary) {
        if (Math.random() > 0.5) {
          setAction('idle');
          idleCooldownRef.current = true;
          setTimeout(() => {
            idleCooldownRef.current = false;
          }, 30000);
          return;
        }

        applyPosition(nextX <= minBoundary ? minBoundary + 2 : maxBoundary - 2);
        setDirection((prevDir) => (prevDir === 'right' ? 'left' : 'right'));
        return;
      }

      applyPosition(nextX);
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [action, activeEmotion, speech, direction, canWalk, stageWidth]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateStageWidth = (width: number) => {
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

  const handleClick = () => {
    const now = Date.now();

    if (action === 'sleep') {
      setAction('idle');
    }

    if (isSpeakingRef.current) {
      clearSpeechTimer();
      updateSpeech(null);
    }

    const recentClicks = [...clickTimestampsRef.current, now].filter(
      (timestamp) => now - timestamp <= 10000
    );
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length > 5) {
      clickTimestampsRef.current = [];
      triggerEmotion('angry', true);
    } else {
      triggerEmotion(lastEmotionRef.current, true);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (isSpeakingRef.current) clearSpeechTimer();
    if (activeEmotion) {
      isEmotionFrozenRef.current = true;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isSpeakingRef.current) scheduleSpeechEnd(speechDurationRef.current);
    if (activeEmotion) {
      isEmotionFrozenRef.current = false;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      emotionTimerRef.current = setTimeout(() => {
        setActiveEmotion(null);
      }, 5000);
    }
  };

  const isSpeaking = speech !== null && action !== 'sleep';
  const visibleEmotion = action === 'sleep' ? null : isSpeaking ? speech.emotion : activeEmotion;
  const isDialogVisible =
    isSpeaking || (visibleEmotion !== null && (isHovered || isFocused || isUserTriggered));

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const walker = walkerRef.current;
    const dialog = dialogRef.current;
    if (!isDialogVisible || !stage || !walker || !dialog) return;

    const stageWidth = stage.clientWidth;
    const maxWidth = Math.max(Math.min(DIALOG_MAX_WIDTH, stageWidth - DIALOG_EDGE_GAP * 2), 0);
    const dialogWidth = Math.min(dialog.offsetWidth, maxWidth);
    const petCenter = posXRef.current + walker.offsetWidth / 2;
    const minLeft = DIALOG_EDGE_GAP;
    const maxLeft = stageWidth - DIALOG_EDGE_GAP - dialogWidth;
    const centeredLeft = petCenter - dialogWidth / 2;
    const left = Math.max(Math.min(centeredLeft, maxLeft), minLeft);

    setDialogPlacement({ left: left - posXRef.current, maxWidth });
  }, [isDialogVisible, visibleEmotion, speech, stageWidth]);

  const getCurrentStateClass = () => {
    if (visibleEmotion) return `pixel-pet-state-${visibleEmotion}`;
    if ((!canWalk || isSpeaking) && action === 'walk') return 'pixel-pet-state-idle';
    return `pixel-pet-state-${action}`;
  };

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
      borderRadius: customEmotionConfig.borderRadius || dialogStyle.borderRadius || '5px',
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
        className="pixel-pet-container"
        style={{ transform: `translateX(${INITIAL_POSITION}px)` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}>

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
              {isSpeaking ? speech.message : visibleEmotion && emotionMessages[visibleEmotion]}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={label ?? petName}
          className={`pixel-pet-sprite pixel-pet-${variant} ${getCurrentStateClass()} ${
            direction === 'left' ? 'pixel-pet-flip-x' : ''
          }`}
          style={spriteSrc ? { backgroundImage: `url("${spriteSrc}")` } : undefined}
          onClick={handleClick}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  );
};