import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'


// Set title for development environment
if (import.meta.env.DEV) {
  document.title = `WealthPulse (Dev)`;
}

console.log("Main.tsx: App starting...");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("FATAL: Root element not found!");
} else {
  console.log("Main.tsx: Root element found, mounting React app...");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
