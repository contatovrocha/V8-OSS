import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, MemoryRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// Hospedagem estática (GitHub Pages, links compartilhados) usa rotas com # para não depender do servidor.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
