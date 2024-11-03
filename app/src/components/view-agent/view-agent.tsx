import { RightSidebarTrigger } from "../right-sidebar";
import { SidebarTrigger } from "../ui/sidebar";
import { VncViewer } from "./VncViewer";


export type promptRunningType = "true" | "false" | "loading";

export default function VieweAgent({ selectedAgentId, showControls }: { selectedAgentId: string | null, showControls: boolean }) {
    return (
        <main className="flex-grow flex flex-col relative h-screen p-4">
            <SidebarTrigger />
            <h3 className="w-full text-center text-4xl font-bold font-mono text-slate-900 my-8">
                Your Agent
            </h3>
            {selectedAgentId ? (
                <VncViewer agentId={selectedAgentId} showControls={showControls} />
            ) : (
                <div className="flex justify-center items-center w-full h-full">
                    <p className='text-slate-900'>Select an agent to view their environment</p>
                </div>
            )}
            <RightSidebarTrigger />
        </main>
    )
}
