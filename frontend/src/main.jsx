import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes pulse  { 0%,100% { opacity:.4 } 50% { opacity:.9 } }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
