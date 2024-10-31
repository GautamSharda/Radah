import * as React from "react";
import { useEffect, useState } from "react";
import { core } from '@tauri-apps/api';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar, RightSidebarProvider, RightSidebarTrigger } from "@/components/right-sidebar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import VieweAgent from "./components/view-agent/view-agent";

interface Agent {
  type: 'jim' | 'pam';
  number: number;
}

export default function App() {
  const [step, setStep] = React.useState<number | null>(0);
  const [selectedAssistant, setSelectedAssistant] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [isCreatingNewAgent, setIsCreatingNewAgent] = React.useState(false);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);

  useEffect(() => {
    // Load existing containers when app starts
    async function loadExistingAgents() {
      try {
        const containers = await core.invoke('get_all_containers');
        const loadedAgents = containers.map(container => {
          const [type, numberStr] = container.agent_id.split('-');
          return {
            type: type as 'jim' | 'pam',
            number: parseInt(numberStr)
          };
        });
        setAgents(loadedAgents);
      } catch (error) {
        console.error('Failed to load existing agents:', error);
      }
    }

    loadExistingAgents();
  }, []);

  const handleAssistantSelect = (value: string) => {
    setSelectedAssistant(value);
  };

  const handleNext = () => {
    setStep(1);
  };

  const handleCreateAssistant = () => {
    if (selectedAssistant) {
      const existingAgents = agents.filter(agent => agent.type === selectedAssistant);
      const newAgentNumber = existingAgents.length + 1;
      const newAgent = { type: selectedAssistant as 'jim' | 'pam', number: newAgentNumber };
      setAgents([...agents, newAgent]);
      setSelectedAgentId(`${newAgent.type}-${newAgent.number}`);
    }
    setStep(null);
    setIsCreatingNewAgent(false);
  };

  const handleNewAgentClick = () => {
    setIsCreatingNewAgent(true);
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
                <RadioGroup onValueChange={handleAssistantSelect}>
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
                <Button onClick={handleNext} disabled={!selectedAssistant}>Next</Button>
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
      />
      <VieweAgent selectedAgentId={selectedAgentId} />
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
