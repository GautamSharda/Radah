import { useState, useEffect } from "react";
import { core } from '@tauri-apps/api';
import "./App.css";

function App() {
  const [occupiedPorts, setOccupiedPorts] = useState<number[]>([]);
  const [agents, setAgents] = useState(['Agent 1']);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    core.invoke<number[]>('get_occupied_ports').then(setOccupiedPorts);
  }, []);

  const addNewAgent = () => {
    const newAgentNumber = agents.length + 1;
    setAgents([...agents, `Agent ${newAgentNumber}`]);
  };

  const renderAgentView = () => {
    if (selectedAgent === 'Agent 1' && occupiedPorts.length > 0) {
      return (
        <div className="error-message">
          <p>The Anthropic Computer Use Demo requires that the following ports be unoccupied: 5900, 8501, 6080, 8080</p>
          <p>However, the following ports were found to be occupied: {occupiedPorts.join(', ')}</p>
          <p>Please free those ports and then click reload.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    } else if (selectedAgent === 'Agent 1') {
      return (
        <iframe
          src="http://localhost:8080"
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Agent 1"
        />
      );
    } else if (selectedAgent) {
      return (
        <div className="empty-state">
          <p>Placeholder for {selectedAgent}</p>
        </div>
      );
    } else {
      return (
        <div className="empty-state">
          <p>Select an agent to get started</p>
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="sidebar-title">Agent</h2>
        {agents.map((agent) => (
          <button
            key={agent}
            className="agent-button"
            onClick={() => setSelectedAgent(agent)}
          >
            {agent}
          </button>
        ))}
        <button
          className="add-agent-button"
          onClick={addNewAgent}
        >
          Add new agent
        </button>
      </div>

      {/* Main content area */}
      <div className="main-content">
        {renderAgentView()}
      </div>
    </div>
  );
}

export default App;
