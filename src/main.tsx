import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, readTheme } from './theme';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found.');
}

applyTheme(readTheme());

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
