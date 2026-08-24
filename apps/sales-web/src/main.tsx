import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { TrainingProvider } from './app/TrainingContext'
import { AuthProvider } from './app/AuthContext'
import '@fontsource-variable/inter/wght.css'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><TrainingProvider><App /></TrainingProvider></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
