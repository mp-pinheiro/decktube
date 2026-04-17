import { Link, useLocation } from 'react-router-dom'
import { routes } from '../routePaths'
import { Search, PlaySquare } from 'lucide-react'
import { useInputContext } from '../contexts/InputContext'
import SettingsButton from './SettingsButton'

export default function Header() {
  const { searchText, openVirtualKeyboard } = useInputContext()
  const location = useLocation()

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === routes.home) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('home-refresh'))
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-30">
      <Link to={routes.home} id="home-link" tabIndex={0} onClick={handleLogoClick} className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <PlaySquare size={18} className="text-white fill-white" />
        </div>
        <span className="text-lg font-bold tracking-tighter text-white">DeckTube</span>
      </Link>

      <div className="flex-1 max-w-2xl px-8">
        <div className="relative group w-full">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
            <Search size={18} />
          </div>
          <div
            id="search-display"
            tabIndex={0}
            role="button"
            onClick={openVirtualKeyboard}
            className="w-full h-10 bg-zinc-900 border border-white/10 rounded-full pl-12 pr-4 flex items-center text-sm cursor-pointer focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500 transition-all"
          >
            {searchText ? (
              <span className="text-zinc-100 truncate">{searchText}</span>
            ) : (
              <span className="text-zinc-500">Search videos...</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SettingsButton />
      </div>
    </header>
  )
}
