import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Le point de montage de DecisionDrift est introuvable.');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
