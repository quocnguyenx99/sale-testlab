import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { TrainingProvider } from './app/TrainingContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TrainingProvider>
        <App />
      </TrainingProvider>
    </BrowserRouter>
  </StrictMode>,
)
