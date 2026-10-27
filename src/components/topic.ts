import type { CSSProperties } from 'react';

// Variable CSS --topic con el color del tema (la usan bordes, etiquetas y números).
export const topicStyle = (color: string) => ({ '--topic': color }) as CSSProperties;
