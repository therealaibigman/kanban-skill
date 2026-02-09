# Kanban Board Skill for OpenClaw

**The Big Man's task management system. Nae pish, pure practical work.** 🏴

![Kanban Board Screenshot](./screenshot.png)
*Screenshot: The Big Man's Kanban Board in action*

## What Is This?

An OpenClaw skill that provides a visual kanban board with HEARTBEAT.md integration, auto-execution, and secure authentication for managing tasks.

## Features

- 🎯 **Visual Kanban Board** - Web UI with drag-and-drop
- 🔄 **HEARTBEAT.md Sync** - Bi-directional sync with your heartbeat checklist
- ⚡ **Auto-Execution** - Tasks moved to "In Progress" trigger instant execution by OpenClaw
- 🔒 **Secure Authentication** - Uses OpenClaw gateway token for access control
- 💬 **Conversational Interface** - Manage tasks through natural language
- 📊 **Four Columns** - Backlog, To Do, In Progress, Done
- 🏷️ **Rich Tasks** - Title, description, priority, tags, due dates
- 🚀 **REST API** - Full programmatic control
- 🔧 **Systemd Service** - Production-ready deployment
- 🌐 **NGINX Integration** - Secure HTTPS access

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.openclaw/workspace/skills/kanban
npm install
```

### 2. Start the Server

#### Development (manual)
```bash
node scripts/server.js &
```

#### Production (systemd)
```bash
sudo systemctl start kanban.service
sudo systemctl enable kanban.service  # Auto-start on boot
```

### 3. Access the Web UI

**Local:**
- http://127.0.0.1:18790/kanban

**Via NGINX (recommended):**
- https://able-harp.exe.xyz/kanban

**On first visit:**
- You'll be prompted to enter your OpenClaw gateway token
- The token is securely stored in browser localStorage
- Use the "Logout" button to clear it

### 4. Load Tasks from HEARTBEAT.md

Click "Reload Heartbeat" in the UI, or:

```bash
TOKEN="your-openclaw-gateway-token"
curl -X POST http://127.0.0.1:18790/api/heartbeat/reload \
  -H "Authorization: Bearer $TOKEN"
```

## 🔒 Security

### Authentication

The kanban server uses OpenClaw's gateway token for authentication. All API endpoints (except `/health`) require a valid token.

**Token can be provided via:**
1. `Authorization: Bearer <token>` header (API calls)
2. `openclaw_token` cookie (browser)

The token is loaded from `~/.openclaw/openclaw.json` at startup.

### Access Control

- ✅ **Authenticated requests** - Full access to all endpoints
- ❌ **Unauthenticated requests** - Rejected with 401 or 403
- ✅ **Health check** - Always accessible (for monitoring)
- 🔒 **No URL tokens** - Tokens never passed in URLs (security best practice)

### Network Security

- Server binds to `127.0.0.1` (localhost only)
- NGINX proxy provides HTTPS termination
- CORS configured for credential support

## Using the Skill

### Via Web UI

- **Drag and drop** cards between columns
- **Click a card** to edit details
- **Add new tasks** with the "+ Add Card" button
- **Reload heartbeat** to import new checklist items
- **Auto-execute** by dragging to "In Progress"

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

All API calls require authentication. Set the token:

```bash
export KANBAN_TOKEN="your-openclaw-gateway-token"
```

**Get all tasks:**
```bash
curl http://127.0.0.1:18790/api/cards \
  -H "Authorization: Bearer $KANBAN_TOKEN"
```

**Add a task:**
```bash
curl -X POST http://127.0.0.1:18790/api/cards \
  -H "Authorization: Bearer $KANBAN_TOKEN" \
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
  -H "Authorization: Bearer $KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromColumn": "todo", "toColumn": "in-progress"}'
```

**Sync to HEARTBEAT.md:**
```bash
curl -X POST http://127.0.0.1:18790/api/heartbeat/sync \
  -H "Authorization: Bearer $KANBAN_TOKEN"
```

## ⚡ Auto-Execution Feature

### How It Works

When a task is moved to the **"In Progress"** column, the kanban server automatically:

1. Detects the column change
2. Builds an execution message from the task details
3. Sends a wake event to OpenClaw's main session
4. The Big Man receives the task and executes it immediately

### Example Flow

**You drag:** "Review MoltHub posts" from To Do → In Progress

**Server sends to OpenClaw:**
```
🚧 Auto-executing from Kanban:

**Task:** Review MoltHub posts
**Details:** From Hourly Checks
**Tags:** heartbeat, hourly-checks

Review MoltHub posts
```

**The Big Man receives this and executes the task instantly.**

### Execution Monitoring

**View execution log:**
```bash
curl http://127.0.0.1:18790/api/executions/log \
  -H "Authorization: Bearer $KANBAN_TOKEN"
```

**Check pending queue:**
```bash
curl http://127.0.0.1:18790/api/executions/queue \
  -H "Authorization: Bearer $KANBAN_TOKEN"
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
- **Execution log**: `~/.openclaw/workspace/kanban-executions.log`
- **Task queue**: `~/.openclaw/workspace/kanban-task-queue.json` (fallback)
- **HEARTBEAT**: `~/.openclaw/workspace/HEARTBEAT.md`
- **Skill**: `~/.openclaw/workspace/skills/kanban/`
- **Config**: `~/.openclaw/openclaw.json` (for auth token)

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/cards` | Yes | List all cards |
| POST | `/api/cards` | Yes | Create card |
| PUT | `/api/cards/:id` | Yes | Update card |
| DELETE | `/api/cards/:id` | Yes | Delete card |
| PUT | `/api/cards/:id/move` | Yes | Move between columns |
| POST | `/api/heartbeat/reload` | Yes | Import from HEARTBEAT.md |
| POST | `/api/heartbeat/sync` | Yes | Sync to HEARTBEAT.md |
| POST | `/api/cards/auto-move` | Yes | Move all To Do → In Progress |
| POST | `/api/cards/process-tasks` | Yes | Move all In Progress → Done |
| GET | `/api/executions/log` | Yes | View execution history |
| GET | `/api/executions/queue` | Yes | Check pending tasks |
| DELETE | `/api/executions/queue` | Yes | Clear task queue |

## Production Deployment

### Systemd Service

**Service file:** `/etc/systemd/system/kanban.service`

**Commands:**
```bash
sudo systemctl start kanban      # Start
sudo systemctl stop kanban       # Stop
sudo systemctl restart kanban    # Restart
sudo systemctl status kanban     # Status
sudo systemctl enable kanban     # Auto-start on boot
sudo journalctl -u kanban -f     # View logs
```

### NGINX Configuration

**Add to your NGINX config:**

```nginx
# Kanban board
location /kanban {
    proxy_pass http://127.0.0.1:18790;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Kanban API
location /api/ {
    proxy_pass http://127.0.0.1:18790;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then: `sudo nginx -t && sudo systemctl reload nginx`

## Configuration

### Change Port

```bash
# In systemd service
sudo systemctl edit kanban

# Add:
[Service]
Environment="KANBAN_PORT=8080"

sudo systemctl daemon-reload
sudo systemctl restart kanban
```

### Get Your OpenClaw Token

```bash
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

## Tech Stack

- **Backend**: Express.js, Node.js
- **Frontend**: Vanilla JavaScript, Tailwind CSS
- **Storage**: JSON file (`fs-extra`)
- **Auth**: Token-based (shared with OpenClaw)
- **IDs**: UUID v4
- **Deployment**: systemd, NGINX

## Development

### Run in Dev Mode

```bash
cd ~/.openclaw/workspace/skills/kanban
node scripts/server.js
```

### Watch Logs

```bash
sudo journalctl -u kanban -f
```

### Test Auth

```bash
# Should fail (no token)
curl http://127.0.0.1:18790/api/cards

# Should succeed
TOKEN="your-token"
curl http://127.0.0.1:18790/api/cards \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### "Authentication required" error

Make sure you're providing the OpenClaw gateway token:
- In the UI: Add `?token=YOUR_TOKEN` to the URL on first visit
- In API calls: Add `Authorization: Bearer YOUR_TOKEN` header

### Server not starting

```bash
sudo systemctl status kanban
sudo journalctl -u kanban -n 50
```

### Can't access via NGINX

Check NGINX config:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Auto-execution not working

Check execution log:
```bash
curl http://127.0.0.1:18790/api/executions/log \
  -H "Authorization: Bearer $TOKEN"
```

## License

MIT

---

**The Big Man says:** Keep it simple. Keep it sorted. Keep it secure. Nae pish. 💪

**GitHub:** https://github.com/therealaibigman/kanban-skill
