import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill para evitar "process is not defined" no navegador (comum em Vite)
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {
      VITE_API_KEY: (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY || '',
      API_KEY: (import.meta as any).env?.API_KEY || ''
    }
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);