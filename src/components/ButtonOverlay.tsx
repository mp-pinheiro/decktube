import { useInputContext } from '../contexts/InputProvider'

export default function ButtonOverlay() {
  const { buttonConfigs } = useInputContext()

  const visibleButtons = buttonConfigs.filter(b => b.visible)

  if (visibleButtons.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl shadow-2xl z-40">
      {visibleButtons.map((button, index) => (
        <div key={button.key} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <kbd className="w-5 h-5 flex items-center justify-center bg-zinc-700 rounded text-[10px] font-bold">
              {button.key}
            </kbd>
            <span className="text-xs font-medium text-zinc-300">{button.label}</span>
          </div>
          {index < visibleButtons.length - 1 && (
            <div className="w-px h-4 bg-white/10 ml-3" />
          )}
        </div>
      ))}
    </div>
  )
}
