import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 5000); // 5 seconds timeout

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <div>Loading Computer Use Demo... This may take up to 5 seconds.</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <p>
          An error occurred while starting the Docker container. 
          Please try running the following command in your terminal:
        </p>
        <pre>
          <code>
            {`docker run \\
    -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \\
    -v $HOME/.anthropic:/home/computeruse/.anthropic \\
    -p 5900:5900 \\
    -p 8501:8501 \\
    -p 6080:6080 \\
    -p 8080:8080 \\
    -it ghcr.io/anthropics/anthropic-quickstarts:computer-use-demo-latest`}
          </code>
        </pre>
        <p>
          If the command works in your terminal but not in the app, please check that:
        </p>
        <ul>
          <li>The ANTHROPIC_API_KEY environment variable is set correctly.</li>
          <li>Docker is running and you have the necessary permissions.</li>
          <li>The required ports (5900, 8501, 6080, 8080) are not in use by other applications.</li>
        </ul>
      </div>
    );
  }

  return (
    <>
      <div>Radah</div>
      <iframe
        src="http://localhost:8080"
        style={{ width: "100%", height: "calc(100vh - 30px)", border: "1px solid #ccc" }}
        title="Radah"
      />
    </>
  );
}

export default App;
