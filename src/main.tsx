import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// ═══════════════════════════════════════════════════════════════
// Registro do Service Worker (PWA)
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Service Worker registrado:', reg.scope);
        // Verificar atualizações periodicamente (a cada 1h)
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => console.warn('SW registro falhou:', err));
  });
}
