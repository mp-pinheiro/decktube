import { lazy, Suspense, Component, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import { InputProvider } from '../contexts/InputProvider'
import HelpButton from './HelpButton'
import VirtualKeyboard from './VirtualKeyboard'

const LazyUpdateBanner = lazy(() => import('./UpdateBanner'))

class UpdateBannerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? null : this.props.children }
}

export default function Layout() {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch/')

  return (
    <InputProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Header />
        <div className="flex flex-1 pt-16">
          <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
            <Outlet />
          </main>
        </div>
        {!isWatchPage && <HelpButton />}
      </div>
      <VirtualKeyboard />
      <UpdateBannerErrorBoundary>
        <Suspense fallback={null}>
          <LazyUpdateBanner />
        </Suspense>
      </UpdateBannerErrorBoundary>
    </InputProvider>
  )
}
