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
        }
      } catch (error) {
        console.error('Failed to initialize container:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initContainer();

    // Cleanup function
    return () => {
      mounted = false;
    };
  }, [agentId]);

  if (loading) {
    return <div>Loading VNC viewer...</div>;
  }

  if (!container) {
    return <div>Failed to load VNC viewer</div>;
  }

  return (
    <div className="h-full w-full">
      <iframe
        src={`http://localhost:${container.vnc_port}/vnc.html?autoconnect=1&resize=scale`}
        className="w-full h-full border-none"
        allow="fullscreen"
      />
    </div>
  );
} 