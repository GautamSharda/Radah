import { useEffect, useState } from "react";
import { ArrowUpIcon, SquareIcon } from "@radix-ui/react-icons";
import { promptRunningType } from "../AgentSection";
import Spinner from "../ui/spinner";

interface MessageInputInterface {
    sendMessage: (message: string) => void;
    promptRunning: promptRunningType;
    currentAgentID: string | undefined;
    stopAgent: () => void;
    isWebSocketOpen: boolean;
}


export function MessageInput({ sendMessage, promptRunning, currentAgentID, stopAgent, isWebSocketOpen }: MessageInputInterface) {
    const [prompt, setPrompt] = useState<string>("");
    const sendMessageWrapper = () => {
        sendMessage(prompt);
        setPrompt("");
    }

    useEffect(() => {
        setPrompt("");
    }, [currentAgentID])

    return (
        <div className="w-full flex flex-col items-start justify-start bg-slate-200 rounded-xl p-4">
            <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value) }}
                placeholder="Message Radah"
                className='w-full text-md bg-transparent outline-none'
                style={{
                    minHeight: '38px',
                    maxHeight: '200px',
                    height: 'auto',
                    overflow: 'auto',
                    resize: 'none'
                }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && promptRunning === "stopped" && isWebSocketOpen) {
                        e.preventDefault(); // Prevents creating a new line
                        sendMessageWrapper();
                    }
                }}
            />
            <div className="flex flex-row items-center justify-end w-full">
                {promptRunning === "stopped" && isWebSocketOpen &&
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-pointer hover:bg-slate-700" onClick={sendMessageWrapper}>
                        <ArrowUpIcon className="h-5 w-5 stroke-[1.5] text-white" />
                    </div>
                }
                {promptRunning === "running" && isWebSocketOpen &&
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-pointer hover:bg-slate-700" onClick={stopAgent}>
                        <SquareIcon className="h-3 w-3 stroke-[1.5] text-white bg-white" />
                    </div>
                }
                {(promptRunning === "loading" || !isWebSocketOpen) &&
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-not-allowed">
                        <Spinner size="small" className="border-slate-800" />
                    </div>
                }
            </div>
        </div>
    )
}