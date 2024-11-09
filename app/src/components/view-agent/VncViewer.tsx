import Spinner from "@/components/ui/spinner.tsx";
import { Agent, BuildingContainer, Container } from '@/App';
interface VncViewerProps {
  showControls: boolean;
  agent: Agent;
  switchingAgent: boolean;
}


// Add unique session parameters for each agent
const getVncUrl = (port: number, view_only: boolean, agentId: string) => {
  const params = new URLSearchParams({
    view_only: view_only ? '1' : '0',
    autoconnect: '1',
    resize: 'scale',
    reconnect: '1',
    reconnect_delay: '2000',
    session: agentId
  });
  return `http://localhost:${port}/vnc.html?${params.toString()}`;
};

export function VncViewer({ showControls, agent, switchingAgent }: VncViewerProps) {

  if ((agent as BuildingContainer).loading) {
    return (
      <div className='w-full aspect-w-16 aspect-h-9 border-2 rounded-lg flex justify-center items-center bg-slate-50 min-h-[250px]'>
        <div className="h-full flex justify-center items-center w-full px-4">
          <div className="flex flex-col gap-2">
            <p className="text-slate-900 font-bold mb-4">Building your virtual computer (this may take a few minutes) </p>
            <Spinner size="large" />
          </div>
        </div>
      </div>
    );
  }

  if ((agent as BuildingContainer).error) {
    return (
      <div className='w-full aspect-w-16 aspect-h-9 border-2 border-red-200 rounded-lg flex justify-center items-center bg-red-50 min-h-[250px]'>
        <div className="h-full flex justify-center items-center w-full px-4">
          <div className="flex flex-col gap-2">
            <p className="text-red-600 font-bold mb-4"> An error occurred while creating your virtual computer. <br /> We f*cked up. <br />  Sorry! </p>
          </div>
        </div>
      </div>
    );
  }

  if (switchingAgent) {
    return (
      <div className='w-full aspect-w-16 aspect-h-9 border-2 rounded-lg flex justify-center items-center bg-slate-50 min-h-[150px]'>
        <div className="h-full flex justify-center items-center w-full px-4">
          <div className="flex flex-col gap-2">
            <p className="text-slate-900 font-bold mb-4">Switching to new agent...</p>
            <Spinner size="medium" />
          </div>
        </div>
      </div>
    );
  }

  const vncUrl = getVncUrl((agent as Container).vnc_port, !showControls, agent.agent_id);

  return (
    <div className="w-full aspect-w-16 aspect-h-9">
      <iframe
        src={vncUrl}
      />
    </div>
  );
} 