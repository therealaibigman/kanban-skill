/**
 * Calendar View Type Definitions
 * 
 * TypeScript interfaces and types for the Calendar View feature
 */

// ============================================================================
// Enums
// ============================================================================

export type CalendarViewMode = 'month' | 'week' | 'day';

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReminderType = 'notification' | 'email' | 'sms';

// ============================================================================
// Core Task Types
// ============================================================================

export interface CalendarTask {
  /** Unique identifier */
  id: string;
  
  /** Task title */
  title: string;
  
  /** Task description (supports markdown) */
  description?: string;
  
  /** Current status */
  status: TaskStatus;
  
  /** Priority level */
  priority: TaskPriority;
  
  /** Assigned user ID */
  assignee?: string;
  
  /** Associated tags */
  tags: string[];
  
  /** Due date/time (ISO 8601) */
  dueDate: string;
  
  /** Start date/time for tasks with duration (ISO 8601) */
  startDate?: string;
  
  /** Duration in minutes (default: 60) */
  duration?: number;
  
  /** Recurrence rule for repeating tasks */
  recurrence?: RecurrenceRule;
  
  /** List of reminders */
  reminders: Reminder[];
  
  /** Custom color override (hex) */
  calendarColor?: string;
  
  /** All-day event flag */
  allDay: boolean;
  
  /** Parent task ID for subtasks */
  parentId?: string;
  
  /** Subtask IDs */
  subtaskIds?: string[];
  
  /** Created timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  /** Completed timestamp */
  completedAt?: string;
}

export interface RecurrenceRule {
  /** How often the task repeats */
  frequency: RecurrenceFrequency;
  
  /** Repeat every N frequency units (default: 1) */
  interval: number;
  
  /** When recurrence ends (optional) */
  endDate?: string;
  
  /** Maximum number of occurrences (optional) */
  count?: number;
  
  /** Days of week (0=Sunday, 6=Saturday) for weekly recurrence */
  daysOfWeek?: number[];
  
  /** Day of month (1-31) for monthly recurrence */
  dayOfMonth?: number;
  
  /** Month (1-12) for yearly recurrence */
  monthOfYear?: number;
  
  /** Exception dates (ISO 8601 dates to skip) */
  exceptions?: string[];
}

export interface Reminder {
  /** Unique identifier */
  id: string;
  
  /** Minutes before dueDate to trigger */
  offset: number;
  
  /** How to notify */
  type: ReminderType;
  
  /** Custom message (optional) */
  message?: string;
  
  /** Whether reminder has been triggered */
  triggered?: boolean;
}

// ============================================================================
// Calendar State Types
// ============================================================================

export interface CalendarState {
  /** Current view mode */
  viewMode: CalendarViewMode;
  
  /** Currently focused date */
  currentDate: Date;
  
  /** Selected date (for detail view) */
  selectedDate?: Date;
  
  /** Selected task ID */
  selectedTaskId?: string;
  
  /** Active filters */
  filters: CalendarFilters;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error?: string;
}

export interface CalendarFilters {
  /** Filter by status */
  status: TaskStatus[];
  
  /** Filter by priority */
  priority: TaskPriority[];
  
  /** Filter by assignee */
  assignee?: string;
  
  /** Filter by tags */
  tags: string[];
  
  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  /** Hide completed tasks */
  hideCompleted: boolean;
  
  /** Show overdue tasks */
  showOverdue: boolean;
  
  /** Text search query */
  searchQuery?: string;
}

export interface CalendarViewData {
  /** Tasks visible in current view */
  tasks: CalendarTask[];
  
  /** View metadata */
  metadata: CalendarMetadata;
  
  /** Date range for current view */
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface CalendarMetadata {
  /** Total task count */
  total: number;
  
  /** Number of overdue tasks */
  overdue: number;
  
  /** Number due today */
  dueToday: number;
  
  /** Number completed */
  completed: number;
  
  /** Number in progress */
  inProgress: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface GetCalendarTasksRequest {
  view: CalendarViewMode;
  startDate: string;
  endDate: string;
  filters?: CalendarFilters;
}

export interface GetCalendarTasksResponse {
  tasks: CalendarTask[];
  metadata: CalendarMetadata;
}

export interface CreateCalendarTaskRequest {
  title: string;
  dueDate: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tags?: string[];
  startDate?: string;
  duration?: number;
  recurrence?: RecurrenceRule;
  reminders?: Omit<Reminder, 'id'>[];
  calendarColor?: string;
  allDay?: boolean;
}

export interface UpdateCalendarTaskRequest {
  title?: string;
  dueDate?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tags?: string[];
  startDate?: string;
  duration?: number;
  recurrence?: RecurrenceRule;
  reminders?: Reminder[];
  calendarColor?: string;
  allDay?: boolean;
}

export interface MoveTaskRequest {
  newDueDate: string;
  newStartDate?: string;
}

// ============================================================================
// Component Prop Types
// ============================================================================

export interface CalendarViewProps {
  /** Initial view mode */
  initialView?: CalendarViewMode;
  
  /** Initial date to focus */
  initialDate?: Date;
  
  /** Callback when task is selected */
  onTaskSelect?: (task: CalendarTask) => void;
  
  /** Callback when date is selected */
  onDateSelect?: (date: Date) => void;
  
  /** Callback when view changes */
  onViewChange?: (view: CalendarViewMode) => void;
  
  /** Enable drag and drop */
  enableDragDrop?: boolean;
  
  /** Show side panel */
  showSidePanel?: boolean;
}

export interface MonthViewProps {
  /** Current date (determines which month to show) */
  currentDate: Date;
  
  /** Tasks to display */
  tasks: CalendarTask[];
  
  /** Selected date */
  selectedDate?: Date;
  
  /** Selected task ID */
  selectedTaskId?: string;
  
  /** Callback when day is clicked */
  onDayClick?: (date: Date) => void;
  
  /** Callback when task is clicked */
  onTaskClick?: (task: CalendarTask) => void;
  
  /** Callback when task is dropped on a new date */
  onTaskMove?: (taskId: string, newDate: Date) => void;
  
  /** Enable drag and drop */
  enableDragDrop?: boolean;
}

export interface WeekViewProps {
  /** Current date (determines which week to show) */
  currentDate: Date;
  
  /** Tasks to display */
  tasks: CalendarTask[];
  
  /** Selected task ID */
  selectedTaskId?: string;
  
  /** Callback when time slot is clicked */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  
  /** Callback when task is clicked */
  onTaskClick?: (task: CalendarTask) => void;
  
  /** Callback when task is moved/resized */
  onTaskMove?: (taskId: string, newStartDate: string, newDuration: number) => void;
  
  /** Enable drag and drop */
  enableDragDrop?: boolean;
}

export interface DayViewProps {
  /** Current date (which day to show) */
  currentDate: Date;
  
  /** Tasks to display */
  tasks: CalendarTask[];
  
  /** Selected task ID */
  selectedTaskId?: string;
  
  /** Callback when time slot is clicked */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  
  /** Callback when task is clicked */
  onTaskClick?: (task: CalendarTask) => void;
  
  /** Callback when task is moved/resized */
  onTaskMove?: (taskId: string, newStartDate: string, newDuration: number) => void;
  
  /** Enable drag and drop */
  enableDragDrop?: boolean;
}

export interface TaskCardProps {
  /** Task data */
  task: CalendarTask;
  
  /** Whether this task is selected */
  isSelected?: boolean;
  
  /** Display mode (compact for month, full for week/day) */
  displayMode?: 'compact' | 'full';
  
  /** Click handler */
  onClick?: (task: CalendarTask) => void;
  
  /** Drag start handler */
  onDragStart?: (task: CalendarTask) => void;
  
  /** Complete toggle handler */
  onCompleteToggle?: (taskId: string, completed: boolean) => void;
}

export interface TaskDetailPanelProps {
  /** Task to display (undefined if no selection) */
  task?: CalendarTask;
  
  /** Close panel handler */
  onClose?: () => void;
  
  /** Edit task handler */
  onEdit?: (task: CalendarTask) => void;
  
  /** Delete task handler */
  onDelete?: (taskId: string) => void;
  
  /** Complete toggle handler */
  onCompleteToggle?: (taskId: string, completed: boolean) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  tasks: CalendarTask[];
}

export interface CalendarWeek {
  days: CalendarDay[];
  weekNumber: number;
}

export interface TimeSlot {
  hour: number;
  minute: number;
  date: Date;
  tasks: CalendarTask[];
}

export interface DragDropState {
  isDragging: boolean;
  draggedTaskId?: string;
  dragSource?: CalendarViewMode;
  dropTarget?: {
    date: Date;
    hour?: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface CalendarEvent {
  type: 'task-created' | 'task-updated' | 'task-deleted' | 'task-moved';
  task: CalendarTask;
  previousDate?: string;
  timestamp: string;
}

export type CalendarEventHandler = (event: CalendarEvent) => void;

// ============================================================================
// Configuration Types
// ============================================================================

export interface CalendarConfig {
  /** First day of week (0=Sunday, 1=Monday) */
  firstDayOfWeek: number;
  
  /** Default task duration in minutes */
  defaultTaskDuration: number;
  
  /** Default reminder offset in minutes */
  defaultReminderOffset: number;
  
  /** Business hours */
  businessHours: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  
  /** Time slot granularity in minutes */
  timeSlotInterval: number;
  
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts: boolean;
  
  /** Color theme */
  theme: {
    overdue: string;
    dueToday: string;
    highPriority: string;
    mediumPriority: string;
    lowPriority: string;
    completed: string;
  };
}
