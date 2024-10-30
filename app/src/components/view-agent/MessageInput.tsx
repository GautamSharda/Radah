import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { promptRunningType } from "./view-agent";

interface MessageInputInterface {
    sendMessage: (message: Object) => void;
    promptRunning: promptRunningType;
    currentAgentID: string | undefined;
    stopAgent: () => void;
    agentConnection: boolean;
}


export function MessageInput({ sendMessage, promptRunning, currentAgentID, stopAgent, agentConnection }: MessageInputInterface) {
    const [prompt, setPrompt] = useState<string>("");
    const sendMessageWrapper = () => {
        sendMessage({ message: prompt });
        setPrompt("");
    }


    useEffect(() => {
        setPrompt("");
    }, [currentAgentID])

    if (!agentConnection) return <></>
    return (
        <div className='flex flex-row items-start justify-start mt-8 w-full'>
            <Input type="text" value={prompt} onChange={(e) => { setPrompt(e.target.value) }} placeholder="Prompt" className='w-ful text-md h-12 ' />
            {promptRunning === "false" && <Button variant='secondary' className='ml-3 font-mono w-24 h-12 text-lg' onClick={sendMessageWrapper}>Submit</Button>}
            {promptRunning === "true" && <Button type="submit" className='ml-3 font-mono w-24 bg-red-400 text-white h-12' onClick={stopAgent}>Stop</Button>}
            {promptRunning === "loading" &&
                <Button disabled type="submit" className='ml-3 font-mono h-12 text-lg hover:cursor-not-allowed'>
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling
                </Button>
            }
        </div>
    )
}