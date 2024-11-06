import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ArrowUpIcon, ReloadIcon } from "@radix-ui/react-icons";
import { promptRunningType } from "./view-agent";

interface MessageInputInterface {
    sendMessage: (message: string) => void;
    promptRunning: promptRunningType;
    currentAgentID: string | undefined;
    stopAgent: () => void;
}


export function MessageInput({ sendMessage, promptRunning, currentAgentID, stopAgent }: MessageInputInterface) {
    const [prompt, setPrompt] = useState<string>("");
    const sendMessageWrapper = () => {
        const message = { "message-type": "prompt", "text": prompt, "agent_id": currentAgentID, "show_ui": true };
        console.log(message);
        sendMessage(JSON.stringify(message));
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
            />
            <div className="flex flex-row items-center justify-end w-full">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-pointer hover:bg-slate-700">
                    {promptRunning === "false" && <ArrowUpIcon className="h-5 w-5 stroke-[1.5] text-white" />}
                </div>
                {/* {promptRunning === "false" && <ArrowUpIcon className="mr-2 h-4 w-4 bg-red-400" width={100} height={100} />} */}
                {/* {promptRunning === "true" && <Button type="submit" className='ml-3 font-mono w-24 bg-red-400 text-white h-12' onClick={stopAgent}>Stop</Button>}
                {promptRunning === "loading" &&
                    <Button disabled type="submit" className='ml-3 font-mono h-12 text-lg hover:cursor-not-allowed'>
                        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling
                    </Button>
                } */}
            </div>
        </div>
        // <div className='flex flex-row items-start justify-start w-full'>
        //     <Input type="text" value={prompt} onChange={(e) => { setPrompt(e.target.value) }} placeholder="Prompt" className='w-ful text-md h-12 ' />
        //     {promptRunning === "false" && <Button variant='secondary' className='ml-3 font-mono w-24 h-12 text-lg' onClick={sendMessageWrapper}>Submit</Button>}
        //     {promptRunning === "true" && <Button type="submit" className='ml-3 font-mono w-24 bg-red-400 text-white h-12' onClick={stopAgent}>Stop</Button>}
        //     {promptRunning === "loading" &&
        //         <Button disabled type="submit" className='ml-3 font-mono h-12 text-lg hover:cursor-not-allowed'>
        //             <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
        //             Cancelling
        //         </Button>
        //     }
        // </div>
    )
}