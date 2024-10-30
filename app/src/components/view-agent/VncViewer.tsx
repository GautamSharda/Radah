import React, { useEffect, useState } from 'react';
import { core } from '@tauri-apps/api';
import { MessageInput } from './MessageInput';
import Spinner from '../ui/spinner';

interface VncViewerProps {
  agentId: string;
}

interface DockerContainer {
  id: string;
  vnc_port: number;
  agent_id: string;
}

export function VncViewer({ agentId }: VncViewerProps) {
  const [container, setContainer] = useState<DockerContainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // just use localhost since we know that's the noVNC port
  const vncUrl = "http://localhost:6080";

  useEffect(() => {
    let mounted = true;

    async function initContainer() {
      try {
        // Try to get existing container
        let containerInfo = await core.invoke<DockerContainer | null>('get_agent_container', { agentId });

        // If no container exists and component is still mounted, create one
        if (!containerInfo && mounted) {
          containerInfo = await core.invoke<DockerContainer>('create_agent_container', { agentId });
        }

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
        }
      }
    }

    initContainer();

    return () => {
      mounted = false;
    };
  }, [agentId]);

  if (loading) {
    return (
      <div className='flex justify-center items-center flex-col gap-2'>
        <p>Loading VNC viewer...</p>
        <Spinner size="medium"/>
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

  console.log('Connecting to VNC at:', vncUrl);

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
        agentConnection={true}
      />
    </>
  );
} 