interface Tab {
  id: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="mb-3 flex items-center gap-3 border-b border-zinc-800 pb-3 px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          tabIndex={-1}
          onClick={() => onTabChange(tab.id)}
          className={`text-lg font-bold border-b-2 pb-1 transition-colors ${
            tab.id === activeTab
              ? 'border-red-500 text-white'
              : 'border-transparent text-zinc-500'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
