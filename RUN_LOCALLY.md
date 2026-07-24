# Running CodeQuest Locally

This guide explains how to start and run the full CodeQuest experience (frontend client, backend server, and local bridge agent) on your local machine.

---

## Prerequisites
Make sure you have [Node.js (v18+)](https://nodejs.org/) installed.

---

## Step 1: Start the Backend Server
The server manages user authentication, roadmaps, and chat.

1. Open your terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file in the `server/` directory by copying `.env.example` from the root workspace.
   - Fill in your Firebase configurations and Gemini API key pools.
4. Run the server:
   ```bash
   npm run dev
   ```
   *The server runs on `http://localhost:5000` by default.*

---

## Step 2: Start the Frontend Client
The React application (Vite-based SPA) provides the interactive user interface.

1. Open a new terminal window and navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Ensure you have a `.env` file inside the `client/` folder configured with your Firebase configuration.
4. Start the frontend:
   ```bash
   npm run dev
   ```
   *The client app runs on `http://localhost:3000` (or `http://localhost:5173`).*

---

## Step 3: Run the Local Bridge Agent
The Local Bridge connects the browser IDE directly to your computer's local files, terminal shell, and compilers.

1. Open a third terminal window and navigate to the `local-bridge/` directory:
   ```bash
   cd local-bridge
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the agent:
   ```bash
   npm start
   ```
   *The Local Bridge agent runs on `http://localhost:7420`.*

---

## How it Connects (Automatic Discovery)
Upon loading, the client frontend automatically:
1. Fetches the current pairing code from the Local Bridge via `GET http://localhost:7420/pairing-code`.
2. Handshakes and authenticates over WebSocket (`ws://localhost:7420`).
3. If the bridge isn't running, the client automatically defaults to **Sandbox Mode** (running programs in an in-browser sandbox via Piston API) with a non-blocking notification banner.
