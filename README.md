Radah is an application to interact with computer control AI agents. Radah is maintained by [Radah](https://radah.ai), you can see a demo on the website.

Agents in Radah have full control of their own desktop environments with various applications that an agent can use to do tasks.

You can chat with your agents to give commands in natural language, watch them operate in their desktop environments to accomplish your assigned tasks, and interact with the environment yourself as needed.

Because Radah aims to run on many platforms, it is a [Tauri](https://tauri.app/) application.

# Running

To run Radah, make sure you have Docker installed and running on your system.

In `src/-tauri` create a `.env` file with the same keys that are listed in in `.env.example`.

Then, run the following commands:

```
git clone https://github.com/GautamSharda/Radah.git
cd Radah/app
npm install
npm run tauri dev
```

Wait a few seconds and the Radah application should open.





# Contributing

This application is not open source.

To start contributing join the contributors [discord server](https://discord.gg/dFPAyMXsvb) and know that:

* At the moment we are focusing on building the following 3 components: the frontend, the agent environment(s), and the agents.

* The frontend is a React app with shadCDN UI components and tailwindCSS, built with Vite.

* Because we want to eventually support a fully offline experience using open source models, all application data should be stored locally.

* For now, the agent environment should be a Docker container with a VNC server and a browser.

* For now, there will be at least 2 agents: Jobs & Internships Matchmaker (J.I.M) and Performs Anything Machine (P.A.M).

 * Read the issues to get started with making PRs, just simply assign an issue to yourself if it is not assigned to anyone else and you want it.
  
 * Feel free to create your own issues, we are especially interested in supporting all kinds of computer control agents for various purposes for now.
