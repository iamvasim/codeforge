# CodeForge

> **Collaborative AI-Powered Cloud IDE**  
> *"Build together. Code smarter."*

CodeForge is a collaborative AI-powered cloud development workspace where developers can write, run, and improve code together in real time.

---

## ✨ Features

- ⚡ **Real-time Collaboration**: Multi-user real-time coding and chat synchronized across servers via Socket.IO and Redis Pub/Sub Adapter.
- 🤖 **CodeForge AI Assistant**: Streaming Google Gemini model for explaining, debugging, refactoring, and generating code with side-by-side Monaco Diff Viewer merge approval.
- 💻 **Monaco Code Editor**: Professional VS Code editor experience with syntax highlighting, multiple tabs, custom keybindings, and automatic layout resizing.
- 🚀 **In-Browser WebContainer Runtime**: Run Node.js applications and Python execution (Pyodide WASM) in an integrated interactive xterm.js terminal with live browser previews.
- 🔐 **Role-Based Access Control (RBAC)**: Fine-grained project permissions (Owner, Editor, Viewer) protecting against IDOR attacks, unauthorized file mutations, and privilege escalation.
- ↔️ **Draggable Resizable Panels**: Fully customizable workspace layout with smooth drag-to-resize sidebar and memory persistence across reloads.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Monaco Editor, xterm.js, WebContainer API, Tailwind CSS
- **Backend**: Node.js, Express 5, MongoDB, Mongoose, Redis, Socket.IO, Google Generative AI SDK
- **Architecture**: Microservice-ready horizontal scaling with Redis message broker and Docker Compose

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Configuration

Create a `backend/.env` file:
```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/SOEN
JWT_SECRET=your_jwt_secret_here
REDIS_URL=redis://127.0.0.1:6379
GOOGLE_AI_KEY=your_gemini_api_key_here
```

### 3. Start Development Servers

```bash
# Start Backend
cd backend && npm run dev

# Start Frontend
cd frontend && npm run dev
```

---

## 🐳 Docker Deployment

```bash
docker compose up --build
```

---

## 📄 License

ISC License
