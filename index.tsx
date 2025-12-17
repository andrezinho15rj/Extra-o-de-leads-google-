
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Shim para ambiente local (Vite) - permite que process.env.API_KEY funcione localmente 
// se houver uma variável VITE_API_KEY no seu .env
if (typeof process === 'undefined') {
  (window as any).process = { env: {} };
}
if (!(process.env as any).API_KEY) {
  (process.env as any).API_KEY = (import.meta as any).env?.VITE_API_KEY;
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
