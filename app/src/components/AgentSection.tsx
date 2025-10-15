import { useEffect, useState } from "react";
import { RightSidebar } from "./RightSidebar";
import ViewAgent from "./view-agent/ViewAgent";
import type { Agent, User, Message } from "@/App";
import { useError } from "@/hooks/ErrorContext";
import {
    invoke,
    isWebPlatform,
    getWebSocketUrl,
    recordWebMessage,
    setWebPromptStatus,
    createWebAgentReply,
    nextWebMessageId
} from "@/lib/platform";


interface AgentProps {
    user?: User;
    currentAgent: Agent | undefined;
    setEditSystemPromptPopup: (value: boolean) => void;
}

export type promptRunningType = "running" | "stopped" | "loading" | "na";

export default function AgentSection({ user, currentAgent, setEditSystemPromptPopup }: AgentProps) {
    const { setError } = useError();
    const [messages, setMessages] = useState<Message[]>([]);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isWebSocketOpen, setIsWebSocketOpen] = useState<boolean>(false);
    const [promptRunning, setPromptRunning] = useState<promptRunningType>("na");
    const [switchingAgent, setSwitchingAgent] = useState<boolean>(true);
    const agentId = currentAgent?.agent_id;
    //@ts-ignore
    const container_id = currentAgent?.id;
    useEffect(() => {
        const loadAgent = async () => {
            try {
                //@ts-ignore
                if (!agentId || !container_id) return;
                //@ts-ignore
                await invoke('start_container', { containerId: container_id });
                if (!isWebPlatform) await new Promise(resolve => setTimeout(resolve, 2000));
                const messages = await invoke<Message[]>('get_agent_messages', { agentId });
                setMessages(messages);
                const promptRunning = await invoke<string>('get_prompt_running', { agentId });
                setPromptRunning(promptRunning as promptRunningType);
                setSwitchingAgent(false);
            } catch (error) {
                setError({ primaryMessage: "Oops! We had an issue loading your agent. Refresh and try again.", timeout: 5000 });
            }
        };
        loadAgent();
        setPromptRunning("na");
        setSwitchingAgent(true);
    }, [agentId, container_id]);

    function sendMessage(message: string) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(message);
        else console.warn('WebSocket is not connected');
    }

    useEffect(() => {
        if (!agentId) return;
        if (isWebPlatform) {
            setIsWebSocketOpen(true);
            return;
        }

        let localWS: WebSocket | null = null;
        let reconnectAttempt = 0;
        let closing = false;
        const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
        const baseDelay = 1000; // Start with 1 second delay

        const connect = () => {
            const socketUrl = getWebSocketUrl();
            if (!socketUrl) return;
            localWS = new WebSocket(socketUrl);
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
        if (!agentId) return;

        if (isWebPlatform) {
            setPromptRunning("stopped");
            setWebPromptStatus(agentId, "stopped");
            return;
        }

        setPromptRunning("loading");
        ws?.send(JSON.stringify({ "message-type": "stop", "agent_id": agentId, "show_ui": false }));
    }

    const sendMessageWrapper = (prompt: string, files: { name: string; data: string }[] | undefined) => {
        if (!agentId) return;
        const message = { "message-type": "prompt", "text": prompt, "agent_id": agentId, "show_ui": true } as Message;
        //@ts-ignore
        if (files) message['files'] = files;

        if (isWebPlatform) {
            const promptMessage: Message = {
                ...message,
                message_id: nextWebMessageId(),
                show_ui: true,
            };
            setMessages(prev => [...prev, promptMessage]);
            recordWebMessage(agentId, promptMessage);
            setPromptRunning("running");
            setWebPromptStatus(agentId, "running");

            setTimeout(() => {
                const reply = createWebAgentReply(agentId);
                setMessages(prev => [...prev, reply]);
                recordWebMessage(agentId, reply);
                setPromptRunning("stopped");
                setWebPromptStatus(agentId, "stopped");
            }, 750);
            return;
        }

        setPromptRunning("running");
        sendMessage(JSON.stringify(message));
    }

    return (
        <>
            <ViewAgent showControls={user ? user.show_controls : false} agent={currentAgent} switchingAgent={switchingAgent} />
            <RightSidebar
                messages={messages}
                agentId={agentId}
                sendMessage={sendMessageWrapper}
                promptRunning={promptRunning}
                stopAgent={stopAgent}
                isWebSocketOpen={isWebSocketOpen}
                setEditSystemPromptPopup={setEditSystemPromptPopup}
            />
        </>
    )
}
