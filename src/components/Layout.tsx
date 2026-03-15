import { Outlet } from 'react-router-dom'
import Header from './Header'
import { InputProvider } from '../contexts/InputProvider'
import HelpButton from './HelpButton'

export default function Layout() {
  return (
    <InputProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Header />
        <div className="flex flex-1 pt-16">
          <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
            <Outlet />
          </main>
        </div>
        <HelpButton />
      </div>
    </InputProvider>
  )
}
