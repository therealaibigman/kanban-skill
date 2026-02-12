# Calendar View Design Document

## Overview

This document outlines the design and architecture for a Calendar View feature that integrates with the existing kanban board system. The calendar view will provide a visual timeline representation of tasks, allowing users to track deadlines, schedule work, and manage time-based workflows.

## 1. UI Layout Design

### 1.1 View Types

The calendar will support three primary view modes:

#### Month View
- Traditional grid layout (7 columns x 5-6 rows)
- Each cell shows date and task indicators
- Task indicators show priority colors
- Overflow handling with "+X more" for busy days
- Click day to expand full task list

#### Week View
- 7-day horizontal timeline
- Time-based vertical axis (00:00 - 23:59)
- Tasks displayed as blocks positioned by time
- Drag-to-resize for duration adjustment
- Side panel for task details

#### Day View
- Single day focus
- Detailed hourly breakdown
- Full task cards with all metadata
- Quick-add button per time slot
- Timeline sidebar for navigation

### 1.2 Component Layout

```
+----------------------------------------------------------+
|  [Month] [Week] [Day]    [Today]     [<] [Feb 2026] [>]  |
+----------------------------------------------------------+
|                                                          |
|  +------------------+    +----------------------------+  |
|  |                  |    |    Task Details Panel      |  |
|  |   CALENDAR       |    |    - Title                 |  |
|  |   GRID/VIEW      |    |    - Description           |  |
|  |                  |    |    - Due Date/Time         |  |
|  |                  |    |    - Priority              |  |
|  |                  |    |    - Status                |  |
|  |                  |    |    - Assignee              |  |
|  |                  |    |    - Tags                  |  |
|  |                  |    |    - [Edit] [Delete]       |  |
|  |                  |    +----------------------------+  |
|  |                  |    |    Quick Stats             |  |
|  |                  |    |    - Tasks Due: X          |  |
|  |                  |    |    - Overdue: X            |  |
|  |                  |    |    - Completed: X          |  |
|  +------------------+    +----------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

### 1.3 Color Coding System

- **Overdue**: Red background/border
- **Due Today**: Orange highlight
- **Due This Week**: Yellow tint
- **Completed**: Green checkmark, reduced opacity
- **High Priority**: Red indicator dot
- **Medium Priority**: Yellow indicator dot
- **Low Priority**: Blue indicator dot

### 1.4 Responsive Breakpoints

- **Desktop (>1200px)**: Full layout with side panel
- **Tablet (768-1200px)**: Collapsible side panel, larger touch targets
- **Mobile (<768px)**: Stacked layout, swipe between days in week view

## 2. Data Structure

### 2.1 Task Schema Extensions

```typescript
interface CalendarTask {
  // Existing fields from kanban task
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  tags: string[];
  
  // New calendar-specific fields
  dueDate: ISOString;          // ISO 8601 date-time
  startDate?: ISOString;       // For tasks with duration
  duration?: number;           // Minutes (default: 60)
  recurrence?: RecurrenceRule; // See below
  reminders: Reminder[];       // Alert configurations
  calendarColor?: string;      // Override default color
  allDay: boolean;             // Full-day event flag
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;            // Every N days/weeks/months
  endDate?: ISOString;         // Recurrence end (optional)
  count?: number;              // Max occurrences
  daysOfWeek?: number[];       // 0-6 (Sun-Sat) for weekly
  dayOfMonth?: number;         // 1-31 for monthly
}

interface Reminder {
  id: string;
  offset: number;              // Minutes before dueDate
  type: 'notification' | 'email' | 'sms';
  message?: string;
}
```

### 2.2 Calendar View State

```typescript
interface CalendarState {
  viewMode: 'month' | 'week' | 'day';
  currentDate: Date;
  selectedDate?: Date;
  selectedTaskId?: string;
  filters: CalendarFilters;
  
  // Computed/cache
  visibleTasks: CalendarTask[];
  dateRange: { start: Date; end: Date };
}

interface CalendarFilters {
  status: ('todo' | 'in-progress' | 'review' | 'done')[];
  priority: ('low' | 'medium' | 'high')[];
  assignee?: string;
  tags: string[];
  dateRange?: { start: Date; end: Date };
  hideCompleted: boolean;
  showOverdue: boolean;
}
```

### 2.3 API Endpoints

```typescript
// GET /api/calendar/tasks
// Query params: view, startDate, endDate, filters
interface GetCalendarTasksRequest {
  view: 'month' | 'week' | 'day';
  startDate: string;
  endDate: string;
  filters?: CalendarFilters;
}

interface GetCalendarTasksResponse {
  tasks: CalendarTask[];
  metadata: {
    total: number;
    overdue: number;
    dueToday: number;
    completed: number;
  };
}

// POST /api/calendar/tasks
interface CreateCalendarTaskRequest {
  title: string;
  dueDate: string;
  startDate?: string;
  duration?: number;
  // ... other fields
}

// PATCH /api/calendar/tasks/:id
interface UpdateCalendarTaskRequest {
  dueDate?: string;
  startDate?: string;
  duration?: number;
  // ... partial updates
}

// POST /api/calendar/tasks/:id/move
// For drag-and-drop rescheduling
interface MoveTaskRequest {
  newDueDate: string;
  newStartDate?: string;
}
```

## 3. User Interactions

### 3.1 Navigation

| Action | Desktop | Mobile | Result |
|--------|---------|--------|--------|
| Change view | Tab buttons | Dropdown/Bottom nav | Switch month/week/day |
| Next/Previous | Arrow buttons | Swipe gestures | Navigate time |
| Jump to today | "Today" button | "Today" button | Reset to current date |
| Select date | Click cell | Tap cell | Show day details |
| Quick date picker | Calendar icon | Calendar icon | Open date selector |

### 3.2 Task Management

| Action | Method | Behavior |
|--------|--------|----------|
| Create task | Double-click empty cell / "+" button | Open task creation modal |
| View task | Click task indicator | Open task detail panel |
| Edit task | Click "Edit" in detail panel | Open edit modal |
| Delete task | Click "Delete" with confirmation | Remove task, refresh view |
| Move task | Drag-and-drop to new date | Update dueDate, show toast |
| Resize task | Drag edge (week/day view) | Update duration |
| Complete task | Checkbox on task card | Mark done, visual update |

### 3.3 Filtering & Search

- **Status Filter**: Toggle buttons for each status
- **Priority Filter**: Multi-select dropdown
- **Assignee Filter**: Searchable dropdown
- **Tag Filter**: Tag cloud with toggle
- **Date Range**: Presets (Today, This Week, This Month) + custom
- **Search**: Real-time title/description search

### 3.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `M` | Switch to Month view |
| `W` | Switch to Week view |
| `D` | Switch to Day view |
| `T` | Jump to Today |
| `←/→` | Previous/Next (day/week/month) |
| `N` | Create new task |
| `F` | Toggle filters panel |
| `Esc` | Close modal/clear selection |
| `Del` | Delete selected task (with confirm) |

### 3.5 Drag & Drop Behaviors

1. **Month View**: Drag task to different date cell → Updates dueDate, preserves time
2. **Week/Day View**: 
   - Drag task to new time slot → Updates startDate and dueDate
   - Drag bottom edge → Updates duration
3. **Cross-view drag**: Drag from calendar to kanban column → Updates status
4. **Visual feedback**: Ghost preview, drop zone highlighting

### 3.6 Recurring Tasks

- Create recurring task → Generate series based on rule
- Edit single occurrence → Create exception
- Edit all occurrences → Update master rule
- Delete occurrence → Skip that instance
- Delete series → Remove all related tasks

## 4. Integration Points

### 4.1 Kanban Board Sync

- Tasks created in kanban appear in calendar (with default dueDate = today)
- Tasks created in calendar appear in kanban (default status: 'todo')
- Status changes sync bidirectionally
- Due date changes reflect in both views

### 4.2 Notifications System

- Reminders trigger via notification service
- Email reminders for far-future tasks
- Browser notifications for urgent items
- Cron job to check reminders every minute

### 4.3 Export/Import

- Export calendar as .ics (iCalendar format)
- Import external calendars (Google, Outlook)
- Export range selection as PDF report

## 5. Technical Implementation

### 5.1 Frontend Architecture

```
CalendarView/
├── components/
│   ├── MonthView.tsx
│   ├── WeekView.tsx
│   ├── DayView.tsx
│   ├── TaskCard.tsx
│   ├── TaskDetailPanel.tsx
│   ├── CalendarGrid.tsx
│   ├── DateNavigator.tsx
│   ├── FilterPanel.tsx
│   └── QuickStats.tsx
├── hooks/
│   ├── useCalendar.ts
│   ├── useTasks.ts
│   └── useDragAndDrop.ts
├── utils/
│   ├── dateHelpers.ts
│   ├── recurrence.ts
│   └── calendarMath.ts
├── types/
│   └── calendar.ts
└── CalendarView.tsx (main container)
```

### 5.2 State Management

- Use existing kanban state store
- Add calendar slice for view-specific state
- Cache visible tasks to reduce API calls
- Optimistic updates for drag-and-drop

### 5.3 Performance Considerations

- Virtualize task lists for large datasets
- Debounce filter changes (300ms)
- Lazy load task details
- Cache calendar grid calculations
- Web Workers for recurrence expansion

## 6. Future Enhancements

### Phase 2
- Resource calendar (team capacity view)
- Gantt chart view
- Time tracking integration
- Calendar sharing/permissions

### Phase 3
- Natural language date parsing ("next Tuesday")
- AI-powered scheduling suggestions
- Conflict detection (double-booking)
- Calendar analytics dashboard

## 7. File Structure

```
skills/kanban/
├── web/
│   └── src/
│       └── components/
│           └── Calendar/
│               ├── CalendarView.tsx
│               ├── MonthView.tsx
│               ├── WeekView.tsx
│               ├── DayView.tsx
│               ├── TaskCard.tsx
│               ├── TaskDetailPanel.tsx
│               └── index.ts
├── server/
│   └── routes/
│       └── calendar.js
└── docs/
    └── calendar-design.md (this file)
```

---

**Status**: Design Complete  
**Next Steps**: Implementation planning, component development
