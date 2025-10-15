# Radah Web Deployment

This folder hosts the build artifacts and start script for the browser-only preview of Radah.

## Commands

- `npm run build` – compiles the shared frontend with `VITE_PLATFORM=web` and writes the output to `web/dist`.
- `npm start` – serves the bundled assets on the port provided by the `PORT` env var (defaults to `4173`).

Railway can be configured to use this directory as the project root: set the install command to `npm install`, the build command to `npm run build`, and the start command to `npm start`.
