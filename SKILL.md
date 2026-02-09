---
name: kanban
description: Visual kanban board for task management with auto-execution, archive system, and cron scheduling. Use when managing tasks, tracking progress, viewing the kanban board, adding/updating/deleting/archiving tasks, scheduling cron jobs, reordering cards, or answering questions about current tasks and their status.
---

# Kanban Task Management Skill

A production-ready visual kanban board with auto-execution, archive system, password authentication, and intelligent scheduling.

## What This Skill Provides

- **Modern Web UI**: Glassmorphism dashboard at `http://localhost:18790/kanban`
- **Auto-Execution**: Tasks moved to "In Progress" trigger instant execution
- **Archive System**: Archive completed tasks, restore or permanently delete
- **Smart Scheduling**: Once, Heartbeat, or Cron-scheduled tasks
- **REST API**: Full programmatic control
- **Conversational Interface**: Manage tasks through natural language
- **Card Reordering**: Drag cards up/down within columns to prioritize

## Server Management

The kanban server runs as a systemd service.

### Check Status

```bash
sudo systemctl status kanban
```

### Start/Stop

```bash
sudo systemctl start kanban
sudo systemctl stop kanban
sudo systemctl restart kanban
```

### View Logs

```bash
sudo journalctl -u kanban -f
```

If server is not running, start it:

```bash
sudo systemctl start kanban.service
```

## Authentication

All API endpoints (except `/health`, `/api/auth/login`, and `/kanban/*` static assets) require the OpenClaw gateway token.

**Get the token:**
```bash
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

**Use in API calls:**
```bash
TOKEN="token-here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:18790/api/cards
```

**UI Access:**
- User enters password at login screen
- Server validates and returns token
- Token stored in browser localStorage

## Conversational Task Management

### Viewing Tasks

Read the kanban data file to answer questions:

```bash
cat ~/.openclaw/kanban-board.json | jq
```

**Parse the JSON and present organized summaries:**

**Examples:**
- "What's on my kanban board?" → Show all tasks by column
- "What tasks are in progress?" → Filter `.["in-progress"]`
- "Show me my backlog" → List `.backlog` tasks
- "How many tasks do I have?" → Count all non-archived tasks
- "What's my highest priority task?" → Filter by priority: high

**Response format:**
```
The Big Man sees {count} tasks:

**Backlog ({count}):**
- Task 1 (priority: high)
- Task 2 (priority: medium)

**In Progress ({count}):**
- Task 3 (priority: high) ⏰ 0 9 * * *
```

### Adding Tasks

Use the API to create tasks:

```bash
TOKEN=$(cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token')

curl -X POST http://localhost:18790/api/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task title",
    "description": "Details",
    "priority": "high|medium|low",
    "tags": ["tag1", "tag2"],
    "column": "backlog",
    "schedule": "once|heartbeat|cron",
    "cronExpression": "0 9 * * *"
  }'
```

**Examples:**
- "Add a task: Review MoltHub posts" → Create with default settings
- "Create high priority task: Fix sync bug" → Set priority to "high"
- "Add cron task to check updates daily at 9 AM" → schedule: "cron", cronExpression: "0 9 * * *"

**Task defaults:**
- Column: backlog
- Priority: medium
- Schedule: once
- Tags: [] (empty)

### Moving Tasks

**Between columns:**

```bash
# Get task ID first by reading kanban-board.json
# Then move it:
curl -X PUT http://localhost:18790/api/cards/{id}/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromColumn": "todo", "toColumn": "in-progress"}'
```

**Examples:**
- "Move 'Review posts' to in progress" → Find task by title, get ID, call move endpoint
- "Mark 'Fix bug' as done" → Move to "done" column
- "Start working on X" → Move to "in-progress" (triggers auto-execution)

**Auto-execution trigger:**
When a task is moved to "in-progress", the server automatically sends a wake event to OpenClaw's main session with the task details.

### Reordering Tasks

**Within same column:**

```bash
curl -X PUT http://localhost:18790/api/cards/{id}/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"column": "backlog", "position": 0}'
```

Position 0 = top of column.

**Examples:**
- "Move X to top of backlog" → position: 0
- "Prioritize task Y in todo" → Move to position 0 in todo column

### Updating Tasks

```bash
curl -X PUT http://localhost:18790/api/cards/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "priority": "high",
    "tags": ["urgent"]
  }'
```

Partial updates supported - only include fields to change.

### Archiving Tasks

**Individual task:**
```bash
curl -X POST http://localhost:18790/api/archive/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**All done tasks:**
```bash
curl -X POST http://localhost:18790/api/archive/all \
  -H "Authorization: Bearer $TOKEN"
```

**Examples:**
- "Archive all done tasks" → Call `/api/archive/all`
- "Clean up my done column" → Same as above
- "Archive task X" → Find by title, call `/api/archive/{id}`

**What happens when archiving:**
- Task removed from active board
- Moved to archive file
- Cron job cancelled (if exists)
- Heartbeat recurrence disabled (if heartbeat task)

### Viewing Archive

```bash
curl http://localhost:18790/api/archive \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Present archived tasks:**
- Show title, archived date, original priority
- Group by archived date
- Show count

### Restoring Tasks

```bash
curl -X POST http://localhost:18790/api/archive/{id}/restore \
  -H "Authorization: Bearer $TOKEN"
```

**Examples:**
- "Restore task X from archive" → Find in archive, call restore endpoint
- Task moves back to "done" column

### Deleting Tasks

**From active board:**
```bash
curl -X DELETE http://localhost:18790/api/cards/{id} \
  -H "Authorization: Bearer $TOKEN"
```

Cancels cron job if exists.

**From archive (permanent):**
```bash
curl -X DELETE http://localhost:18790/api/archive/{id} \
  -H "Authorization: Bearer $TOKEN"
```

Cannot be undone.

## Task Scheduling Types

### 1. Once (Default)

**Purpose:** Standard one-time task

**Behavior:**
- Appears in kanban board
- Tracked through columns
- Completes when done or archived

**Use for:**
- Features to build
- Bugs to fix  
- One-off work

### 2. Heartbeat 💓

**Purpose:** Recurring task you want to track visually in kanban

**Behavior:**
- Shows with 💓 icon
- Tagged with "heartbeat"
- Can move through columns like normal task
- If archived, recurrence stops (converts to "once")

**Use for:**
- Regular reviews you want visible
- Periodic maintenance you want to track
- Recurring work with completion tracking

**Note:** Different from HEARTBEAT.md automatic behaviors. Heartbeat schedule type is for trackable recurring tasks.

### 3. Cron ⏰

**Purpose:** Task that runs on a specific schedule

**Behavior:**
- Shows with ⏰ icon and cron expression
- Creates OpenClaw cron job automatically
- Cron job fires system event at scheduled time
- Visible in OpenClaw Control UI → Cron Jobs panel
- If archived or deleted, cron job is cancelled

**Cron expressions:**
- `0 9 * * *` - Daily at 9 AM UTC
- `0 9 * * 1-5` - Weekdays at 9 AM
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 10 * * 1` - Monday at 10 AM

**System event format:**
```
🚧 Scheduled task from Kanban:

**Task Title**
Description

Priority: high
Schedule: 0 9 * * *
```

The Big Man receives this and can execute the task.

## Auto-Execution System

### How It Works

When a task is moved to "In Progress" column:

1. Server detects column change
2. Builds execution message from task data
3. Sends wake event via OpenClaw cron API
4. Main session receives system event immediately
5. The Big Man executes the task

**Message format:**
```
🚧 Auto-executing from Kanban:

**Task:** Task title
**Details:** Description
**Tags:** tag1, tag2

Task title
```

### Monitoring Execution

**Check execution log:**
```bash
curl http://localhost:18790/api/executions/log \
  -H "Authorization: Bearer $TOKEN"
```

**Log format:**
```
[2026-02-09T22:00:00.000Z] Executing task: Review posts (abc-123)
[2026-02-09T22:00:00.123Z] ✅ Injected: Review posts
```

### Queue Fallback

If wake API fails, tasks queue in `kanban-task-queue.json`. The Big Man checks this during heartbeats, but it's rarely needed - auto-execution works instantly in normal operation.

## Archive System

### Purpose

Archive completed tasks to keep Done column tidy while preserving history.

### Operations

**Archive individual task:**
- From edit modal: Click "📦 Archive" button
- Via API: `POST /api/archive/{id}`
- Can archive from any column (not just done)

**Archive all done:**
- From archive modal: Click "Archive All Done"
- Via API: `POST /api/archive/all`
- Batch operation on entire Done column

**View archive:**
- Click "📦 Archive" button in header
- Via API: `GET /api/archive`
- Shows tasks with archived dates

**Restore:**
- Click "↩️ Restore" in archive modal
- Via API: `POST /api/archive/{id}/restore`
- Moves task back to Done column

**Permanent delete:**
- Click "🗑️ Delete" in archive modal
- Via API: `DELETE /api/archive/{id}`
- Cannot be undone

**Clear archive:**
- Click "Clear Archive" in archive modal
- Via API: `DELETE /api/archive`
- Deletes all archived tasks permanently

### Automatic Cleanup

**When archiving:**
- Cron tasks → OpenClaw cron job cancelled automatically
- Heartbeat tasks → Schedule changed to "once" (stops recurrence)
- Once tasks → No special handling

This prevents archived tasks from recurring or firing scheduled events.

## Common Patterns

### Daily Task Review

```bash
# View active tasks
cat ~/.openclaw/kanban-board.json | jq

# Summarize for user
"The Big Man sees {backlog_count} in backlog, {todo_count} ready to start, {in_progress_count} active."
```

### Quick Task Creation

When user says "remind me to X":

```bash
curl -X POST http://localhost:18790/api/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"X\", \"column\": \"todo\"}"
```

### Archive Cleanup

When done column has many tasks:

```bash
curl -X POST http://localhost:18790/api/archive/all \
  -H "Authorization: Bearer $TOKEN"
```

Then report: "The Big Man archived {count} completed tasks."

### Cron Task Management

**List cron tasks:**
```bash
cat ~/.openclaw/kanban-board.json | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.schedule == "cron"))'
```

**Show with details:**
- Title
- Cron expression
- Next run time (get from OpenClaw: `openclaw cron list`)
- Priority

### Finding Specific Tasks

**By priority:**
```bash
cat ~/.openclaw/kanban-board.json | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.priority == "high"))'
```

**By tag:**
```bash
cat ~/.openclaw/kanban-board.json | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.tags | contains(["enhancement"])))'
```

**By schedule type:**
```bash
cat ~/.openclaw/kanban-board.json | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.schedule == "cron"))'
```

## API Quick Reference

### Authentication
- `POST /api/auth/login` - Password login (returns token)

### Tasks
- `GET /api/cards` - List all tasks
- `POST /api/cards` - Create task
- `PUT /api/cards/:id` - Update task
- `DELETE /api/cards/:id` - Delete task (cancels cron)
- `PUT /api/cards/:id/move` - Move between columns (may trigger auto-execution)
- `PUT /api/cards/:id/reorder` - Reorder within column

### Archive
- `POST /api/archive/:id` - Archive task (cancels cron)
- `POST /api/archive/all` - Archive all done tasks
- `GET /api/archive` - List archived tasks
- `POST /api/archive/:id/restore` - Restore to done column
- `DELETE /api/archive/:id` - Permanently delete
- `DELETE /api/archive` - Clear entire archive

### Monitoring
- `GET /api/executions/log` - View auto-execution history
- `GET /api/executions/queue` - Check pending tasks (fallback)
- `DELETE /api/executions/queue` - Clear queue
- `GET /health` - Health check (no auth)

## Data Files

| File | Purpose |
|------|---------|
| `~/.openclaw/kanban-board.json` | Active tasks by column |
| `~/.openclaw/kanban-archive.json` | Archived tasks |
| `~/.openclaw/workspace/kanban-executions.log` | Execution history |
| `~/.openclaw/workspace/kanban-task-queue.json` | Fallback queue |

## Task Structure

Each task has:

```json
{
  "id": "uuid-v4",
  "title": "string",
  "description": "string",
  "priority": "low|medium|high",
  "tags": ["array"],
  "column": "backlog|todo|in-progress|done",
  "schedule": "once|heartbeat|cron",
  "cronExpression": "string|null",
  "cronJobId": "string|null",
  "dueDate": "YYYY-MM-DD|null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

Archived tasks also have `archivedAt` timestamp.

## Responding to Task Questions

### "What's on my board?"

1. Read `~/.openclaw/kanban-board.json`
2. Parse all columns
3. Group by column
4. Format response with counts and task names
5. Highlight high-priority or overdue tasks

### "Add a task: X"

1. Extract task title from user message
2. Infer priority from context (urgent/asap → high)
3. Infer column (default: backlog)
4. Call POST /api/cards with details
5. Confirm creation

### "What should I work on?"

1. Read kanban-board.json
2. Look at "todo" column
3. Filter high-priority tasks
4. Consider due dates
5. Suggest top 3 tasks

### "Archive my done tasks"

1. Call POST /api/archive/all
2. Report count archived
3. Mention if any cron jobs were cancelled

## Integration with OpenClaw

### Cron Jobs

**Automatic creation:**
- User creates task with `schedule: "cron"`
- Server calls `openclaw cron add` with task details
- Job ID stored in `task.cronJobId`
- Job appears in OpenClaw Control UI

**Viewing:**
```bash
openclaw cron list --json | jq '.jobs[] | select(.name | startswith("Kanban:"))'
```

**Automatic cleanup:**
- Archive task → `openclaw cron rm {cronJobId}`
- Delete task → `openclaw cron rm {cronJobId}`

### Auto-Execution

**Wake API:**
```bash
curl -X POST http://127.0.0.1:18789/rpc \
  -H "Content-Type: application/json" \
  -d '{"method":"cron.wake","params":{"text":"Task message","mode":"now"}}'
```

The kanban server uses this to trigger task execution instantly.

### HEARTBEAT.md Relationship

**Important:** HEARTBEAT.md is for automatic behaviors (e.g., "Update MEMORY.md"), NOT trackable tasks.

**Clean separation:**
- **HEARTBEAT.md** = Automatic recurring actions (no kanban tracking)
- **Kanban** = Explicit trackable tasks (visible progress)

**No sync needed.**

## Troubleshooting

### Server Not Running

**Check:**
```bash
sudo systemctl status kanban
```

**Start:**
```bash
sudo systemctl start kanban
```

**Logs:**
```bash
sudo journalctl -u kanban -n 50
```

### Auth Errors

**API returns 401/403:**
- Verify token: `cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'`
- Check header format: `Authorization: Bearer {token}`
- For UI: Login with password

### Auto-Execution Not Working

**Check execution log:**
```bash
curl http://localhost:18790/api/executions/log \
  -H "Authorization: Bearer $TOKEN"
```

**Look for:**
- Task execution entries with timestamps
- ✅ or ❌ status indicators

**Verify server logs:**
```bash
sudo journalctl -u kanban | grep Auto-Execute
```

### Cron Jobs Not Creating

**Check task has cronJobId:**
```bash
cat ~/.openclaw/kanban-board.json | jq '[.backlog[], .todo[], .["in-progress"][], .done[]] | map(select(.schedule == "cron")) | .[].cronJobId'
```

**If null:**
- Server logs may show error: `sudo journalctl -u kanban -n 50`
- Verify cron expression syntax
- Test manually: `openclaw cron add --cron "0 9 * * *" --system-event "test"`

### Cards Not Appearing

**Hard refresh:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)

**Clear localStorage:**
```javascript
localStorage.clear()
```

**Check data file:**
```bash
cat ~/.openclaw/kanban-board.json | jq
```

## Notes

- The server must be running for all operations
- Web UI updates every 5 seconds automatically
- Token stored in browser localStorage persists across sessions
- Archive is separate from active board (different file)
- Cron jobs integrate directly with OpenClaw's cron system
- Auto-execution uses OpenClaw's wake mechanism
- All timestamps in ISO 8601 format (UTC)
- Task IDs are UUID v4 (e.g., "a1b2c3d4-e5f6-...")
