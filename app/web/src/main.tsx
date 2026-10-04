import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import './index.css'
import { AppRoutes } from './App'
import { DesktopShell } from './ui/DesktopShell'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <DesktopShell>
          <AppRoutes />
        </DesktopShell>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
