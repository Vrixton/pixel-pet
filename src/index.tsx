import React, { useState, useEffect, useRef, useSyncExternalStore, CSSProperties } from 'react';
import catSprite from './cat-sprite.png';
import dogSprite from './dog-sprite.png';
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
export type PetVariant = 'cat' | 'dog';

const SPRITES: Record<PetVariant, string> = {
  cat: catSprite,
  dog: dogSprite,
};

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
  label?: string;
  size?: number;
  messages?: {
    default?: React.ReactNode;
    happy?: React.ReactNode;
    angry?: React.ReactNode;
    curious?: React.ReactNode;
  };
  dialogStyle?: DialogStyleProps;
  emotionDialogStyles?: Partial<Record<PetEmotion, DialogStyleProps>>;
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

export const PixelPet: React.FC<PixelPetProps> = ({
  petName = 'Static',
  variant = 'cat',
  label,
  size = 60,
  messages,
  dialogStyle = {},
  emotionDialogStyles = {},
}) => {
  const [action, setAction] = useState<PetAction>('idle');
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeEmotion, setActiveEmotion] = useState<PetEmotion | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isUserTriggered, setIsUserTriggered] = useState<boolean>(false);

  const [posX, setPosX] = useState<number>(100);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const emotionMessages: Record<PetEmotion, React.ReactNode> = {
    happy: messages?.happy || (
      <>
        ¡<span className="highlight-pet">{petName}</span> se siente{' '}
        <span className="highlight-happy">feliz</span>!
      </>
    ),
    angry: messages?.angry || (
      <>
        ¡<span className="highlight-pet">{petName}</span> se siente{' '}
        <span className="highlight-angry">abrumado</span>!
      </>
    ),
    curious: messages?.curious || (
      <>
        <span className="highlight-pet">{petName}</span> siente mucha{' '}
        <span className="highlight-curious">curiosidad</span>
      </>
    ),
  };

  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCooldownRef = useRef<boolean>(false);
  const isEmotionFrozenRef = useRef<boolean>(false);
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastEmotionRef = useRef<PetEmotion>('happy');
  const clickTimestampsRef = useRef<number[]>([]);

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
    const emotionInterval = setInterval(() => {
      if (action === 'sleep') return;

      const emotions: PetEmotion[] = ['happy', 'angry', 'curious'];
      const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

      triggerEmotion(randomEmotion);
    }, 30000);

    return () => {
      clearInterval(emotionInterval);
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    };
  }, [action]);

  useEffect(() => {
    if (action === 'sleep') return;

    const decideNextAction = () => {
      if (action === 'idle' && !idleCooldownRef.current) {
        if (!prefersReducedMotion && Math.random() > 0.4) {
          setAction('walk');

          const walkDuration = Math.floor(Math.random() * (180000 - 5000 + 1)) + 5000;

          if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
          actionTimerRef.current = setTimeout(() => {
            setAction('idle');
            idleCooldownRef.current = true;

            setTimeout(() => {
              idleCooldownRef.current = false;
            }, 30000);
          }, walkDuration);
        }
      } else if (action === 'idle') {
        if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
        actionTimerRef.current = setTimeout(decideNextAction, 5000);
      }
    };

    if (action === 'idle') {
      decideNextAction();
    }

    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [action, prefersReducedMotion]);

  useEffect(() => {
    if (action !== 'walk' || activeEmotion !== null || prefersReducedMotion) {
      if (walkIntervalRef.current) clearInterval(walkIntervalRef.current);
      return;
    }

    const speed = 2;
    const minBoundary = 0;
    const maxBoundary = window.innerWidth - size;

    walkIntervalRef.current = setInterval(() => {
      setPosX((prevX) => {
        let nextX = prevX + (direction === 'right' ? speed : -speed);

        if (nextX <= minBoundary || nextX >= maxBoundary) {
          const choice = Math.random() > 0.5 ? 'idle' : 'turn';

          if (choice === 'idle') {
            setAction('idle');
            idleCooldownRef.current = true;
            setTimeout(() => {
              idleCooldownRef.current = false;
            }, 30000);
            return prevX;
          } else {
            setDirection((prevDir) => (prevDir === 'right' ? 'left' : 'right'));
            return prevX <= minBoundary ? minBoundary + 2 : maxBoundary - 2;
          }
        }

        return nextX;
      });
    }, 50);

    return () => {
      if (walkIntervalRef.current) clearInterval(walkIntervalRef.current);
    };
  }, [action, activeEmotion, direction, size, prefersReducedMotion]);

  const handleClick = () => {
    const now = Date.now();

    if (action === 'sleep') {
      setAction('idle');
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
    if (activeEmotion) {
      isEmotionFrozenRef.current = true;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (activeEmotion) {
      isEmotionFrozenRef.current = false;
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      emotionTimerRef.current = setTimeout(() => {
        setActiveEmotion(null);
      }, 5000);
    }
  };

  const getCurrentStateClass = () => {
    if (activeEmotion) return `state-${activeEmotion}`;
    if (prefersReducedMotion && action === 'walk') return 'state-idle';
    return `state-${action}`;
  };

  const getDialogStyle = (): CSSProperties => {
    if (!activeEmotion) return {};

    const defaultEmotionConfig = DEFAULT_EMOTION_STYLES[activeEmotion] || {};

    const customEmotionConfig = emotionDialogStyles[activeEmotion] || {};

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
      className="pixel-pet-container"
      style={{ transform: `translateX(${posX}px)` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}>

      <div className="pixel-pet-status" role="status">
        {activeEmotion && (isHovered || isFocused || isUserTriggered) && (
          <div className="pixel-pet-dialog" style={getDialogStyle()}>
            {emotionMessages[activeEmotion]}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={label ?? petName}
        className={`pixel-pet-sprite ${getCurrentStateClass()} ${
          direction === 'left' ? 'flip-x' : ''
        }`}
        style={{
          backgroundImage: `url(${SPRITES[variant]})`,
        }}
        onClick={handleClick}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  );
};