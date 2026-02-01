import React from 'react'
import ReactDOM from 'react-dom/client'
import { Buffer } from 'buffer'
import App from './App'
import './index.css'

// Polyfill Buffer for Solana web3.js
window.Buffer = Buffer;
globalThis.Buffer = Buffer;

// Wait for Phantom to inject before mounting app
const mountApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

// Give Phantom time to inject into the window
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mountApp, 100);
  });
} else {
  setTimeout(mountApp, 100);
}
