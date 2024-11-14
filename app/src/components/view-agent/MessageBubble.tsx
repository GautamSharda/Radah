import { Message } from "@/App";
import clsx from "clsx";
import { CodeBlock, dracula, googlecode } from "react-code-blocks";


const bubbleStyle = "px-4 py-2 rounded-3xl";
const defaultCodeStyles = 'text-xs font-mono border border-primary rounded-sm w-full border-2'


function InputActionSwitch(action: string): string {
    switch (action) {
        case "mouse_move":
            return "Moving mouse"
        case "left_click":
            return "Left clicking"
        case "right_click":
            return "Right clicking"
        case "scroll_down":
            return "Scrolling down"
        case "scroll_up":
            return "Scrolling up"
        case "screenshot":
            return "Taking screenshot"
        case "type":
            return "Typing"
        default:
            return `Performing action: ${action}`
    }
}


export function MessageBubble({ message }: { message: Message }) {
    console.log(message);
    if (message['agent-output']) {
        const agentOutput = message['agent-output'];
        if (agentOutput.text) {
            return (
                <div>
                    <p>{agentOutput.text}</p>
                </div>
            )
        }
        if (agentOutput.input?.action) {
            return (
                <div>
                    <p className="italic">{InputActionSwitch(agentOutput.input.action)}</p>
                </div>
            )
        }
        if (agentOutput.input?.command) {
            return (
                <div className={clsx(defaultCodeStyles, 'flex flex-col items-start justify-start dark:hidden bg-white')}>
                    <p className='italic ml-2 mt-2'>{agentOutput.name}</p>
                    <CodeBlock
                        text={agentOutput.input.command}
                        language="bash"
                        showLineNumbers={false}
                        wrapLongLines={true}
                        theme={googlecode}
                    />
                </div>
            )
        }
        return (
            <div>
                <p>Agent Output: {JSON.stringify(agentOutput)}</p>
            </div>
        )
    }

    if (message['message-type'] === 'prompt') {
        return (
            <div className="w-full flex justify-end items-center">
                <div className={`${bubbleStyle} bg-slate-200 max-w-[80%]`}>
                    <p>{message.text}</p>
                </div>
            </div>
        )
    }

    if (message['text']) {
        return (
            <div>
                <p>{message.text}</p>
            </div>
        )
    }

    if (message['agent-message']) {
        try {
            const content = message['agent-message']['content'][0]['content'][0];
            if (content.type === 'image') {
                const base64Image = content['source']['data'];
                return (
                    <div className="rounded-xl">
                        <img src={`data:image/png;base64,${base64Image}`} alt="Agent Image" className="rounded-sm" />
                    </div>
                )
            }
        } catch (e) {
            return null;
        }
        return null;
        // return (
        //     <div>
        //         <p>{JSON.stringify(message['agent-message'])}</p>
        //     </div>
        // )
    }

    return (
        <div>
            <p>{JSON.stringify(message)}</p>
        </div>
    )
}