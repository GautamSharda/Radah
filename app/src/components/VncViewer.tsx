import React, { useEffect, useState } from 'react';
import { core } from '@tauri-apps/api';

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
    return <div>Loading VNC viewer...</div>;
  }

  if (error || !container) {
    return <div>Failed to load VNC viewer: {error}</div>;
  }

  // Just use localhost:6080 since we know that's the noVNC port
  const vncUrl = "http://localhost:6080";
  
  console.log('Connecting to VNC at:', vncUrl);

  return (
    <div className="h-full w-full">
      <iframe
        src={vncUrl}
      />
    </div>
  );
} 