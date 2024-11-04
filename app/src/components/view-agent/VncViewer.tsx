import { MessageInput } from './MessageInput';
import Spinner from "@/components/ui/spinner.tsx";
import { Agent, BuildingContainer, DockerContainer } from '@/App';
interface VncViewerProps {
  showControls: boolean;
  sendMessage: (message: string) => void;
  agent: Agent;
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

export function VncViewer({ showControls, sendMessage, agent }: VncViewerProps) {
  if ((agent as BuildingContainer).loading) {
    return (
      <div className='flex justify-center items-center flex-col gap-2'>
        <p>Loading VNC viewer...</p>
        <Spinner size="medium" />
      </div>
    );
  }

  if ((agent as BuildingContainer).error) {
    return (
      <div className='flex justify-center items-center flex-col gap-2'>
        <p>Failed to load VNC viewer</p>
      </div>
    );
  }
  const vncUrl = getVncUrl((agent as DockerContainer).vnc_port, !showControls, agent.agent_id);
  console.log('Connecting to VNC at: ', vncUrl);

  return (
    <>
      <div className="w-full aspect-w-16 aspect-h-9">
        <iframe
          src={vncUrl}
        />
      </div>
      <MessageInput
        sendMessage={sendMessage}
        promptRunning="false"
        currentAgentID={agent.agent_id}
        stopAgent={() => { }}
      />
    </>
  );
} 