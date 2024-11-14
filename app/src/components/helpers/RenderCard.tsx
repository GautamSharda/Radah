import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { useState } from "react"
import { Input } from "../ui/input"

interface RenderCardProps {
    setNewAgentPopup: (newAgentPopup: boolean) => void;
    handleCreateAssistant: (agentName: string) => void;
}

export default function RenderCard({ setNewAgentPopup, handleCreateAssistant }: RenderCardProps) {
    const [name, setName] = useState<string>('');
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-[400px] relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 z-10"
                    onClick={() => setNewAgentPopup(false)}
                >
                    <X className="h-4 w-4" />
                </Button>

                <CardHeader>
                    <CardTitle>{'Create a new Agent'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
                        <Button onClick={() => handleCreateAssistant(name)}>yup</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};