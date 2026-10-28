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
  rest: (at: RestAt) => void;
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

const getRestX = (at: RestAt, stageWidth: number) => {
  const maxX = Math.max(stageWidth - SPRITE_MAX_WIDTH, 0);
  if (at === 'left') return 0;
  if (at === 'right') return maxX;
  return maxX / 2;
};

interface RestState {
  at: RestAt;
  phase: 'walking' | 'asleep';
  origin: 'method' | 'prop';
}

const getContainedPlacement = (stageWidth: number, anchorCenter: number, boxWidth: number) => {
  const maxWidth = Math.max(Math.min(DIALOG_MAX_WIDTH, stageWidth - DIALOG_EDGE_GAP * 2), 0);
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

const DEFAULT_SPEECH_STYLE: DialogStyleProps = {
  backgroundColor: '#05080ceb',
  borderColor: 'var(--pixel-pet-color, #FDDBA0)',
};

export const PixelPet: React.FC<PixelPetProps> = ({
  petName = 'Static',
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
  const standingAtRef = useRef<RestAt | null>(null);
  const previousRestingRef = useRef<RestAt | null | undefined>(resting);
  const onRestingChangeRef = useRef(onRestingChange);
  const [activeEmotion, setActiveEmotion] = useState<PetEmotion | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isUserTriggered, setIsUserTriggered] = useState<boolean>(false);
  const [isHoverMuted, setIsHoverMuted] = useState<boolean>(false);
  const [speech, setSpeech] = useState<{ message: React.ReactNode; emotion: PetEmotion | null } | null>(
    null,
  );

  const posXRef = useRef<number>(INITIAL_POSITION);
  const [stageWidth, setStageWidth] = useState<number>(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

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
  const isEmotionFrozenRef = useRef<boolean>(false);
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastEmotionRef = useRef<PetEmotion>('happy');
  const clickTimestampsRef = useRef<number[]>([]);
  const clickBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      rest: (at) => {
        if (isShowcase || restStateRef.current) return;

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

    const resetInactivity = () => {
      setAction((prevAction) => {
        if (prevAction === 'sleep') return 'idle';
        return prevAction;
      });

      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (restStateRef.current) return;
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
    };
  }, []);

  useEffect(() => {
    if (action === 'sleep' || !canWalk || isMenuVisible || isResting) return;

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

  const applyPosition = (x: number) => {
    posXRef.current = x;
    if (walkerRef.current) walkerRef.current.style.transform = `translateX(${x}px)`;
  };

  useEffect(() => {
    if (
      action !== 'walk' ||
      activeEmotion !== null ||
      speech !== null ||
      !canWalk ||
      isMenuVisible ||
      isResting
    ) {
      return;
    }

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
  }, [action, activeEmotion, speech, direction, canWalk, stageWidth, isMenuVisible, isResting]);

  useEffect(() => {
    const stage = stageRef.current;
    if (restState?.phase !== 'walking' || !stage) return;

    const targetX = getRestX(restState.at, stage.clientWidth);
    if (!canWalk) {
      applyPosition(targetX);
      arriveAt(restState);
      return;
    }

    setDirection(targetX >= posXRef.current ? 'right' : 'left');

    let frameId = 0;
    let lastTime: number | null = null;

    const step = (time: number) => {
      const elapsed = lastTime === null ? 0 : Math.min(time - lastTime, MAX_FRAME_GAP);
      lastTime = time;
      const distance = targetX - posXRef.current;
      const stride = WALK_SPEED * elapsed;

      if (Math.abs(distance) <= stride) {
        applyPosition(targetX);
        arriveAt(restState);
        return;
      }

      applyPosition(posXRef.current + Math.sign(distance) * stride);
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [restState, stageWidth, canWalk]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (restState?.phase !== 'asleep' || !stage) return;

    applyPosition(getRestX(restState.at, stage.clientWidth));
  }, [restState, stageWidth]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateStageWidth = (width: number) => {
      standingAtRef.current = null;
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
      setMenuFocus('first');
      setIsMenuOpen((open) => !open);
      return;
    }

    if (isShowcase) {
      updateSpeech({ message: messages?.greeting ?? DEFAULT_GREETING, emotion: null });
      speechDurationRef.current = CLICK_BUBBLE_DURATION;
      scheduleSpeechEnd(CLICK_BUBBLE_DURATION);
      return;
    }

    if (isSpeakingRef.current) {
      clearSpeechTimer();
      updateSpeech(null);
    }

    isEmotionFrozenRef.current = false;
    setIsHoverMuted(true);
    if (clickBubbleTimerRef.current) clearTimeout(clickBubbleTimerRef.current);
    clickBubbleTimerRef.current = setTimeout(() => setIsUserTriggered(false), CLICK_BUBBLE_DURATION);

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
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setMenuFocus(event.key === 'ArrowDown' ? 'first' : 'last');
      setIsMenuOpen(true);
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

    const petCenter = posXRef.current + walker.offsetWidth / 2;
    const { left, maxWidth } = getContainedPlacement(stage.clientWidth, petCenter, dialog.offsetWidth);

    setDialogPlacement({ left: left - posXRef.current, maxWidth });
  }, [isDialogVisible, visibleEmotion, speech, stageWidth]);

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
    if (!isMenuVisible || !stage || !walker || !menu) return;

    const petCenter = posXRef.current + walker.offsetWidth / 2;
    const { left, maxWidth } = getContainedPlacement(stage.clientWidth, petCenter, menu.offsetWidth);

    setMenuPlacement({ left: left - posXRef.current, maxWidth });
  }, [isMenuVisible, actions, stageWidth]);

  const getCurrentStateClass = () => {
    if (restState) return restState.phase === 'walking' ? 'pixel-pet-state-walk' : 'pixel-pet-state-sleep';
    if (isMenuVisible) return 'pixel-pet-state-idle';
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
            style={{
              ...getDialogStyle(null),
              ...(menuPlacement && { left: menuPlacement.left, maxWidth: menuPlacement.maxWidth }),
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
          className={`pixel-pet-sprite pixel-pet-${variant} ${getCurrentStateClass()} ${
            direction === 'left' ? 'pixel-pet-flip-x' : ''
          }`}
          style={spriteSrc ? { backgroundImage: `url("${spriteSrc}")` } : undefined}
          onClick={handleClick}
          onKeyDown={handlePetKeyDown}
          onFocus={(event) => setIsFocused(event.currentTarget.matches(':focus-visible'))}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </div>
  );
};