# Kanban Board Skill for OpenClaw

**The Big Man's task management system. Nae pish, pure practical work.** 🏴

## What Is This?

An OpenClaw skill that provides a visual kanban board with HEARTBEAT.md integration for managing tasks.

## Features

- 🎯 **Visual Kanban Board** - Web UI at `http://127.0.0.1:18790/kanban`
- 🔄 **HEARTBEAT.md Sync** - Bi-directional sync with your heartbeat checklist
- 💬 **Conversational Interface** - Manage tasks through natural language with The Big Man
- 📊 **Four Columns** - Backlog, To Do, In Progress, Done
- 🏷️ **Rich Tasks** - Title, description, priority, tags, due dates
- 🚀 **REST API** - Full programmatic control

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.openclaw/workspace/skills/kanban
npm install
```

### 2. Start the Server

```bash
node scripts/server.js &
```

The server runs on port 18790 by default.

### 3. Open the Web UI

Open http://127.0.0.1:18790/kanban in your browser.

### 4. Load Tasks from HEARTBEAT.md

```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/reload
```

Or click "Reload Heartbeat" in the UI.

## Using the Skill

### Via Web UI

- **Drag and drop** cards between columns
- **Click a card** to edit details
- **Add new tasks** with the "+ Add Card" button
- **Reload heartbeat** to import new checklist items

### Via Conversation with The Big Man

**View tasks:**
```
"What's on my kanban board?"
"Show me my backlog"
"What tasks are in progress?"
```

**Add tasks:**
```
"Add a task: Review MoltHub posts"
"Create high priority task: Fix sync bug"
```

**Move tasks:**
```
"Move 'Review posts' to in progress"
"Mark 'Fix bug' as done"
```

**Sync with HEARTBEAT:**
```
"Sync my tasks to heartbeat"
"Load tasks from heartbeat"
```

### Via API

**Get all tasks:**
```bash
curl http://127.0.0.1:18790/api/cards
```

**Add a task:**
```bash
curl -X POST http://127.0.0.1:18790/api/cards \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task name",
    "description": "Details",
    "priority": "high",
    "tags": ["tag1"]
  }'
```

**Move a task:**
```bash
curl -X PUT http://127.0.0.1:18790/api/cards/{id}/move \
  -H "Content-Type: application/json" \
  -d '{"fromColumn": "todo", "toColumn": "in-progress"}'
```

**Sync to HEARTBEAT.md:**
```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/sync
```

## HEARTBEAT.md Integration

### How It Works

1. **Import**: Unchecked items (`- [ ]`) from HEARTBEAT.md load into "To Do" column
2. **Track**: Move tasks through columns as you work on them
3. **Sync**: Completed tasks (in "Done" column) check off in HEARTBEAT.md (`- [x]`)

### Example Workflow

**HEARTBEAT.md:**
```markdown
## Daily Checks
- [ ] Check OpenClaw updates
- [ ] Review MoltHub posts

## Hourly Checks
- [ ] Update MEMORY.md
```

**After reload:**
- All 3 tasks appear in kanban "To Do" column
- Tagged with "heartbeat" and section name

**After completing "Check OpenClaw updates":**
- Move task to "Done" column
- Run sync
- HEARTBEAT.md updates to `- [x] Check OpenClaw updates`

## File Locations

- **Kanban data**: `~/.openclaw/kanban-board.json`
- **HEARTBEAT**: `~/.openclaw/workspace/HEARTBEAT.md`
- **Skill**: `~/.openclaw/workspace/skills/kanban/`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cards` | List all cards |
| POST | `/api/cards` | Create card |
| PUT | `/api/cards/:id` | Update card |
| DELETE | `/api/cards/:id` | Delete card |
| PUT | `/api/cards/:id/move` | Move between columns |
| POST | `/api/heartbeat/reload` | Import from HEARTBEAT.md |
| POST | `/api/heartbeat/sync` | Sync to HEARTBEAT.md |
| GET | `/health` | Health check |

## Configuration

**Change port:**
```bash
KANBAN_PORT=8080 node scripts/server.js &
```

## Tech Stack

- **Backend**: Express.js, Node.js
- **Frontend**: Vanilla JavaScript, Tailwind CSS
- **Storage**: JSON file (`fs-extra`)
- **IDs**: UUID v4

## License

MIT

---

**The Big Man says:** Keep it simple. Keep it sorted. Nae pish. 💪
