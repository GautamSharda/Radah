import { Message } from "@/App";


const bubbleStyle = "px-4 py-2 rounded-3xl";

export function MessageBubble({ message }: { message: Message }) {
    if (message['agent-output']) {
        const agentOutput = message['agent-output'];
        if (agentOutput.text) {
            return (
                <div>
                    <p>{agentOutput.text}</p>
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

    return (
        <div>
            <p>{JSON.stringify(message)}</p>
        </div>
    )
}