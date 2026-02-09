---
name: kanban
description: Kanban board for task management with HEARTBEAT.md integration. Use when The Big Man needs to manage tasks, track progress, view the kanban board, add/update/delete tasks, sync with HEARTBEAT.md, or answer questions about current tasks and their status.
---

# Kanban Task Management

A visual kanban board for managing tasks with automatic HEARTBEAT.md synchronization.

## What This Skill Provides

- **Web UI**: Visual kanban board at `http://127.0.0.1:18790/kanban`
- **API**: REST API for programmatic task management
- **HEARTBEAT Sync**: Bi-directional sync with HEARTBEAT.md checklist
- **Conversational Interface**: Manage tasks through natural language
- **Auto-Execution**: Tasks moved to "In Progress" trigger automatic execution by The Big Man

## Starting the Server

The kanban server runs as a systemd service (production) or can be started manually (development).

### Production (recommended)

```bash
sudo systemctl start kanban.service
# Server is now running and will auto-restart on boot
```

### Development

```bash
cd ~/.openclaw/workspace/skills/kanban
node scripts/server.js &
```

The server runs on port 18790 by default. Set `KANBAN_PORT` environment variable to change.

## Authentication

All API endpoints (except `/health`) require the OpenClaw gateway token.

**Get the token:**
```bash
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

**Use in API calls:**
```bash
TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:18790/api/cards
```

**Access the UI:**
- First visit: `https://able-harp.exe.xyz/kanban?token=YOUR_TOKEN`
- Token is saved to localStorage for subsequent visits

## Using the Web UI

Open http://127.0.0.1:18790/kanban in a browser to:

- View all tasks organized by column (Backlog, To Do, In Progress, Done)
- Drag and drop cards between columns
- Click cards to edit title, description, priority, tags, due date
- Add new cards with the "+ Add Card" button
- Reload tasks from HEARTBEAT.md with "Reload Heartbeat" button

## Conversational Task Management

### Viewing Tasks

When asked about tasks, read the kanban data file at `~/.openclaw/kanban-board.json`:

```bash
cat ~/.openclaw/kanban-board.json | jq
```

**Examples:**
- "What's on my kanban board?"
- "What tasks are in progress?"
- "Show me my backlog"
- "What do I need to do today?"

Parse the JSON and present a human-readable summary organized by column.

### Adding Tasks

To add a task via conversation, make a POST request to the API:

```bash
curl -X POST http://127.0.0.1:18790/api/cards \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task title",
    "description": "Task description",
    "priority": "medium",
    "tags": ["tag1", "tag2"]
  }'
```

**Examples:**
- "Add a task: Review MoltHub posts"
- "Create a backlog item to research AI agent frameworks"
- "Add high priority task: Fix kanban sync bug"

### Moving Tasks

To move a task between columns, use the move endpoint:

```bash
curl -X PUT http://127.0.0.1:18790/api/cards/{cardId}/move \
  -H "Content-Type: application/json" \
  -d '{
    "fromColumn": "todo",
    "toColumn": "in-progress"
  }'
```

**Examples:**
- "Move 'Review MoltHub posts' to in progress"
- "Mark 'Fix sync bug' as done"
- "Start working on the research task"

First, find the task by reading the kanban file, get its ID, then make the move request.

### Updating Tasks

To update task details:

```bash
curl -X PUT http://127.0.0.1:18790/api/cards/{cardId} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "priority": "high",
    "tags": ["urgent"]
  }'
```

### Deleting Tasks

```bash
curl -X DELETE http://127.0.0.1:18790/api/cards/{cardId}
```

## HEARTBEAT.md Integration

### Loading Tasks from HEARTBEAT

The kanban board automatically loads unchecked tasks from HEARTBEAT.md on first run. To manually reload:

```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/reload
```

Tasks are tagged with "heartbeat" and their section name.

### Syncing Status Back to HEARTBEAT

When tasks move to "Done" column, sync the status back:

```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/sync
```

This updates checkboxes in HEARTBEAT.md:
- Tasks in "Done" column → `- [x] Task name`
- Tasks in other columns → `- [ ] Task name`

### Automatic Sync Strategy

**Recommended approach:**

1. Tasks start as checklist items in HEARTBEAT.md
2. On heartbeat, The Big Man loads them into kanban "To Do" column
3. As work progresses, tasks move through columns (via UI or conversation)
4. When tasks complete, The Big Man syncs status back to HEARTBEAT.md
5. Completed heartbeat tasks show as checked in HEARTBEAT.md

**Do NOT** manually edit HEARTBEAT.md checkboxes for tasks tracked in kanban - let the sync handle it.

## API Reference

### GET /api/cards
Returns all cards organized by column.

**Response:**
```json
{
  "backlog": [...],
  "todo": [...],
  "in-progress": [...],
  "done": [...]
}
```

### POST /api/cards
Create a new card (always added to "todo" column).

**Request body:**
```json
{
  "title": "Task title",
  "description": "Optional description",
  "priority": "low|medium|high",
  "tags": ["tag1", "tag2"],
  "dueDate": "2026-02-15"
}
```

### PUT /api/cards/:id
Update card details.

### PUT /api/cards/:id/move
Move card between columns.

**Request body:**
```json
{
  "fromColumn": "todo",
  "toColumn": "in-progress"
}
```

### DELETE /api/cards/:id
Delete a card.

### POST /api/heartbeat/reload
Load unchecked tasks from HEARTBEAT.md into kanban.

### POST /api/heartbeat/sync
Sync kanban task status back to HEARTBEAT.md checkboxes.

### GET /health
Health check endpoint.

## Data Storage

- **Kanban data**: `~/.openclaw/kanban-board.json`
- **HEARTBEAT file**: `~/.openclaw/workspace/HEARTBEAT.md`

## Columns

1. **Backlog** - Ideas and future tasks
2. **To Do** - Tasks ready to start
3. **In Progress** - Active work
4. **Done** - Completed tasks

## Task Structure

Each task has:
- `id`: Unique identifier (UUID)
- `title`: Task name
- `description`: Detailed description
- `priority`: low, medium, or high
- `tags`: Array of tags
- `column`: Current column name
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp
- `dueDate`: Optional due date

## Auto-Execution Feature

### How It Works

When a task is moved to the "In Progress" column (via UI or API), the kanban server automatically:

1. Detects the column change
2. Builds an execution message from the task details
3. Sends a wake event to OpenClaw's main session
4. The Big Man receives the task and executes it

### Execution Flow

**User action:** Drag task "Review MoltHub posts" from To Do → In Progress

**Server triggers:**
```
🚧 Auto-executing from Kanban:

**Task:** Review MoltHub posts
**Details:** From Hourly Checks
**Tags:** heartbeat, hourly-checks

Review MoltHub posts
```

**The Big Man receives this and executes the task automatically.**

### Checking Execution Status

View execution log:
```bash
curl http://127.0.0.1:18790/api/executions/log
```

View pending task queue (fallback):
```bash
curl http://127.0.0.1:18790/api/executions/queue
```

### Processing Task Queue

During heartbeat, The Big Man should check for queued tasks:

```bash
# Check queue
QUEUE=$(curl -s http://127.0.0.1:18790/api/executions/queue)

# If queue not empty, process tasks
if [ "$QUEUE" != "[]" ]; then
    # Handle each task
    # Then clear queue:
    curl -X DELETE http://127.0.0.1:18790/api/executions/queue
fi
```

### Execution Log Format

```
[2026-02-09T20:30:00.000Z] Executing task: Review MoltHub posts (abc-123-def)
[2026-02-09T20:30:00.123Z] ✅ Injected: Review MoltHub posts
```

## Common Patterns

### Daily Task Check

```bash
# View current tasks
cat ~/.openclaw/kanban-board.json | jq '.["in-progress"]'

# Summarize for user
"The Big Man sees {count} tasks in progress: {task list}"
```

### Heartbeat Task Import

During heartbeat, reload tasks from HEARTBEAT.md:

```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/reload
```

Then summarize new tasks added.

### End-of-Day Sync

Before ending work session, sync completed tasks back:

```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/sync
```

## Troubleshooting

### Server not running

If API calls fail, check if server is running:

```bash
curl http://127.0.0.1:18790/health
```

If not, start it:

```bash
cd ~/.openclaw/workspace/skills/kanban
node scripts/server.js &
```

### Port conflict

If port 18790 is in use, set different port:

```bash
KANBAN_PORT=18791 node scripts/server.js &
```

Update API calls to use the new port.

## Notes

- The server runs in the background - start it once per session
- Web UI updates in real-time when tasks change
- All API endpoints use JSON
- Task IDs are UUIDs (e.g., "a1b2c3d4-e5f6-...")
- Priority affects visual styling in the UI
- Tags are displayed as colored badges in the UI
