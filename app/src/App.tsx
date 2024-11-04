import { useEffect, useState } from "react";
import { core } from '@tauri-apps/api';
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar, RightSidebarProvider } from "@/components/right-sidebar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import VieweAgent from "./components/view-agent/view-agent";

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

export default function App() {
  const [step, setStep] = useState<number | null>(null);
  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  // WebSocket
  const [ws, setWs] = useState<WebSocket | null>(null);

  function sendMessage(message: string) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(message);
    else console.warn('WebSocket is not connected');
  }

  useEffect(() => {
    let localWS: WebSocket | null = null;
    let reconnectAttempt = 0;
    const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
    const baseDelay = 1000; // Start with 1 second delay

    const connect = () => {
      localWS = new WebSocket('ws://localhost:3030/ws');
      setWs(localWS);

      localWS.addEventListener('open', (event) => {
        console.log('WebSocket connection opened:', event);
        reconnectAttempt = 0; // Reset attempt counter on successful connection
        const message = { "message-type": "init", "type": "client" };
        localWS?.send(JSON.stringify(message));
      });

      localWS.addEventListener('message', (event) => {
        console.log('Message received from server:', event.data);
      });

      localWS.addEventListener('close', (event) => {
        console.log('WebSocket connection closed:', event);

        // Calculate exponential backoff with jitter
        const delay = Math.min(
          Math.floor(baseDelay * Math.pow(2, reconnectAttempt) * (0.5 + Math.random())),
          maxReconnectDelay
        );

        console.log(`Attempting to reconnect in ${delay}ms...`);
        setTimeout(() => {
          reconnectAttempt++;
          connect();
        }, delay);
      });

      localWS.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });
    };

    connect();

    // Cleanup function
    return () => {
      if (localWS) {
        localWS.close();
        setWs(null);
      }
    };
  }, []);


  async function loadUser() {
    try {
      const user = await core.invoke<User>('get_user_data');
      setUser(user);
    } catch (error) {
      console.error('Failed to get user:', error);
    }
  }

  async function loadExistingAgents() {
    try {
      const containers = await core.invoke<DockerContainer[]>('get_all_containers');
      setAgents(containers);
      if (containers.length > 0) {
        setSelectedAgentId(containers[0].agent_id);
        return;
      }
      setSelectedAgentId(null);
      setStep(0);
    } catch (error) {
      console.error('Failed to load existing agents:', error);
    }
  }

  useEffect(() => {
    loadUser();
    loadExistingAgents();
  }, []);

  const handleCreateAssistant = async () => {
    setStep(null);
    const existingAgents = agents.filter(agent => agent.agent_type === selectedAssistant);
    const newAgentNumber = existingAgents.length + 1;
    const newAgent: BuildingContainer = { agent_type: selectedAssistant as 'jim' | 'pam', message_ids: [], agent_id: `${selectedAssistant}-${newAgentNumber}`, number: newAgentNumber, loading: true, error: null };
    setAgents([...agents, newAgent]);
    setSelectedAgentId(newAgent.agent_id);
    try {
      console.log('Creating container');
      const containerInfo = await core.invoke<DockerContainer>('create_agent_container', {
        agentId: newAgent.agent_id,
        agentType: selectedAssistant as 'jim' | 'pam',
        number: newAgent.number,
        messageIds: newAgent.message_ids
      });
      console.log('Container info:', containerInfo);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setAgents((currentAgents) => {
        return currentAgents.map(agent => agent.agent_id === newAgent.agent_id ? { ...containerInfo } : agent);
      });
    } catch {
      console.log('Failed to create container');
      setAgents((agents).map(agent => agent.agent_id === newAgent.agent_id ? { ...newAgent, error: 'Failed to create container', loading: false } : agent));
    }
  };

  const handleNewAgentClick = () => {
    setStep(0);
    setSelectedAssistant(null);
  };

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const renderCard = () => {
    if (step === null) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[400px] relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10"
            onClick={() => setStep(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          {step === 0 ? (
            <>
              <CardHeader>
                <CardTitle>Create a New AI Assistant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Choose an AI assistant type:</p>
                <RadioGroup onValueChange={(value) => setSelectedAssistant(value as 'jim' | 'pam')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="jim" id="jim" />
                    <label htmlFor="jim">J.I.M (Jobs and Internships Matchmaker)</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pam" id="pam" />
                    <label htmlFor="pam">P.A.M (Performs Anything Machine)</label>
                  </div>
                </RadioGroup>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={() => setStep(1)} disabled={!selectedAssistant}>Next</Button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{selectedAssistant === 'jim' ? 'Upload Resume' : 'Task Description'}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedAssistant === 'jim' ? (
                  <Button onClick={() => console.log('Open file picker')}>Upload Resume</Button>
                ) : (
                  <Textarea placeholder="Enter your task description here..." />
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={handleCreateAssistant}>Create Assistant</Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    );
  };

  const renderMainContent = () => (
    <div className="flex h-screen w-screen">
      <AppSidebar
        agents={agents}
        onNewAgentClick={handleNewAgentClick}
        selectedAgentId={selectedAgentId}
        onAgentSelect={handleAgentSelect}
        user={user}
        setUser={setUser}
      />
      <VieweAgent showControls={user ? user.show_controls : false} sendMessage={sendMessage} agent={agents.find(agent => agent.agent_id === selectedAgentId) || undefined} />
      <RightSidebar />
    </div>
  );

  return (
    <SidebarProvider>
      <RightSidebarProvider>
        {renderMainContent()}
        {renderCard()}
      </RightSidebarProvider>
    </SidebarProvider>
  )
}
