import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { Message } from "@/App";
import { MessageInput } from "./view-agent/MessageInput";
import { MessageBubble } from "./view-agent/MessageBubble";

interface RightSidebarProps {
  messages: Message[];
  agentId: string | undefined;
  sendMessage: (message: string) => void;
}

export function RightSidebar({ messages, agentId, sendMessage }: RightSidebarProps) {
  const { isOpen } = useRightSidebar()

  console.log('right sidebar');
  console.log(messages);
  const usedMessageIDSet = new Set<string>();
  const uniqueMessages = messages
    .filter(message => !(message['agent-message']))
    .filter(message => !(message.agent_id && message.agent_id !== agentId))
    .filter(message => message.message_id && !usedMessageIDSet.has(message.message_id) && usedMessageIDSet.add(message.message_id));
  console.log('unique messages');
  console.log(uniqueMessages);

  return (
    <div
      className={`
          h-full bg-white border-l
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[480px]' : 'w-0 overflow-hidden'}
        `}
      style={{ transitionProperty: 'width' }}
    >
      <div className="h-full flex flex-col py-4">
        <div className="px-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <hr className="border-t border-slate-200 my-2 w-full" />
        </div>
        <div className="w-full h-full flex flex-col overflow-y-scroll px-4 gap-4 pb-20">
          {uniqueMessages.length === 0 ? (
            <p className="text-slate-500">No messages yet</p>
          ) : (
            uniqueMessages.map((message, index) => <MessageBubble key={index} message={message} />)
          )}
        </div>
        <div className="flex flex-row justify-end w-full px-4">
          {agentId && <MessageInput
            sendMessage={sendMessage}
            promptRunning="false"
            currentAgentID={agentId}
            stopAgent={() => { }}
          />}
        </div>
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
