import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { Message } from "@/App";

interface RightSidebarProps {
  messages: Message[];
  agentId: string | undefined;
}

export function RightSidebar({ messages, agentId }: RightSidebarProps) {
  const { isOpen } = useRightSidebar()

  console.log('right sidebar');
  console.log(messages);
  const usedMessageIDSet = new Set<string>();
  const uniqueMessages = messages
    .filter(message => (!(message.agent_id && message.agent_id !== agentId)))
    .filter(message => message.message_id && !usedMessageIDSet.has(message.message_id) && usedMessageIDSet.add(message.message_id));
  console.log('unique messages');
  console.log(uniqueMessages);

  return (
    <div
      className={`
          h-full bg-white border-l
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-96' : 'w-0 overflow-hidden'}
        `}
      style={{ transitionProperty: 'width' }}
    >
      <div className="h-full flex flex-col p-4">
        <h2 className="text-lg font-semibold">Messages</h2>
        <hr className="border-t border-slate-200 my-4 w-full" />
        {uniqueMessages.length === 0 ? (
          <p className="text-slate-500">No messages yet</p>
        ) : (
          <div className="w-full h-full flex flex-col overflow-y-scroll">
            {uniqueMessages.map((message, index) => {
              return (
                <div key={index} className="border-b border-slate-200 mb-2 pb-2 w-full">
                  <p>{message.text ? message.text : JSON.stringify(message)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}




// Ewwww... Contexts are gross

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
