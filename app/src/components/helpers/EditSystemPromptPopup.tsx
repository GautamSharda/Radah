import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { Agent } from "@/App"
import { Textarea } from "../ui/textarea"
import { useError } from "@/hooks/ErrorContext"
import { invoke } from "@/lib/platform"

interface EditSystemPromptPopup {
    setEditSystemPromptPopup: (value: boolean) => void;
    agent: Agent;
    setAgents: (agents: Agent[]) => void;
}

export default function EditSystemPromptPopup({ setEditSystemPromptPopup, agent, setAgents }: EditSystemPromptPopup) {
    const { setError } = useError();
    const [saving, setSaving] = useState<boolean>(false);
    const [systemPrompt, setSystemPrompt] = useState<string>(agent.system_prompt);

    useEffect(() => {
        setSystemPrompt(agent.system_prompt);
    }, [agent.agent_id, agent.system_prompt])

    async function handleSave() {
        var error = false;
        setSaving(true);
        try {
            await invoke('update_agent_system_prompt', {
                agentId: agent.agent_id,
                systemPrompt: systemPrompt
            });
        } catch (err) {
            console.log(err);
            //@ts-ignore
            setError({
                primaryMessage: 'Failed to update system prompt',
                secondaryMessage: err instanceof Error ? err.message : String(err),
                timeout: 5000
            });
            error = true;
        }
        setSaving(false);
        if (!error) {
            setError({ primaryMessage: 'System prompt updated', type: 'success', timeout: 5000 });
            setEditSystemPromptPopup(false);
            //@ts-ignore
            setAgents(agents => agents.map(a => a.agent_id === agent.agent_id ? { ...a, system_prompt: systemPrompt } : a))
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-[500px] relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 z-10"
                    onClick={() => setEditSystemPromptPopup(false)}
                >
                    <X className="h-4 w-4" />
                </Button>

                <CardHeader>
                    <CardTitle>{'Edit System Prompt'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea placeholder="Your are a helpful assistant..." className="h-36 resize-none" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </CardFooter>
            </Card>
        </div>
    );
};
