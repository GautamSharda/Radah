import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import VNCView from "./components/VNCView";
import Sidebar from "./components/Sidebar";

function App() {
  const [occupiedPorts, setOccupiedPorts] = useState<number[]>([]);

  useEffect(() => {
    invoke<number[]>('get_occupied_ports').then(setOccupiedPorts);
  }, []);

  const renderContent = () => {
    if (occupiedPorts.length > 0) {
      return (
        <div className="error-message">
          <p>The Anthropic Computer Use Demo requires that the following ports be unoccupied: 5900, 8501, 6080, 8080</p>
          <p>However, the following ports were found to be occupied: {occupiedPorts.join(', ')}</p>
          <p>Please free those ports and then click reload.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }

    return (
      <>
        <Sidebar />
        <VNCView />
      </>
    );
  };

  return (
    <div className="container">
      {renderContent()}
    </div>
  );
}

export default App;
