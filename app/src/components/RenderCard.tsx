import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface RenderCardProps {
    step: number;
    setStep: (step: number | null) => void;
    selectedAssistant: string | null;
    setSelectedAssistant: (selectedAssistant: string | null) => void;
    handleCreateAssistant: () => void;
}

export default function RenderCard({ step, setStep, selectedAssistant, setSelectedAssistant, handleCreateAssistant }: RenderCardProps) {
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