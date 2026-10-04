import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { getUserId } from './api/client'
import { StoreProvider } from './lib/store'
import { FormCheck } from './lib/formcheck'
import { TabBar, TAB_PATHS, TABBAR_PATHS } from './ui/TabBar'
import { spring } from './ui/motion'
import { LevelUpOverlay } from './screens/LevelUp'
import Welcome from './screens/Welcome'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Checkin from './screens/Checkin'
import Player from './screens/Player'
import FeedbackScreen from './screens/Feedback'
import WeekScreen from './screens/Week'
import Path from './screens/Path'
import ProgressScreen from './screens/Progress'
import Food from './screens/Food'
import Coach from './screens/Coach'
import Scheda from './screens/Scheda'
import ReadinessTestScreen from './screens/ReadinessTest'
import MyData from './screens/MyData'
import Science from './screens/Science'
import WidgetGallery from './screens/WidgetGallery'

const MotionLab = lazy(() => import('./features/motion/MotionLab'))


function RequireUser({ children }: { children: ReactNode }) {
  if (!getUserId()) return <Navigate to="/benvenuto" replace />
  return <>{children}</>
}

function Page({ children, k }: { children: ReactNode; k: string }) {
  const isTab = TAB_PATHS.includes(k)
  return (
    <motion.div
      key={k}
      className="no-scrollbar absolute inset-0 overflow-x-hidden overflow-y-auto"
      initial={{ opacity: 0, x: isTab ? 0 : 40, scale: isTab ? 0.985 : 1 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: isTab ? 0 : -24, transition: { duration: 0.18 } }}
      transition={spring.gentle}
    >
      {children}
    </motion.div>
  )
}

export function AppRoutes() {
  const location = useLocation()
  const showTabs = TABBAR_PATHS.includes(location.pathname)
  const r = (el: ReactNode) => <RequireUser>{el}</RequireUser>
  const pageKey = location.pathname
  return (
    <StoreProvider>
      <div className="app-screen bg-salvia-chiaro">
        <AnimatePresence initial={false}>
          <Page k={pageKey} key={pageKey}>
            <Routes location={location}>
              <Route path="/benvenuto" element={<Welcome />} />
              <Route path="/scheda" element={r(<Scheda />)} />
              <Route path="/onboarding" element={r(<Onboarding />)} />
              <Route path="/test" element={r(<ReadinessTestScreen />)} />
              <Route path="/coach/dati" element={r(<MyData />)} />
              <Route path="/scienza" element={<Science />} />
              <Route path="/coach/scheda" element={r(<Scheda mode="edit" />)} />
              <Route path="/" element={r(<Home />)} />
              <Route path="/checkin/:id" element={r(<Checkin />)} />
              <Route path="/seduta/:id" element={r(<Player />)} />
              <Route path="/feedback/:id" element={r(<FeedbackScreen />)} />
              <Route path="/settimana" element={r(<WeekScreen />)} />
              <Route path="/percorso" element={r(<Path />)} />
              <Route path="/progressi" element={r(<ProgressScreen />)} />
              <Route path="/cibo" element={r(<Food />)} />
              <Route path="/coach" element={r(<Coach />)} />
              <Route path="/widget" element={<WidgetGallery />} />
              <Route path="/formcheck" element={FormCheck ? <Suspense fallback={null}><FormCheck /></Suspense> : <Navigate to="/" replace />} />
              <Route path="/motion-lab" element={<Suspense fallback={null}><MotionLab /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Page>
        </AnimatePresence>
        <AnimatePresence>{showTabs && <TabBar key="tabs" />}</AnimatePresence>
        <LevelUpOverlay />
      </div>
    </StoreProvider>
  )
}
