import * as React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

function App() {
  const [step, setStep] = React.useState(0);
  const [selectedAssistant, setSelectedAssistant] = React.useState<string | null>(null);

  const handleAssistantSelect = (value: string) => {
    setSelectedAssistant(value);
  };

  const handleNext = () => {
    setStep(1);
  };

  const handleCreateAssistant = () => {
    setStep(2);
  };

  return (
    <SidebarProvider>
      {step === 0 && (
        <Card className="w-[400px] mx-auto mt-20">
          <CardHeader>
            <CardTitle>Welcome to Radah - The AI app</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Here, you can create and manage AI assistants. We offer the following assistants</p>
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
            <div className="flex items-center space-x-2">
              <p className="mb-4">Pick an assistant to get started</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleNext} disabled={!selectedAssistant}>Next</Button>
          </CardFooter>
        </Card>
      )}

      {step === 1 && (
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
      )}

      {step === 2 && (
        <>
          <AppSidebar />
          <main>
            <SidebarTrigger />
          </main>
        </>
      )}
    </SidebarProvider>
  )
}

export default App;
