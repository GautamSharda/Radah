import { useEffect, useState } from "react";
import { core } from '@tauri-apps/api';
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebarProvider } from "@/components/RightSidebar"
import RenderCard from "./components/RenderCard";
import AgentSection from "./components/AgentSection";
import { useError } from "./hooks/ErrorContext";
import Alert from "./components/helpers/Alert";

export interface User {
  show_controls: boolean;
}

//This
export interface BaseContainer {
  number: number;
  agent_type: 'jim' | 'pam';
  message_ids: string[];
  agent_id: string;
}

export interface DockerContainer extends BaseContainer {
  id: string;
  vnc_port: number;
}

export interface BuildingContainer extends BaseContainer {
  loading: boolean;
  error: string | null;
}

export type Agent = DockerContainer | BuildingContainer;

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
  const [step, setStep] = useState<number | null>(null);
  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // WebSocket
  const currentAgent = selectedAgentId ? agents.find(agent => agent.agent_id === selectedAgentId) || undefined : undefined;


  useEffect(() => {
    loadUser();
    loadExistingAgents();
  }, []);

  async function loadUser() {
    try {
      const user = await core.invoke<User>('get_user_data');
      // await core.invoke<User>('clear_all_storage')
      // await core.invoke<User>('print_all_storage');
      // await core.invoke<User>('clear_all_messages');
      // await core.invoke<User>('print_all_storage');
      setUser(user);
    } catch (error) {
      setError({ primaryMessage: "We had an issue loading your settings", timeout: 2500, type: 'warning' });
    }
  }

  async function loadExistingAgents() {
    try {
      const containers = await core.invoke<DockerContainer[]>('get_all_containers');
      setAgents(containers);
      if (containers.length > 0) return setSelectedAgentId(containers[0].agent_id);
      setSelectedAgentId(null);
      setStep(0);
    } catch (error) {
      setError({ primaryMessage: "Oops! We had an issue getting your agents. Refresh and try again.", timeout: 5000 });
    }
  }

  const handleCreateAssistant = async () => {
    setStep(null);
    const existingAgents = agents.filter(agent => agent.agent_type === selectedAssistant);
    const newAgentNumber = existingAgents.length + 1;
    const newAgent: BuildingContainer = { agent_type: selectedAssistant as 'jim' | 'pam', message_ids: [], agent_id: `${selectedAssistant}-${newAgentNumber}`, number: newAgentNumber, loading: true, error: null };
    setAgents([...agents, newAgent]);
    setSelectedAgentId(newAgent.agent_id);
    try {
      const containerInfo = await core.invoke<DockerContainer>('create_agent_container', {
        agentId: newAgent.agent_id,
        agentType: selectedAssistant as 'jim' | 'pam',
        number: newAgent.number,
        messageIds: newAgent.message_ids
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      setAgents((currentAgents) => {
        return currentAgents.map(agent => agent.agent_id === newAgent.agent_id ? { ...containerInfo } : agent);
      });
    } catch {
      setAgents((agents).map(agent => agent.agent_id === newAgent.agent_id ? { ...newAgent, error: 'Failed to create container', loading: false } : agent));
      setError({ primaryMessage: "Oops! We had an issue creating your agent. Try creating one again or reach out to support.", timeout: 7500 });
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
            <AppSidebar
              agents={agents}
              onNewAgentClick={() => {
                setStep(0);
                setSelectedAssistant(null);
              }}
              selectedAgentId={selectedAgentId}
              onAgentSelect={setSelectedAgentId}
              user={user}
              setUser={setUser}
            />
            <AgentSection user={user} currentAgent={currentAgent} />
          </div>
          {step !== null && <RenderCard step={step} setStep={setStep} selectedAssistant={selectedAssistant} setSelectedAssistant={setSelectedAssistant} handleCreateAssistant={handleCreateAssistant} />}
        </RightSidebarProvider>
      </SidebarProvider>
    </>

  )
}
