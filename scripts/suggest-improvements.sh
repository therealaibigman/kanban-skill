#!/bin/bash
# Auto-generate kanban improvement suggestions and add to backlog

TOKEN=$(cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token')
API_URL="http://127.0.0.1:18790/api/cards"

# List of potential improvements (randomized each run)
IMPROVEMENTS=(
  '{"title":"Add bulk task operations","description":"Select multiple tasks for batch move/delete/edit","priority":"high","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add task search and filters","description":"Quick search bar + filter by tags/priority/column","priority":"high","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add archive for completed tasks","description":"Move old done tasks to archive column to reduce clutter","priority":"high","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add subtask support","description":"Break down tasks into smaller checkable steps","priority":"medium","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add dark mode toggle","description":"Light/dark theme switcher for better UX","priority":"medium","tags":["enhancement","ui","kanban"],"column":"backlog"}'
  '{"title":"Add export/import functionality","description":"Export board to JSON/CSV, import from files","priority":"medium","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add time tracking","description":"Track time spent on tasks","priority":"low","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add task comments/notes","description":"Add updates to tasks without editing description","priority":"medium","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add calendar view","description":"See tasks organized by due date","priority":"medium","tags":["enhancement","kanban"],"column":"backlog"}'
  '{"title":"Add GitHub issues sync","description":"Import/export GitHub issues to kanban","priority":"low","tags":["enhancement","integration","kanban"],"column":"backlog"}'
)

# Pick 3 random improvements to suggest
SELECTED=()
for i in {1..3}; do
  idx=$((RANDOM % ${#IMPROVEMENTS[@]}))
  SELECTED+=("${IMPROVEMENTS[$idx]}")
  # Remove selected to avoid duplicates
  unset 'IMPROVEMENTS[$idx]'
  IMPROVEMENTS=("${IMPROVEMENTS[@]}") # Re-index array
done

# Check if improvements already exist (avoid duplicates)
EXISTING_TITLES=$(curl -s "$API_URL" -H "Authorization: Bearer $TOKEN" | jq -r '[.backlog[], .todo[], .["in-progress"][], .done[]] | .[].title')

# Add selected improvements to backlog
COUNT=0
for improvement in "${SELECTED[@]}"; do
  TITLE=$(echo "$improvement" | jq -r '.title')
  
  # Check if task already exists
  if echo "$EXISTING_TITLES" | grep -Fq "$TITLE"; then
    echo "⏭️  Skipping '$TITLE' (already exists)"
    continue
  fi
  
  echo "✅ Adding: $TITLE"
  curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$improvement" > /dev/null
  
  ((COUNT++))
done

echo "📊 Added $COUNT new improvement suggestions to backlog"
echo "🏴 The Big Man says: Kanban improvements queued. Nae pish, pure enhancements."
