import React, { useEffect, useState } from 'react';
import { core } from '@tauri-apps/api';
import { MessageInput } from './MessageInput';
import Spinner from "@/components/ui/spinner.tsx";

interface VncViewerProps {
  agentId: string;
  showControls: boolean;
}

interface DockerContainer {
  id: string;
  vnc_port: number;
  agent_id: string;
}

export function VncViewer({ agentId, showControls }: VncViewerProps) {
  const [container, setContainer] = useState<DockerContainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    // Set switching to true whenever agentId changes
    setSwitching(true);
    let mounted = true;

    async function initContainer() {
      try {
        // Try to get existing container
        let containerInfo = await core.invoke<DockerContainer | null>('get_agent_container', { agentId });

        // If no container exists and component is still mounted, create one
        if (!containerInfo && mounted) {
          containerInfo = await core.invoke<DockerContainer>('create_agent_container', { agentId });
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        if (mounted) {
          setContainer(containerInfo);
          setError(null);
        }
      } catch (error) {
        console.error('Failed to initialize container:', error);
        if (mounted) {
          setError('Failed to initialize container');
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setSwitching(false); // Reset switching state when done
        }
      }
    }

    initContainer();

    return () => {
      mounted = false;
    };
  }, [agentId]);

  if (loading || switching) {
    return (
      <div className='flex justify-center items-center flex-col gap-2'>
        <p>{loading ? 'Loading VNC viewer...' : 'Switching agents...'}</p>
        <Spinner size="medium" />
      </div>
    );
  }

  if (error || !container) {
    return (
      <div className='flex justify-center items-center flex-col gap-2'>
        <p>Failed to load VNC viewer: {error}</p>
      </div>
    );
  }

  // Add unique session parameters for each agent
  const getVncUrl = (port: number, view_only: boolean) => {
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


  const vncUrl = getVncUrl(container.vnc_port, !showControls);
  console.log('Connecting to VNC at: ', vncUrl);

  return (
    <>
      <div className="w-full aspect-w-16 aspect-h-9">
        <iframe
          src={vncUrl}
        />
      </div>
      <MessageInput
        sendMessage={() => { }}
        promptRunning="false"
        currentAgentID={agentId}
        stopAgent={() => { }}
        agentConnection={!loading}
      />
    </>
  );
} 