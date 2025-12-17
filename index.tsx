import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill robusto para garantir que 'process.env' exista sem quebrar builds existentes
const win = window as any;
win.process = win.process || {};
win.process.env = {
  ...(win.process.env || {}),
  VITE_API_KEY: (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY || '',
  API_KEY: (import.meta as any).env?.API_KEY || ''
};

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