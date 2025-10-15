import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar"
import { RightSidebarProvider } from "@/components/RightSidebar"
import RenderCard from "./components/helpers/RenderCard";
import AgentSection from "./components/AgentSection";
import { useError } from "./hooks/ErrorContext";
import Alert from "./components/helpers/Alert";
import { LeftSideBar } from "./components/LeftSideBar";
import EditSystemPromptPopup from "./components/helpers/EditSystemPromptPopup";
import { invoke, listen, isWebPlatform } from "@/lib/platform";

export interface User {
  show_controls: boolean;
}

//This
export interface BaseContainer {
  number: number;
  agent_type: 'jim' | 'pam';
  agent_name: string;
  message_ids: string[];
  agent_id: string;
  system_prompt: string;
}

export interface Container extends BaseContainer {
  id: string;
  vnc_port: number;
}

export interface BuildingContainer extends BaseContainer {
  loading: boolean;
  error: string | null;
}

export type Agent = Container | BuildingContainer;

export interface BaseMessage {
  show_ui?: boolean;
  error?: boolean;
  end_message?: boolean;
  'message-type': 'message' | 'prompt' | 'stop';
  message_id: string;
  agent_id?: string;
}

export interface Message extends BaseMessage {
  "agent-message"?: any;
  "agent-output"?: any;
  text?: string;
};

export default function App() {
  const { error, setError } = useError();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [newAgentPopup, setNewAgentPopup] = useState<boolean>(false);
  const [editSystemPromptPopup, setEditSystemPromptPopup] = useState<boolean>(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  // WebSocket
  const currentAgent = selectedAgentId ? agents.find(agent => agent.agent_id === selectedAgentId) || undefined : undefined;

  useEffect(() => {
    if (isWebPlatform) {
      setIsSetupComplete(true);
      return;
    }

    let mounted = true;
    const unlistenPromise = listen('setup-complete', () => { if (mounted) setIsSetupComplete(true); });

    // Check if setup is already complete (in case we missed the event)
    checkSetupStatus();
    return () => {
      mounted = false;
      unlistenPromise.then(fn => fn());
    };
  }, []);

  async function checkSetupStatus() {
    const isComplete = await invoke<boolean>('is_setup_complete');
    if (isComplete) setIsSetupComplete(true);
  }

  useEffect(() => {
    // Only run initial loading when setup is complete
    if (isSetupComplete) {
      loadUser();
      loadExistingAgents();
    }
  }, [isSetupComplete]);

  async function loadUser() {
    try {
      const user = await invoke<User>('get_user_data');
      // await invoke<User>('clear_all_storage');
      // await invoke<User>('print_all_storage');
      // await invoke<User>('clear_all_messages');
      setUser(user);
    } catch (error) {
      setError({ primaryMessage: "We had an issue loading your settings", timeout: 2500, type: 'warning' });
    }
  }

  async function loadExistingAgents() {
    try {
      const containers = await invoke<Container[]>('get_all_containers');
      setAgents(containers);
      if (containers.length > 0) return setSelectedAgentId(containers[0].agent_id);
      setSelectedAgentId(null);
      setNewAgentPopup(true);
    } catch (error) {
      setError({ primaryMessage: "Oops! We had an issue getting your agents. Refresh and try again.", timeout: 5000 });
    }
  }

  const handleCreateAssistant = async (agentName: string) => {
    setNewAgentPopup(false);
    //remove this down the line when we have a way to select the assistant
    const selectedAssistant = 'pam';
    const existingAgents = agents.filter(agent => agent.agent_type === selectedAssistant);
    const newAgentNumber = existingAgents.length + 1;
    const newAgent: BuildingContainer = { agent_type: selectedAssistant as 'jim' | 'pam', message_ids: [], agent_id: `${selectedAssistant}-${newAgentNumber}`, number: newAgentNumber, loading: true, error: null, agent_name: agentName, system_prompt: 'You are a helpful assistant.' };
    setAgents([...agents, newAgent]);
    setSelectedAgentId(newAgent.agent_id);
    try {
      const containerInfo = await invoke<Container>('create_agent_container', {
        agentId: newAgent.agent_id,
        agentType: selectedAssistant as 'jim' | 'pam',
        agentName: agentName,
        number: newAgent.number,
        messageIds: newAgent.message_ids,
        systemPrompt: newAgent.system_prompt
      });
      setAgents((currentAgents) => {
        return currentAgents.map(agent => agent.agent_id === newAgent.agent_id ? { ...containerInfo } : agent);
      });
    } catch (error) {
      setAgents((agents).map(agent => agent.agent_id === newAgent.agent_id ? { ...newAgent, error: 'Failed to create container', loading: false } : agent));
      console.log(error);
      //@ts-ignore
      setError({ primaryMessage: error, timeout: 7500 });
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const newAgents = agents.filter(agent => agent.agent_id !== agentId);
    setAgents(newAgents);
    if (newAgents.length === 0) {
      setSelectedAgentId(null);
      setNewAgentPopup(true);
    } else {
      setSelectedAgentId(newAgents[0].agent_id);
    }
    try {
      await invoke('delete_agent_container', { agentId });
    } catch (error) {
      setError({ primaryMessage: "Oops! We had an issue deleting your agent. Refresh and try again.", timeout: 5000 });
    }
  };

  const handleRenameAgent = async (agentId: string, newName: string) => {
    try {
      await invoke('update_agent_name', { agentId, newName });
      setAgents(currentAgents =>
        currentAgents.map(agent =>
          agent.agent_id === agentId
            ? { ...agent, agent_name: newName }
            : agent
        )
      );
    } catch (error) {
      setError({
        primaryMessage: "Failed to rename agent. Please try again.",
        timeout: 5000,
        type: 'warning'
      });
    }
  };

  return (
    <>
      {error &&
        <div className="alertComponentWrapper">
          <Alert primaryMessage={error.primaryMessage} secondaryMessage={error.secondaryMessage} type={error.type} />
        </div>
      }
      <SidebarProvider>
        <RightSidebarProvider>
          <div className="flex h-screen w-screen">
            <LeftSideBar
              agents={agents}
              onNewAgentClick={() => { setNewAgentPopup(true) }}
              selectedAgentId={selectedAgentId}
              onAgentSelect={setSelectedAgentId}
              onDeleteAgent={handleDeleteAgent}
              onRenameAgent={handleRenameAgent}
            />
            <AgentSection user={user} currentAgent={currentAgent} setEditSystemPromptPopup={setEditSystemPromptPopup} />
          </div>
          {newAgentPopup && <RenderCard handleCreateAssistant={handleCreateAssistant} setNewAgentPopup={setNewAgentPopup} />}
          {(editSystemPromptPopup && currentAgent) && <EditSystemPromptPopup setEditSystemPromptPopup={setEditSystemPromptPopup} agent={currentAgent} setAgents={setAgents} />}
        </RightSidebarProvider>
      </SidebarProvider>
    </>

  )
}
