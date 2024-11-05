import { useEffect, useState } from "react";
import { RightSidebar } from "./RightSidebar";
import ViewAgent from "./view-agent/view-agent";
import type { Agent, User, Message } from "@/App";
import { core } from "@tauri-apps/api";


interface AgentProps {
    user?: User;
    currentAgent: Agent | undefined;
}

export default function AgentSection({ user, currentAgent }: AgentProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [agent, setAgent] = useState<Agent | undefined>(currentAgent);
    const [ws, setWs] = useState<WebSocket | null>(null);

    useEffect(() => {
        setAgent(currentAgent);
    }, [currentAgent]);


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
            console.log('Connecting to WebSocket');
            localWS.addEventListener('open', () => {
                console.log('WebSocket connected');
                reconnectAttempt = 0; // Reset attempt counter on successful connection
                const message = { "message-type": "init", "connection-type": "client" };
                localWS?.send(JSON.stringify(message));
            });

            localWS.addEventListener('message', (event) => {
                console.log('Message received from server:');
                const message = JSON.parse(event.data);
                setMessages(prevMessages => [...prevMessages, message]);
            });

            localWS.addEventListener('close', () => {
                console.log('WebSocket closed');
                // Calculate exponential backoff with jitter
                setTimeout(() => {
                    reconnectAttempt++;
                    connect();
                }, Math.min(Math.floor(baseDelay * Math.pow(2, reconnectAttempt) * (0.5 + Math.random())), maxReconnectDelay));
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

    const agentId = currentAgent?.agent_id;
    useEffect(() => {
        const loadMessages = async () => {
            if (!agentId) return;
            const messages = await core.invoke<Message[]>('get_agent_messages', { agentId });
            setMessages(messages);
        };
        loadMessages();
    }, [agentId]);
    console.log('Agent Section Messages:', messages);
    return (
        <>
            <ViewAgent showControls={user ? user.show_controls : false} sendMessage={sendMessage} agent={currentAgent} />
            <RightSidebar messages={messages} agentId={agentId} />
        </>
    )
}
