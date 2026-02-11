# Kanban Board Skill for OpenClaw

**The Big Man's task management system. Nae pish, pure practical work.** 🏴

![Kanban Board Screenshot](./screenshot.png)
*Screenshot: The Big Man's Kanban Board in action*

A production-ready kanban board skill for OpenClaw featuring a modern glassmorphism UI, password authentication, automatic task execution, archive system, and intelligent scheduling.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Using the Kanban Board](#using-the-kanban-board)
- [Task Scheduling](#task-scheduling)
- [Auto-Execution](#auto-execution)
- [Archive System](#archive-system)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Features

### Core Functionality
- 🎯 **Modern Dashboard UI** - Beautiful glassmorphism design with gradient themes
- 🔐 **Password Login** - Easy authentication with password → token exchange
- 🎨 **Visual Kanban Board** - Drag-and-drop with smooth animations
- 📅 **Calendar View** - Month view with color-coded task dots by due date
- 📋 **Card Reordering** - Drag cards up/down within columns to prioritize
- 📊 **Live Stats** - Real-time task counts for each column
- ⚡ **Auto-Execution** - Tasks moved to "In Progress" trigger instant OpenClaw execution
- 🤖 **SubAgent Orchestration** - Delegate tasks to AI subagents with sequential workflows
- 💬 **Task Comments** - Add notes and updates without editing description
- 📦 **Archive System** - Archive completed tasks, restore if needed, permanent delete
- 🔒 **Secure Authentication** - Token-based auth integrated with OpenClaw gateway

### Task Management
- 🏷️ **Rich Tasks** - Title, description, priority (low/medium/high), tags, due dates
- 📅 **Three Schedule Types**:
  - **Once** - One-time task
  - **Heartbeat** 💓 - Recurring (for tracked recurring work)
  - **Cron** ⏰ - Scheduled with cron expression (creates OpenClaw cron job)
- 🚀 **Four Columns** - Backlog, To Do, In Progress, Done
- 💬 **Conversational Interface** - Manage tasks through natural language with The Big Man
- 🗨️ **Task Comments** - Add progress updates and notes to any task
- 🎨 **Subtasks** - Break tasks into checkboxes with progress tracking

### Technical Features
- 🔧 **Systemd Service** - Production-ready deployment with auto-restart
- 🌐 **NGINX Integration** - Secure HTTPS access
- 🔑 **Multiple Auth Methods** - Authorization header or cookie
- 📡 **REST API** - Full programmatic control
- 💾 **Persistent Storage** - JSON file-based with separate archive

---

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.openclaw/workspace/skills/kanban
npm install
```

### 2. Configure Password

Add a password to your OpenClaw config for easy login:

```bash
# Edit OpenClaw config
nano ~/.openclaw/openclaw.json

# Add under gateway.auth:
"password": "your-secure-password"
```

Or set via environment variable:
```bash
export KANBAN_PASSWORD="your-secure-password"
```

### 3. Start the Server

#### Production (systemd - recommended)
```bash
sudo systemctl start kanban.service
sudo systemctl enable kanban.service  # Auto-start on boot
```

#### Development (manual)
```bash
cd ~/.openclaw/workspace/skills/kanban
node scripts/server.js &
```

### 4. Access the Web UI

**Local:**
- http://127.0.0.1:18790/kanban
- http://localhost:18790/kanban

**Via NGINX (production):**
- https://your-domain.com/kanban (configure NGINX as shown below)

### 5. Login

- Enter your configured password
- Token is automatically retrieved and stored in browser localStorage
- Use "🔓 Logout" button to clear token and login again

---

## Authentication

### Security Model

The kanban server uses **OpenClaw's gateway token** for authentication. All API endpoints (except `/health` and `/api/auth/login`) require a valid token.

### Password Login Flow

1. User enters password in login form
2. Server validates against `gateway.auth.password` in OpenClaw config
3. Server returns the OpenClaw gateway token
4. Token stored in browser localStorage
5. All subsequent API calls use: `Authorization: Bearer <token>`

### Token Validation

**Token can be provided via:**
1. `Authorization: Bearer <token>` header (API calls)
2. `openclaw_token` cookie (browser sessions)

**Security features:**
- ✅ Passwords never stored in browser
- ✅ Tokens never exposed in URLs
- ✅ Server binds to localhost only (127.0.0.1)
- ✅ NGINX provides HTTPS termination
- ✅ CORS configured for credentials only

### Access Control

| Endpoint | Auth Required | Purpose |
|----------|---------------|---------|
| `/health` | No | Monitoring |
| `/api/auth/login` | No | Password → token exchange |
| `/kanban/*` (static) | No | UI files |
| All API endpoints | Yes | Data operations |

---

## Using the Kanban Board

### Web UI

#### Dashboard Overview

**Header:**
- Stats cards showing task counts per column
- Action buttons: Add Task, Archive, Logout

**Kanban Board:**
- Four columns: Backlog, To Do, In Progress, Done
- Drag-and-drop cards between columns
- Drag cards up/down within columns to reorder
- Click any card to edit

#### Creating Tasks

1. Click **"+ Add Task"** button
2. Fill in task details:
   - **Title** (required)
   - **Description** (optional)
   - **Priority**: Low, Medium, High
   - **Due Date** (optional)
   - **Schedule Type**: Once, Heartbeat, Cron
   - **Starting Column**: Backlog, To Do, In Progress, Done
   - **Tags** (comma-separated)
   - **Cron Expression** (if schedule type is Cron)
3. Click **"Save"**

#### Editing Tasks

1. Click any card
2. Edit any field
3. Options:
   - **Save** - Update task
   - **📦 Archive** - Move to archive (cancels cron if exists)
   - **Delete** - Permanently delete task
   - **Cancel** - Close without saving

#### Moving Tasks

**Between Columns:**
- Drag card to different column
- Auto-execution triggers if moved to "In Progress"

**Within Column (Reordering):**
- Drag card up or down within same column
- Bright gradient line shows drop position
- Position above or below target card

#### Archive Management

1. Click **"📦 Archive"** button
2. View all archived tasks with dates
3. Options:
   - **↩️ Restore** - Move back to Done column
   - **🗑️ Delete** - Permanently delete (cannot be undone)
   - **Archive All Done** - Batch archive all tasks in Done column
   - **Clear Archive** - Delete all archived tasks

### Via Conversation with The Big Man

The Big Man can manage tasks through natural language:

**View tasks:**
```
"What's on my kanban board?"
"Show me my backlog"
"What tasks are in progress?"
"How many tasks do I have?"
```

**Add tasks:**
```
"Add a task: Review MoltHub posts"
"Create high priority task: Fix sync bug"
"Add cron task to check updates daily at 9 AM"
```

**Move tasks:**
```
"Move 'Review posts' to in progress"
"Mark 'Fix bug' as done"
"Start working on [task name]"
```

**Archive tasks:**
```
"Archive all done tasks"
"Clean up my done column"
```

The Big Man reads `~/.openclaw/kanban-board.json` to answer questions and uses the API to make changes.

### Via API

All API calls require authentication:

```bash
export TOKEN="your-openclaw-gateway-token"
```

**Get all tasks:**
```bash
curl http://localhost:18790/api/cards \
  -H "Authorization: Bearer $TOKEN"
```

**Add a task:**
```bash
curl -X POST http://localhost:18790/api/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task name",
    "description": "Details",
    "priority": "high",
    "tags": ["tag1", "tag2"],
    "column": "backlog",
    "schedule": "once"
  }'
```

**Move a task:**
```bash
curl -X PUT http://localhost:18790/api/cards/{id}/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromColumn": "todo", "toColumn": "in-progress"}'
```

**Reorder within column:**
```bash
curl -X PUT http://localhost:18790/api/cards/{id}/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"column": "backlog", "position": 0}'
```

**Archive task:**
```bash
curl -X POST http://localhost:18790/api/archive/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Task Scheduling

### Three Schedule Types

#### 1. Once (Default) 🎯

**Purpose:** Standard one-time task

**Behavior:**
- Appears in kanban board
- Moves through columns manually
- Completes when moved to Done or archived
- No recurrence

**Use for:**
- Features to build
- Bugs to fix
- One-off work items

#### 2. Heartbeat 💓

**Purpose:** Recurring task you want to track visually

**Behavior:**
- Appears in kanban with 💓 icon
- Can be moved through columns
- Tagged with "heartbeat"
- If archived, recurrence stops (converts to "once")

**Use for:**
- Regular reviews
- Periodic maintenance
- Recurring work you want to see in kanban

**Note:** Different from HEARTBEAT.md automatic actions

#### 3. Cron ⏰

**Purpose:** Scheduled task with specific timing

**Behavior:**
- Creates OpenClaw cron job automatically
- Appears in kanban with ⏰ icon and cron expression
- Fires system event to main session at scheduled time
- Visible in OpenClaw Control UI → Cron Jobs panel
- If archived, cron job is cancelled

**Cron Expression Examples:**
- `0 9 * * *` - Daily at 9 AM UTC
- `0 9 * * 1-5` - Weekdays at 9 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 10 * * 1` - Weekly Monday at 10 AM

**Use for:**
- Daily standup reminders
- Weekly reviews
- Periodic checks
- Scheduled maintenance

**How it executes:**
```
🚧 Scheduled task from Kanban:

**Task Title**
Description

Priority: high
Schedule: 0 9 * * *
```

---

## Auto-Execution

### How It Works

When a task is moved to the **"In Progress"** column (via UI or API), the kanban server automatically:

1. Detects the column change
2. Builds an execution message from task details
3. Sends wake event to OpenClaw main session
4. The Big Man receives it instantly and executes the task

### Example Flow

**You drag:** "Review MoltHub posts" from To Do → In Progress

**Server instantly sends:**
```
🚧 Auto-executing from Kanban:

**Task:** Review MoltHub posts
**Details:** Check recent posts and engage
**Tags:** community, engagement

Review MoltHub posts
```

**The Big Man receives this and executes immediately.**

### Execution Monitoring

**View execution log:**
```bash
curl http://localhost:18790/api/executions/log \
  -H "Authorization: Bearer $TOKEN"
```

**Log format:**
```
[2026-02-09T22:30:00.000Z] Executing task: Review MoltHub posts (abc-123)
[2026-02-09T22:30:00.123Z] ✅ Injected: Review MoltHub posts
```

### Queue Fallback

If the wake API fails, tasks are queued in `kanban-task-queue.json`. The queue is automatically checked and cleared during heartbeats. This rarely happens - auto-execution typically works instantly.

---

## Archive System

### Purpose

Keep your Done column tidy by archiving completed tasks while preserving history.

### Features

#### Archive Tasks
- **Individual:** Click task → Edit → "📦 Archive" button
- **Batch:** Archive modal → "Archive All Done" button
- **From any column:** Can archive tasks without moving to Done first

#### View Archive
- Click "📦 Archive" button in header
- See all archived tasks with:
  - Title, description, priority, tags
  - Archived date timestamp
  - Original schedule type

#### Restore Tasks
- Click "↩️ Restore" on any archived task
- Task moves back to Done column
- Ready to continue or move to other columns

#### Permanent Delete
- Click "🗑️ Delete" on archived task
- Confirmation required
- Cannot be undone
- Removes from archive file permanently

#### Clear Archive
- "Clear Archive" button in archive modal
- Deletes all archived tasks
- Confirmation required
- Use to clean up old history

### Cron & Heartbeat Handling

**When archiving:**
- **Cron tasks**: OpenClaw cron job is automatically cancelled
- **Heartbeat tasks**: Schedule changed to "once" (stops recurrence)
- **Once tasks**: No special handling needed

### Storage

- **Archive file:** `~/.openclaw/kanban-archive.json`
- **Separate from active board:** `~/.openclaw/kanban-board.json`
- **Preserved history:** Tasks remain until permanently deleted

---

## Calendar View

### Overview

Visualize tasks organized by due date in a monthly calendar view.

### Features

- **Month View** - 7×6 grid showing 42 days (previous/current/next month)
- **Color-Coded Dots** - Priority indicators on each day:
  - 🔴 Red = High priority tasks
  - 🟠 Orange = Medium priority
  - 🟢 Green = Low priority
- **View Toggle** - Switch between Kanban board and Calendar view
- **Month Navigation** - ← → buttons to navigate months + "Today" button
- **Day Detail** - Click any day to see tasks due that date
- **Today Highlight** - Current day visually distinguished
- **Cross-Month Visibility** - Previous/next month days shown faded

### Using Calendar View

**Toggle Views:**
- Click "📅 Calendar" button to switch to calendar view
- Click "📋 Kanban" button to return to board view

**Navigate Months:**
- Use ← → arrow buttons to go to previous/next month
- Click "Today" to return to current month

**View Task Details:**
- Click any day with dots to see tasks due that date
- Modal shows task titles, priorities, and columns
- Click task title to open full task modal

**Add Due Dates:**
- Edit any task and set "Due Date" field
- Task appears on calendar on that date
- Color dot shows task priority

---

## SubAgent Orchestration

### Overview

Delegate complex tasks to AI subagents that work in parallel or sequential workflows. The kanban board now includes a complete subagent management system.

### Features

**Task Planning:**
- Automatically break tasks into sub-tasks
- Context-aware workflow pattern detection (7 types)
- Sequential dependency chains (e.g., Analyze → Design → Implement → Test)

**Execution Modes:**
- **Parallel** - All subagents run simultaneously (default)
- **Sequential** - Subagents wait for dependencies to complete

**Context-Aware Workflows:**
The system analyzes task context to determine appropriate workflow:

| Pattern | Detected By | Workflow Sequence |
|---------|-------------|-------------------|
| **Development** | implement, build, feature, create | Analyze → Design → Implement → Test |
| **Research** | research, investigate, explore | Research → Analyze → Summarize → Report |
| **Bugfix** | fix, bug, error, issue | Reproduce → Diagnose → Fix → Verify |
| **Documentation** | document, guide, manual | Outline → Draft → Review → Publish |
| **Data Analysis** | data, metrics, analytics | Collect → Process → Analyze → Visualize |
| **Optimization** | optimize, improve, performance | Measure → Analyze → Optimize → Validate |
| **Integration** | integrate, connect, sync | Plan → Connect → Configure → Validate |

### Using SubAgents

**Plan a Task:**
1. Open task modal (click any card)
2. Click "📋 Plan Task" button
3. System analyzes task and generates sub-tasks
4. Review generated sub-tasks with dependency chains

**Execute SubAgents:**
1. After planning, click "🚀 Execute Plan"
2. Subagents spawn in order based on dependencies
3. Monitor progress in real-time:
   - ⏸️ Pending - Waiting for dependencies
   - ⏳ Executing - Currently running
   - ✅ Completed - Done with results
   - ⬆️ Depends on: [Task] - Sequential dependency

**View Progress:**
- Progress bar shows completion percentage
- Each subtask shows status and result summary
- Kanban card automatically syncs with subagent status
- Comments added with progress updates

**Sequential Handoffs:**
- When a subagent completes, its output is passed to the next
- Next agent receives previous results as context
- Ensures coherent workflow (e.g., Design gets Analysis output)

**Kanban Integration:**
- Task auto-moves to In Progress when subagents start
- Progress comments auto-added to card
- Task moves to Done when all subagents complete
- Tracking shows tokens/cost per subagent execution

### SubAgent Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ⏸️ | Pending | Waiting to start or blocked by dependencies |
| ⏳ | Executing | Currently running |
| ✅ | Completed | Finished successfully |
| ❌ | Failed | Encountered an error |
| ⬆️ | Depends on | Must wait for another task to complete |

### Technical Details

**Storage:**
- Plans: `~/.openclaw/workspace/subagents/tasks.json`
- Agents: `~/.openclaw/workspace/subagents/agents.json`
- Queue: `~/.openclaw/workspace/subagents/spawn-queue.json`

**API Endpoints:**
- `POST /api/subagents/plan` - Create plan for task
- `GET /api/subagents/plans?parentTaskId=` - Get plans for task
- `GET /api/subagents/plans/:planId` - Get plan details
- `POST /api/subagents/spawn` - Spawn subagent for subtask
- `POST /api/subagents/plans/:planId/execute-next` - Trigger sequential execution
- `POST /api/subagents/agents/:id/result` - Report subagent completion

---

## API Reference

All endpoints require authentication except where noted.

### Authentication

#### POST `/api/auth/login`
**Auth:** Not required  
**Purpose:** Login with password, receive token

**Request:**
```json
{
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "e8119c20a9e704bc26cb5b432aa6bb4596083537c139e5d0",
  "message": "Login successful"
}
```

### Tasks (Cards)

#### GET `/api/cards`
**Purpose:** List all tasks organized by column

**Response:**
```json
{
  "backlog": [...],
  "todo": [...],
  "in-progress": [...],
  "done": [...]
}
```

#### POST `/api/cards`
**Purpose:** Create new task (defaults to backlog)

**Request:**
```json
{
  "title": "Task title",
  "description": "Optional description",
  "priority": "low|medium|high",
  "tags": ["tag1", "tag2"],
  "dueDate": "2026-02-15",
  "column": "backlog",
  "schedule": "once|heartbeat|cron",
  "cronExpression": "0 9 * * *"
}
```

**Response:** Created task object with ID

#### PUT `/api/cards/:id`
**Purpose:** Update task details

**Request:** Same as POST (partial updates supported)

#### DELETE `/api/cards/:id`
**Purpose:** Delete task (cancels cron job if exists)

#### PUT `/api/cards/:id/move`
**Purpose:** Move task between columns (triggers auto-execution if moved to in-progress)

**Request:**
```json
{
  "fromColumn": "todo",
  "toColumn": "in-progress"
}
```

#### PUT `/api/cards/:id/reorder`
**Purpose:** Reorder task within same column

**Request:**
```json
{
  "column": "backlog",
  "position": 2
}
```

Position 0 = top of column.

### Archive

#### POST `/api/archive/:id`
**Purpose:** Archive a task (from any column)

**Request (optional):**
```json
{
  "fromColumn": "done"
}
```

Cancels cron job if exists, disables heartbeat recurrence.

#### POST `/api/archive/all`
**Purpose:** Archive all tasks in Done column

Cancels all associated cron jobs.

#### GET `/api/archive`
**Purpose:** List archived tasks

**Query params:**
- `limit` - Max tasks to return (default: 100)

#### POST `/api/archive/:id/restore`
**Purpose:** Restore archived task to Done column

#### DELETE `/api/archive/:id`
**Purpose:** Permanently delete archived task

#### DELETE `/api/archive`
**Purpose:** Clear entire archive (all tasks permanently deleted)

### Execution Monitoring

#### GET `/api/executions/log`
**Purpose:** View auto-execution history

Returns plain text log:
```
[2026-02-09T22:30:00.000Z] Executing task: Review posts (abc-123)
[2026-02-09T22:30:00.123Z] ✅ Injected: Review posts
```

#### GET `/api/executions/queue`
**Purpose:** Check pending tasks (fallback queue)

Usually empty - tasks execute instantly.

#### DELETE `/api/executions/queue`
**Purpose:** Clear task queue after processing

### Calendar

#### GET `/api/calendar/tasks`
**Purpose:** Get tasks organized by due date for calendar view

**Query params:**
- `year` - Year (default: current)
- `month` - Month 0-11 (default: current)

**Response:**
```json
{
  "year": 2026,
  "month": 1,
  "days": {
    "1": [{"id": "...", "title": "Task", "priority": "high", ...}],
    "15": [{"id": "...", "title": "Another task", "priority": "medium", ...}]
  }
}
```

### SubAgents

#### POST `/api/subagents/plan`
**Purpose:** Create a plan with sub-tasks for a task

**Request:**
```json
{
  "parentTaskId": "task-uuid",
  "title": "Task Title",
  "description": "Task description"
}
```

**Response:** Plan object with generated sub-tasks

#### GET `/api/subagents/plans`
**Purpose:** List plans for a parent task

**Query params:**
- `parentTaskId` - Task ID (required)

**Response:** Array of plans

#### GET `/api/subagents/plans/:planId`
**Purpose:** Get detailed plan with sub-tasks and agents

#### POST `/api/subagents/plans/:planId/execute-next`
**Purpose:** Trigger next ready sub-tasks in sequential workflow

#### POST `/api/subagents/spawn`
**Purpose:** Spawn a subagent for a sub-task

**Request:**
```json
{
  "planId": "plan-uuid",
  "subtaskId": "subtask-uuid"
}
```

#### GET `/api/subagents/agents`
**Purpose:** List all active subagents

#### POST `/api/subagents/agents/:id/cancel`
**Purpose:** Cancel a running subagent

#### POST `/api/subagents/agents/:id/result`
**Purpose:** Report subagent completion result

**Request:**
```json
{
  "result": "Task completed successfully"
}
```

### Task Comments

#### POST `/api/cards/:id/comments`
**Purpose:** Add a comment to a task

**Request:**
```json
{
  "text": "Progress update..."
}
```

#### DELETE `/api/cards/:id/comments/:commentId`
**Purpose:** Delete a comment

### Health Check

#### GET `/health`
**Auth:** Not required  
**Purpose:** Service health check

**Response:**
```json
{
  "status": "ok",
  "service": "kanban"
}
```

---

## Production Deployment

### Systemd Service

The kanban server runs as a systemd service for reliability.

**Service file:** `/etc/systemd/system/kanban.service`

**Commands:**
```bash
sudo systemctl start kanban      # Start server
sudo systemctl stop kanban       # Stop server
sudo systemctl restart kanban    # Restart server
sudo systemctl status kanban     # Check status
sudo systemctl enable kanban     # Auto-start on boot
sudo journalctl -u kanban -f     # View live logs
```

**Service configuration:**
```ini
[Unit]
Description=The Big Man's Kanban Board Server
After=network.target

[Service]
Type=simple
User=exedev
WorkingDirectory=/home/exedev/.openclaw/workspace/skills/kanban
ExecStart=/usr/bin/node /home/exedev/.openclaw/workspace/skills/kanban/scripts/server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="KANBAN_PORT=18790"

[Install]
WantedBy=multi-user.target
```

### NGINX Configuration

Add to your NGINX server block:

```nginx
# Kanban static assets and UI
location /kanban {
    proxy_pass http://127.0.0.1:18790;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Kanban API endpoints
location /api/ {
    proxy_pass http://127.0.0.1:18790;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Apply changes:**
```bash
sudo nginx -t              # Test config
sudo systemctl reload nginx # Apply
```

---

## Architecture

### File Structure

```
~/.openclaw/workspace/skills/kanban/
├── SKILL.md                    # OpenClaw skill metadata & instructions
├── README.md                   # This file
├── package.json                # Node.js dependencies
├── scripts/
│   ├── server.js              # Express API server (main entry point)
│   ├── auth-middleware.js     # Token authentication
│   ├── task-executor.js       # Auto-execution logic
│   ├── suggest-improvements.sh # Auto-improvement cron script
│   └── models/
│       └── board.js           # Kanban logic, archive, CRUD
└── assets/
    ├── index.html             # Modern UI (glassmorphism)
    └── app.js                 # Frontend JavaScript

Data files:
~/.openclaw/kanban-board.json       # Active tasks
~/.openclaw/kanban-archive.json     # Archived tasks
~/.openclaw/workspace/kanban-executions.log  # Execution log
```

### Tech Stack

**Backend:**
- **Runtime:** Node.js v22+
- **Framework:** Express.js
- **Storage:** fs-extra (JSON files)
- **Process:** systemd service
- **Port:** 18790 (configurable)

**Frontend:**
- **UI:** Vanilla JavaScript (no framework)
- **Styling:** Tailwind CSS (CDN)
- **Design:** Glassmorphism with gradient theme
- **Features:** Drag-and-drop, animations, responsive

**Integration:**
- **Auth:** OpenClaw gateway token
- **Execution:** OpenClaw cron wake API
- **Cron:** OpenClaw CLI (`openclaw cron`)

### Data Models

**Task Object:**
```json
{
  "id": "uuid-v4",
  "title": "string",
  "description": "string",
  "priority": "low|medium|high",
  "tags": ["string"],
  "column": "backlog|todo|in-progress|done",
  "schedule": "once|heartbeat|cron",
  "cronExpression": "string|null",
  "cronJobId": "string|null",
  "dueDate": "YYYY-MM-DD|null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Archived Task:** Same as Task + `archivedAt` timestamp

### Network Security

- Server binds to `127.0.0.1` (localhost only)
- Not accessible from network directly
- NGINX proxies with HTTPS termination
- CORS configured for credentials (`origin: true, credentials: true`)
- No tokens in URLs (header/cookie only)

---

## Configuration

### Port

**Default:** 18790

**Change port:**

Via systemd:
```bash
sudo systemctl edit kanban

# Add:
[Service]
Environment="KANBAN_PORT=8080"

sudo systemctl daemon-reload
sudo systemctl restart kanban
```

Via command line:
```bash
KANBAN_PORT=8080 node scripts/server.js
```

### Password

**Method 1: OpenClaw Config (recommended)**
```bash
nano ~/.openclaw/openclaw.json

# Add under gateway.auth:
"password": "your-secure-password"
```

**Method 2: Environment Variable**
```bash
export KANBAN_PASSWORD="your-secure-password"
```

Server checks config first, then falls back to environment variable.

### Get Your Token

If you need the raw token for API calls:

```bash
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

---

## Troubleshooting

### "Authentication required" error

**Symptom:** API calls return 401

**Solution:**
- Make sure you're providing the token
- UI: Login with password
- API: Add `Authorization: Bearer <token>` header
- Check token is correct: `cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'`

### Server not starting

**Check status:**
```bash
sudo systemctl status kanban
```

**View logs:**
```bash
sudo journalctl -u kanban -n 50 --no-pager
```

**Common issues:**
- Port 18790 already in use (change `KANBAN_PORT`)
- Missing dependencies (`npm install` in skill directory)
- Permission issues (check file ownership)

### Can't access via NGINX

**Test NGINX config:**
```bash
sudo nginx -t
```

**Check NGINX status:**
```bash
sudo systemctl status nginx
```

**View NGINX logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

### Auto-execution not working

**Check execution log:**
```bash
curl http://localhost:18790/api/executions/log \
  -H "Authorization: Bearer $TOKEN"
```

**Verify server is running:**
```bash
sudo systemctl status kanban
```

**Test manually:**
1. Move task to "In Progress" via API
2. Check logs: `sudo journalctl -u kanban -n 20`
3. Look for: `[Auto-Execute] Task moved to in-progress`

### Cron jobs not appearing

**List OpenClaw cron jobs:**
```bash
openclaw cron list --json | jq '.jobs[] | select(.name | startswith("Kanban:"))'
```

**Check task has cronJobId:**
```bash
curl http://localhost:18790/api/cards -H "Authorization: Bearer $TOKEN" \
  | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.schedule == "cron"))'
```

**If cronJobId is null:**
- Cron job creation failed
- Check server logs: `sudo journalctl -u kanban -n 50`
- Verify cron expression syntax

### Cards not reordering

**Symptoms:**
- Drag appears to work but order doesn't change
- No visual indicator appears

**Solutions:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear localStorage: `localStorage.clear()`
3. Check browser console for errors
4. Verify JavaScript loaded: View source, check `/kanban/app.js`

---

## File Locations

| File | Purpose |
|------|---------|
| `~/.openclaw/workspace/skills/kanban/` | Skill directory |
| `~/.openclaw/kanban-board.json` | Active tasks (board state) |
| `~/.openclaw/kanban-archive.json` | Archived tasks |
| `~/.openclaw/workspace/kanban-executions.log` | Auto-execution history |
| `~/.openclaw/workspace/kanban-task-queue.json` | Fallback queue (rarely used) |
| `~/.openclaw/workspace/HEARTBEAT.md` | Automatic heartbeat behaviors |
| `~/.openclaw/openclaw.json` | OpenClaw config (auth token/password) |
| `/etc/systemd/system/kanban.service` | Systemd service definition |

---

## Development

### Run in Dev Mode

```bash
cd ~/.openclaw/workspace/skills/kanban
node scripts/server.js
```

Server outputs:
```
[Auth] Loaded gateway token from config
[Auth] Password login enabled
🏴 The Big Man's Kanban Server running on http://127.0.0.1:18790/kanban
```

### Watch Logs

```bash
# Systemd logs
sudo journalctl -u kanban -f

# Or if running manually, stdout shows logs
```

### Test Authentication

```bash
TOKEN="your-token"

# Should fail (no token)
curl http://localhost:18790/api/cards
# Returns: {"error":"Authentication required"}

# Should succeed
curl http://localhost:18790/api/cards \
  -H "Authorization: Bearer $TOKEN"
# Returns: {columns...}
```

### Making Changes

1. Edit code in `scripts/` or `assets/`
2. Restart server: `sudo systemctl restart kanban`
3. Hard refresh browser (Ctrl+Shift+R)
4. Test changes
5. Commit: `git add -A && git commit -m "Description" && git push`

---

## Integration with OpenClaw

### Cron Jobs

Kanban automatically integrates with OpenClaw's cron system:

**Creating cron tasks:**
1. Create task with `schedule: "cron"`
2. Provide cron expression (e.g., `0 9 * * *`)
3. Server calls `openclaw cron add` automatically
4. Job appears in OpenClaw Control UI → Cron Jobs

**Viewing cron jobs:**
```bash
openclaw cron list
```

**Deleting tasks:**
- Archive or delete task in kanban
- Associated cron job automatically removed via `openclaw cron rm`

### Auto-Execution Integration

Uses OpenClaw cron wake API:

```bash
curl -X POST http://127.0.0.1:18789/rpc \
  -H "Content-Type: application/json" \
  -d '{"method":"cron.wake","params":{"text":"Task message","mode":"now"}}'
```

Wake events appear in main session immediately.

### Conversational Commands

The Big Man can manage kanban through SKILL.md instructions:

- Reads `~/.openclaw/kanban-board.json` for task data
- Uses API endpoints to create/update/delete/move tasks
- Reports task status in natural language
- Suggests tasks based on context

---

## Best Practices

### Task Organization

**Backlog:**
- Future ideas
- Low-priority items
- Things to do "someday"

**To Do:**
- Ready to start
- Next actions
- Prioritized work

**In Progress:**
- Active work
- Keep this column small (WIP limits)
- Auto-executes when moved here

**Done:**
- Recently completed
- Archive when column gets cluttered
- Keeps recent history visible

### Schedule Type Selection

| Use Case | Schedule Type |
|----------|---------------|
| Build a feature | Once |
| Fix a bug | Once |
| Daily standup reminder | Cron (`0 9 * * 1-5`) |
| Weekly review | Cron (`0 10 * * 1`) |
| Periodic maintenance | Cron or Heartbeat |
| Automatic behavior | HEARTBEAT.md (not kanban) |

### Archive Strategy

**When to archive:**
- Done column has >10 tasks
- Task completed >1 week ago
- Need to reduce visual clutter

**When to permanently delete:**
- Old tasks no longer relevant
- Archived >1 month ago
- Sensitive information to remove

**When to restore:**
- Need to revisit completed work
- Task wasn't actually done
- Want to move to another column

### Priority Guidelines

**High:** Urgent, blocks other work  
**Medium:** Important, should do soon  
**Low:** Nice to have, when time allows

---

## License

MIT

---

## Links

- **GitHub:** https://github.com/therealaibigman/kanban-skill
- **OpenClaw Docs:** https://docs.openclaw.ai
- **Skill Location:** `~/.openclaw/workspace/skills/kanban/`

---

**The Big Man says:** Keep it simple. Keep it sorted. Keep it secure. Nae pish. 💪🏴
