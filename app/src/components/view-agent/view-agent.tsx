import { Agent } from "@/App";
import { RightSidebarTrigger } from "../RightSidebar";
import { SidebarTrigger } from "../ui/sidebar";
import { VncViewer } from "./VncViewer";


interface ViewAgentProps {
    showControls: boolean;
    agent: Agent | undefined;
}


export default function ViewAgent({ showControls, agent }: ViewAgentProps) {
    return (
        <main className="flex-grow flex flex-col relative h-screen p-4">
            <SidebarTrigger />
            <h3 className="w-full text-center text-4xl font-bold text-slate-900 my-8">
                Your Agent
            </h3>
            {agent ? (
                <VncViewer showControls={showControls} agent={agent} />
            ) : (
                <div className="flex justify-center items-center w-full h-full">
                    <p className='text-slate-900'>Select an agent to view their environment</p>
                </div>
            )}
            <RightSidebarTrigger />
        </main>
    )
}
