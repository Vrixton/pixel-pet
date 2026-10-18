import React, { useState, useEffect, CSSProperties } from 'react';
import catSprite from './cat-sprite.png';
import './styles.css';

export interface DialogStyleProps {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  fontFamily?: string;
  boxShadow?: string;
}

export interface PixelPetProps {
  petName?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: number;
  messages?: {
    idle?: string[];
    happy?: string[];
    angry?: string[];
    laughing?: string[];
    sleeping?: string[];
  };
  dialogStyle?: DialogStyleProps;
}

export const PixelPet: React.FC<PixelPetProps> = ({
  petName = 'Gatito',
  position = 'bottom-right',
  size = 60,
  messages,
  dialogStyle = {},
}) => {
  const [state, setState] = useState<'idle' | 'happy' | 'angry' | 'laughing' | 'sleeping'>('idle');
  const [dialog, setDialog] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState<number>(0);

  const defaultMessages = {
    idle: [`${petName} te observa atentamente.`, `${petName} menea su antena.`],
    happy: [`❤️ ¡A ${petName} le encantan los mimos!`, `✨ ¡${petName} ronronea de alegría!`],
    angry: [`💢 ¡Oye! No molestes tanto a ${petName}.`, `🔥 ${petName} está de mal humor.`],
    laughing: [`😂 ¡A ${petName} le dan cosquillas!`, `✨ ¡${petName} se ríe alegremente!`],
    sleeping: [`zZz ${petName} se ha dormido...`, `😴 ${petName} está soñando.`],
    ...messages,
  };

  const showMessage = (text: string) => {
    setDialog(text);
    setTimeout(() => setDialog(null), 3000);
  };

  useEffect(() => {
    const sleepTimer = setTimeout(() => {
      setState('sleeping');
      showMessage(defaultMessages.sleeping[0]);
    }, 20000);

    return () => clearTimeout(sleepTimer);
  }, [clickCount, state]);

  const handleClick = () => {
    const nextClicks = clickCount + 1;
    setClickCount(nextClicks);

    if (nextClicks >= 5) {
      setState('angry');
      const list = defaultMessages.angry;
      showMessage(list[Math.floor(Math.random() * list.length)]);
      setTimeout(() => {
        setClickCount(0);
        setState('idle');
      }, 3500);
    } else {
      setState('happy');
      const list = defaultMessages.happy;
      showMessage(list[Math.floor(Math.random() * list.length)]);
      setTimeout(() => setState('idle'), 2500);
    }
  };

  const handleDoubleClick = () => {
    setState('laughing');
    const list = defaultMessages.laughing;
    showMessage(list[Math.floor(Math.random() * list.length)]);
    setTimeout(() => setState('idle'), 2500);
  };

  // Mapeo dinámico para el estilo del globo de texto
  const customDialogCSS: CSSProperties = {
    backgroundColor: dialogStyle.backgroundColor || '#051419',
    color: dialogStyle.textColor || '#52f3f6',
    border: `${dialogStyle.borderWidth || '2px'} solid ${dialogStyle.borderColor || '#07ced2'}`,
    borderRadius: dialogStyle.borderRadius || '4px',
    fontFamily: dialogStyle.fontFamily || "'Share Tech Mono', monospace"
  };

  return (
    <div className={`pixel-pet-container ${position}`}>
      {dialog && (
        <div className="pixel-pet-dialog" style={customDialogCSS}>
          {dialog}
        </div>
      )}

      <div
        className={`pixel-pet-sprite state-${state}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundImage: `url(${catSprite})`,
          backgroundSize: `${size * 8 - 10}px auto`,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};