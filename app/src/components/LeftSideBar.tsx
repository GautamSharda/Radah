import { Plus, Bot, Ellipsis, Edit } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Trash2 } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Agent } from "@/App";
import { useState } from "react";
import RenameAgentPopup from "./helpers/RenameAgentPopup";

interface LeftSideBarProps {
  agents: Agent[];
  onNewAgentClick: () => void;
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  onRenameAgent: (agentId: string, newName: string) => void;
}

export function LeftSideBar({ agents, onNewAgentClick, selectedAgentId, onAgentSelect, onDeleteAgent, onRenameAgent }: LeftSideBarProps) {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [renameAgentPopup, setRenameAgentPopup] = useState<{ agentId: string, name: string } | null>(null);
  console.log("renameAgentPopup");
  console.log(renameAgentPopup);
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold mb-4 text-black">Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            {agents.map((agent, index) => {
              const agentId = agent.agent_id;
              return (
                <Button
                  key={index}
                  className="w-full justify-start mb-2 py-0 pl-4 pr-0"
                  variant={selectedAgentId === agentId ? "default" : "secondary"}
                  onClick={() => onAgentSelect(agentId)}
                >
                  <div className="flex flex-row items-center justify-between w-full h-full">
                    <div className="flex flex-row items-center">
                      <Bot className="mr-2 h-4 w-4" />
                      {agent.agent_name}
                    </div>
                    <Popover open={openPopoverId === agentId} onOpenChange={(open) => setOpenPopoverId(open ? agentId : null)}>
                      <PopoverTrigger asChild>
                        <div className="flex flex-row items-center h-full pr-4 hover:cursor-pointer" onClick={(e) => {
                          e.stopPropagation();
                        }}>
                          <Ellipsis className="ml-2 h-4 w-4" />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-0 border-none" side="right">
                        <Button
                          variant="ghost"
                          className="w-full justify-start hover:bg-gray-100 px-3 py-2 text-sm border-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPopoverId(null);
                            console.log(agents);
                            const agent = agents.find(a => a.agent_id === agentId);
                            console.log('found this agent');
                            console.log(agent);
                            if (agent) {
                              setRenameAgentPopup({ agentId, name: agent.agent_name });
                            }
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-100 px-3 py-2 text-sm border-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPopoverId(null);
                            onDeleteAgent(agentId);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </Button>
              );
            })}
            <Button className="w-full justify-start" variant="ghost" onClick={onNewAgentClick}>
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      {renameAgentPopup && (
        <RenameAgentPopup
          agentName={renameAgentPopup.name}
          onRename={(newName) => onRenameAgent(renameAgentPopup.agentId, newName)}
          setRenameAgentPopup={() => setRenameAgentPopup(null)}
        />
      )}
    </Sidebar>
  )
}
