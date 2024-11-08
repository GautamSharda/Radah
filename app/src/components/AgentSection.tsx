import { useEffect, useState } from "react";
import { RightSidebar } from "./RightSidebar";
import ViewAgent from "./view-agent/ViewAgent";
import type { Agent, User, Message } from "@/App";
import { core } from "@tauri-apps/api";
import { useError } from "@/hooks/ErrorContext";


interface AgentProps {
    user?: User;
    currentAgent: Agent | undefined;
}

export type promptRunningType = "running" | "stopped" | "loading" | "na";

export default function AgentSection({ user, currentAgent }: AgentProps) {
    const { setError } = useError();
    const [messages, setMessages] = useState<Message[]>([]);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isWebSocketOpen, setIsWebSocketOpen] = useState<boolean>(false);
    const [promptRunning, setPromptRunning] = useState<promptRunningType>("na");
    const [switchingAgent, setSwitchingAgent] = useState<boolean>(true);
    const agentId = currentAgent?.agent_id;
    useEffect(() => {
        const loadAgent = async () => {
            try {
                //@ts-ignore
                if (!agentId || !currentAgent?.id) return;
                //@ts-ignore
                await core.invoke('start_container', { containerId: currentAgent?.id });
                const messages = await core.invoke<Message[]>('get_agent_messages', { agentId });
                setMessages(messages);
                const promptRunning = await core.invoke<string>('get_prompt_running', { agentId });
                setPromptRunning(promptRunning as promptRunningType);
                setSwitchingAgent(false);
            } catch (error) {
                setError({ primaryMessage: "Oops! We had an issue loading your agent. Refresh and try again.", timeout: 5000 });
            }
        };
        loadAgent();
        setPromptRunning("na");
        setSwitchingAgent(true);
    }, [currentAgent]);

    function sendMessage(message: string) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(message);
        else console.warn('WebSocket is not connected');
    }

    useEffect(() => {
        if (!agentId) return;
        let localWS: WebSocket | null = null;
        let reconnectAttempt = 0;
        let closing = false;
        const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
        const baseDelay = 1000; // Start with 1 second delay

        const connect = () => {
            localWS = new WebSocket('ws://localhost:3030/ws');
            setWs(localWS);
            localWS.addEventListener('open', () => {
                setIsWebSocketOpen(true);
                reconnectAttempt = 0; // Reset attempt counter on successful connection
                const message = { "message-type": "init", "connection-type": "client" };
                localWS?.send(JSON.stringify(message));
            });

            localWS.addEventListener('message', (event) => {
                const message = JSON.parse(event.data);
                //TODO: Fix this (it is needed to manage multiple agents)
                if (message.agent_id && message.agent_id !== agentId) return;
                if (message.prompt_running) {
                    setPromptRunning(message.prompt_running as promptRunningType);
                    if (message.prompt_running === "na") setError({ primaryMessage: "Oops! The connection to your agent was lost. We are trying to reconnect.", timeout: 2500, type: 'warning' });
                }
                setMessages(prevMessages => [...prevMessages, message]);
            });

            localWS.addEventListener('error', () => {
                setIsWebSocketOpen(false);
                setError({ primaryMessage: "Oops! The connection to your agent was lost. We are trying to reconnect.", timeout: 5000, type: 'warning' });
                setTimeout(() => {
                    if (closing) return;
                    reconnectAttempt++;
                    connect();
                }, Math.min(Math.floor(baseDelay * Math.pow(2, reconnectAttempt) * (0.5 + Math.random())), maxReconnectDelay));
            });
        };
        connect();

        // Cleanup function
        return () => {
            if (localWS) {
                closing = true;
                localWS.close();
                setWs(null);
            }
        };
    }, [agentId]);

    function stopAgent() {
        setPromptRunning("loading");
        ws?.send(JSON.stringify({ "message-type": "stop", "agent_id": agentId, "show_ui": false }));
    }

    const sendMessageWrapper = (prompt: string) => {
        if (!agentId) return;
        const message = { "message-type": "prompt", "text": prompt, "agent_id": agentId, "show_ui": true };
        setPromptRunning("running");
        sendMessage(JSON.stringify(message));
    }

    return (
        <>
            <ViewAgent showControls={user ? user.show_controls : false} agent={currentAgent} switchingAgent={switchingAgent} />
            <RightSidebar messages={messages} agentId={agentId} sendMessage={sendMessageWrapper} promptRunning={promptRunning} stopAgent={stopAgent} isWebSocketOpen={isWebSocketOpen} />
        </>
    )
}
