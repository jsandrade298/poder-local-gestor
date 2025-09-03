import { useEffect } from "react";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { data: config } = useConfiguracoes();

  useEffect(() => {
    if (config?.tema) {
      // Aplicar cores personalizadas do tema
      const root = document.documentElement;
      
      if (config.tema.cor_primaria) {
        // Converter hex para HSL
        const primaryHsl = hexToHsl(config.tema.cor_primaria);
        if (primaryHsl) {
          root.style.setProperty('--primary', primaryHsl);
        }
      }
      
      if (config.tema.cor_secundaria) {
        const secondaryHsl = hexToHsl(config.tema.cor_secundaria);
        if (secondaryHsl) {
          root.style.setProperty('--secondary', secondaryHsl);
        }
      }
    }
  }, [config]);

  return <>{children}</>;
}

// Função auxiliar para converter hex para HSL
function hexToHsl(hex: string): string | null {
  // Remove o # se presente
  hex = hex.replace('#', '');
  
  // Converte hex para RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // Achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}