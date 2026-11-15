import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/app.css';
import './styles/charts.css';
import './styles/sections.css';
import './styles/sections2.css';
import './styles/glass.css';

// Pointer sheen on glass panels (desktop pointers only; one listener, cheap CSS variables).
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card, .nav-inner');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
