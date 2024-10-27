import * as React from "react"
import { Settings, HelpCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

// Create a separate context for the right sidebar
const RightSidebarContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null)

export function RightSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(true)

  return (
    <RightSidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </RightSidebarContext.Provider>
  )
}

// Custom hook for using the right sidebar context
function useRightSidebar() {
  const context = React.useContext(RightSidebarContext)
  if (!context) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider")
  }
  return context
}

export function RightSidebar() {
  const { isOpen } = useRightSidebar()

  // Menu items for the right sidebar
  const items = [
    { title: "Settings", url: "#", icon: Settings },
    { title: "Help", url: "#", icon: HelpCircle },
    { title: "About", url: "#", icon: Info },
  ]

  return (
    <div className="relative">
      <div 
        className={`
          fixed top-0 right-0 h-full bg-white border-l
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ width: '16rem' }} // Set a fixed width
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Messages</h2>
          <nav>
            {items.map((item) => (
              <a
                key={item.title}
                href={item.url}
                className="flex items-center p-2 hover:bg-gray-100 rounded"
              >
                <item.icon className="mr-2" size={18} />
                <span>{item.title}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

export function RightSidebarTrigger() {
  const { isOpen, setIsOpen } = useRightSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsOpen(!isOpen)}
      className="fixed right-4 top-4 z-50"
    >
      {isOpen ? <HelpCircle /> : <Info />}
    </Button>
  )
}
