import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft } from "lucide-react"

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

  return (
    <div className={`relative transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div 
        className={`
          h-full bg-white border-l
          transition-all duration-300 ease-in-out w-64
          ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}
        `}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Messages</h2>
          {/* Content for messages can be added here */}
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
      {isOpen ? <ChevronRight /> : <ChevronLeft />}
    </Button>
  )
}
