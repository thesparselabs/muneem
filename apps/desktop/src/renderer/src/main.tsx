import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import App from './App.js';
import { api } from './api.js';
import { forwardRendererErrors } from './lib/errorForwarding.js';
import './styles.css';

forwardRendererErrors(window, (input) => api.diagnostics.reportRendererError(input));
const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false, staleTime: 5_000 } } });
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <HashRouter><App /></HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
