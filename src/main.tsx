import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import { useEditor } from './store/editorStore';

// Exposed in development only, for debugging and screenshots.
if (import.meta.env.DEV) (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
