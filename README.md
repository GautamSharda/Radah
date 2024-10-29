Radah is an AI application that provides computer control agents. Radah is maintained by [RadahAI](https://radah.ai).

Agents in Radah have full control of their own desktop environments with various applications that an agent can use to do tasks.

You can give commands to your agents in natural language, watch them operate in their desktop environments, and step in to provide help as needed.

Because Radah aims to run on many platforms, it is a [Tauri](https://tauri.app/) application.

To start contributing know that:

* At the moment we are focusing on building the following 3 components: the frontend, the agent environment(s), and the agents.

* The frontend is a React app with shadCDN UI components and tailwindCSS, built with Vite.

* Because we want to eventually support a fully offline experience using open source models, all application data should be stored locally.

* For now, the agent environment should be a Docker container with a VNC server and a browser.

* For now, there will be at least 2 agents: Jobs & Internships Matchmaker (J.I.M) and Performs Anything Machine (P.A.M).

Please read the issues to get started with making PRs and feel free to create your own.
