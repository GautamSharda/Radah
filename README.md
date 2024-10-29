Radah is an application to interact with computer control AI agents. Radah is maintained by [RadahAI](https://radah.ai), you can see a demo on the website.

Agents in Radah have full control of their own desktop environments with various applications that an agent can use to do tasks.

You can chat with your agents to give commands in natural language, watch them operate in their desktop environments to accomplish your assigned tasks, and interact with the environment yourself as needed.

Because Radah aims to run on many platforms, it is a [Tauri](https://tauri.app/) application. You can read their docs to figure out how to run Radah.

To start contributing join the community [discord server](https://discord.gg/JyhGGfsqHj) and know that:

* At the moment we are focusing on building the following 3 components: the frontend, the agent environment(s), and the agents.

* The frontend is a React app with shadCDN UI components and tailwindCSS, built with Vite.

* Because we want to eventually support a fully offline experience using open source models, all application data should be stored locally.

* For now, the agent environment should be a Docker container with a VNC server and a browser.

* For now, there will be at least 2 agents: Jobs & Internships Matchmaker (J.I.M) and Performs Anything Machine (P.A.M).

 * Read the issues to get started with making PRs. Claim an issue but commenting "claiming" or something. Talk to me before doing so.

 * Feel free to create your own issues, we are especially interested in supporting all kinds of computer control agents for various purposes for now.
