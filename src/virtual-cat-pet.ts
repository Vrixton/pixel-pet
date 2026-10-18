export interface VirtualPetProps {
  // Configuración del personaje
  petName?: string;               // Ej: "Mimi", "Neko", "Gatito"
  
  // Mensajes personalizados
  messages?: {
    idle?: string[];
    happy?: string[];
    angry?: string[];
    laughing?: string[];
    sleeping?: string[];
  };

  // Personalización del Cuadro de Diálogo
  dialogStyle?: {
    backgroundColor?: string;     // Fondo del cuadro (Ej: "#0d2c35" o "rgba(0,0,0,0.9)")
    textColor?: string;           // Color de la letra (Ej: "#07ced2")
    borderColor?: string;         // Color del borde (Ej: "#52f3f6")
    borderWidth?: string;         // Ancho del borde (Ej: "2px")
    borderRadius?: string;        // Radio de curva o 0px para retro
    fontFamily?: string;          // Fuente personalizada
    boxShadow?: string;           // Sombras o resplandor glow
  };

  // Personalización de la Mascota / Contenedor
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: number;                  // Tamaño en px (default: 60)
  speed?: number;                 // Velocidad del frame rate para la animación del sprite
}