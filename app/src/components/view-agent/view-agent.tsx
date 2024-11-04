import { Agent } from "@/App";
import { RightSidebarTrigger } from "../right-sidebar";
import { SidebarTrigger } from "../ui/sidebar";
import { VncViewer } from "./VncViewer";
import { useEffect } from "react";
import { useState } from "react";
import { core } from "@tauri-apps/api";


export type promptRunningType = "true" | "false" | "loading";


interface VieweAgentProps {
    showControls: boolean;
    sendMessage: (message: string) => void;
    agent: Agent | undefined;
}


export default function VieweAgent({ showControls, sendMessage, agent }: VieweAgentProps) {
    const agentId = agent?.agent_id;
    const [messages, setMessages] = useState<string[]>([]);
    useEffect(() => {
        const loadMessages = async () => {
            if (!agentId) return;
            const messages = await core.invoke<string[]>('get_agent_messages', { agentId });
            setMessages(messages);
        };
        loadMessages();
    }, [agentId]);
    return (
        <main className="flex-grow flex flex-col relative h-screen p-4">
            <SidebarTrigger />
            <h3 className="w-full text-center text-4xl font-bold font-mono text-slate-900 my-8">
                Your Agent
            </h3>
            {agent ? (
                <VncViewer showControls={showControls} sendMessage={sendMessage} agent={agent} />
            ) : (
                <div className="flex justify-center items-center w-full h-full">
                    <p className='text-slate-900'>Select an agent to view their environment</p>
                </div>
            )}
            <RightSidebarTrigger />
        </main>
    )
}
