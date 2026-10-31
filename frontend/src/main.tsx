import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateLegacySshProfiles, purgeWebSshProfiles } from './lib/sshClient';

purgeWebSshProfiles();
void migrateLegacySshProfiles();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
