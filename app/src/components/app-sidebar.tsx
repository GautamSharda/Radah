import { Plus, Briefcase, Zap } from "lucide-react"

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
import { Switch } from "./ui/switch";
import { User } from "@/App";
import { Agent } from "@/App";
import { core } from "@tauri-apps/api";
import { useError } from "@/hooks/ErrorContext";
interface AppSidebarProps {
  agents: Agent[];
  user: User | undefined;
  setUser: (user: User) => void;
  onNewAgentClick: () => void;
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string) => void;
}

export function AppSidebar({ agents, onNewAgentClick, selectedAgentId, onAgentSelect, user, setUser }: AppSidebarProps) {
  const { setError } = useError();

  async function toggleSwitch() {
    if (!user) return;
    const newUser = { ...user, show_controls: !user.show_controls };
    setUser(newUser);
    try {
      await core.invoke('update_user_data', { showControls: !user.show_controls });
    } catch {
      setError({ primaryMessage: "Oops! We failed to update your setting. Refresh and try again.", timeout: 5000, type: 'warning' });
    }
  }
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
                  className="w-full justify-start mb-2"
                  variant={selectedAgentId === agentId ? "default" : "secondary"}
                  onClick={() => onAgentSelect(agentId)}
                >
                  {agent.agent_type === 'jim' ? (
                    <>
                      <Briefcase className="mr-2 h-4 w-4" />
                      J.I.M {agent.number}
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      P.A.M {agent.number}
                    </>
                  )}
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
            {
              user && (
                <div className="w-full justify-between flex items-center">
                  <p>Hide computer controls</p>
                  <Switch checked={!user.show_controls} onCheckedChange={toggleSwitch} />
                </div>
              )
            }
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
