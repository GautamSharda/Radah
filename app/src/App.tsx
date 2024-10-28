import * as React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar, RightSidebarProvider, RightSidebarTrigger } from "@/components/right-sidebar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface Agent {
  type: 'jim' | 'pam';
  number: number;
}

function App() {
  const [step, setStep] = React.useState(0);
  const [selectedAssistant, setSelectedAssistant] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [isCreatingNewAgent, setIsCreatingNewAgent] = React.useState(false);
  // Add new state for selected agent
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);

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
      // Select the newly created agent
      setSelectedAgentId(`${newAgent.type}-${newAgent.number}`);
    }
    setStep(2);
    setIsCreatingNewAgent(false);
  };

  const handleNewAgentClick = () => {
    setIsCreatingNewAgent(true);
    setStep(0);
    setSelectedAssistant(null);
  };

  // Add handler for agent selection
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const renderCard = () => {
    switch (step) {
      case 0:
        return (
          <Card className="w-[400px] mx-auto mt-20">
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
            <CardFooter>
              <Button onClick={handleNext} disabled={!selectedAssistant}>Next</Button>
            </CardFooter>
          </Card>
        );
      case 1:
        return (
          <Card className="w-[400px] mx-auto mt-20">
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
            <CardFooter>
              <Button onClick={handleCreateAssistant}>Create Assistant</Button>
            </CardFooter>
          </Card>
        );
      default:
        return null;
    }
  };

  const renderMainContent = () => (
    <div className="flex">
      <AppSidebar 
        agents={agents} 
        onNewAgentClick={handleNewAgentClick}
        selectedAgentId={selectedAgentId}
        onAgentSelect={handleAgentSelect}
      />
      <main className="flex-grow flex justify-between">
        <SidebarTrigger />
        {/* Main content goes here */}
        <RightSidebarTrigger />
      </main>
      <RightSidebar />
    </div>
  );

  return (
    <SidebarProvider>
      <RightSidebarProvider>
        {step < 2 && renderCard()}
        {step === 2 && !isCreatingNewAgent && renderMainContent()}
      </RightSidebarProvider>
    </SidebarProvider>
  )
}

export default App;
