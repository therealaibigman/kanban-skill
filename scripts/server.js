#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const KanbanBoard = require('./models/board');
const TaskExecutor = require('./task-executor');
const AuthMiddleware = require('./auth-middleware');

const app = express();
const PORT = process.env.KANBAN_PORT || 18790;

// Helper: Create OpenClaw cron job
async function createOpenClawCronJob(card) {
    const eventText = `🚧 Scheduled task from Kanban:\n\n**${card.title}**\n${card.description || ''}\n\nPriority: ${card.priority}\nSchedule: ${card.cronExpression}`;
    
    try {
        // Use OpenClaw CLI to create cron job
        const cmd = `openclaw cron add \
            --name "Kanban: ${card.title.replace(/"/g, '\\"')}" \
            --cron "${card.cronExpression}" \
            --system-event "${eventText.replace(/"/g, '\\"').replace(/\n/g, ' ')}" \
            --session main \
            --json | jq -r '.jobId'`;
        
        const { stdout, stderr } = await execPromise(cmd);
        
        if (stderr) {
            console.error('[Cron] stderr:', stderr);
        }
        
        const jobId = stdout.trim();
        
        if (!jobId || jobId === 'null') {
            throw new Error('Failed to get jobId from cron add command');
        }
        
        console.log(`[Cron] Created job ${jobId} for task ${card.id}`);
        return jobId;
    } catch (error) {
        console.error('[Cron] Failed to create job:', error);
        throw error;
    }
}

// Helper: Delete OpenClaw cron job
async function deleteOpenClawCronJob(jobId) {
    try {
        const cmd = `openclaw cron rm ${jobId}`;
        await execPromise(cmd);
        console.log(`[Cron] Deleted job ${jobId}`);
    } catch (error) {
        console.error('[Cron] Failed to delete job:', error);
    }
}

// Skill directory paths
const SKILL_DIR = path.dirname(__dirname);
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');

// Initialize auth
const auth = new AuthMiddleware();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Login endpoint (before auth middleware)
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }
    
    const result = auth.validatePassword(password);
    
    if (result.valid) {
        console.log('[Auth] Successful password login');
        res.json({ 
            success: true, 
            token: result.token,
            message: 'Login successful'
        });
    } else {
        console.warn('[Auth] Failed password login attempt');
        res.status(401).json({ 
            error: result.error || 'Invalid password'
        });
    }
});

// Authentication middleware - protect all routes except health check and login
app.use(auth.middleware());

// Serve static assets
app.use('/kanban', express.static(ASSETS_DIR, {
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.js') {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// API Routes
app.get('/api/cards', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cards = board.listCards();
        res.json(cards);
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cards', async (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardData = req.body;
        const newCard = board.addCard(cardData);
        
        // If cron schedule, create OpenClaw cron job
        if (newCard.schedule === 'cron' && newCard.cronExpression) {
            try {
                const cronJobId = await createOpenClawCronJob(newCard);
                newCard.cronJobId = cronJobId;
                board.updateCard(newCard.id, { cronJobId });
            } catch (error) {
                console.error('Failed to create cron job:', error);
                // Task is still created, just without cron job
            }
        }
        
        res.status(201).json(newCard);
    } catch (error) {
        console.error('Error adding card:', error);
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/cards/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const updateData = req.body;
        const updatedCard = board.updateCard(cardId, updateData);
        res.json(updatedCard);
    } catch (error) {
        console.error(`Error updating card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

app.delete('/api/cards/:id', async (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        
        // Get card first to check for cron job
        let card = null;
        for (const col in board.columns) {
            card = board.columns[col].find(c => c.id === cardId);
            if (card) break;
        }
        
        // Delete cron job if exists
        if (card && card.cronJobId) {
            await deleteOpenClawCronJob(card.cronJobId);
        }
        
        const deletedCard = board.deleteCard(cardId);
        res.json(deletedCard);
    } catch (error) {
        console.error(`Error deleting card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

app.put('/api/cards/:id/move', async (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const { fromColumn, toColumn } = req.body;
        const movedCard = board.moveCard(cardId, fromColumn, toColumn);
        
        // Auto-execute if moved to "in-progress"
        if (toColumn === 'in-progress') {
            console.log(`[Auto-Execute] Task moved to in-progress: ${movedCard.title}`);
            const executor = new TaskExecutor();
            
            // Execute async, don't wait for response
            executor.executeTask(movedCard).catch(err => {
                console.error('[Auto-Execute] Error:', err);
            });
        }
        
        res.json(movedCard);
    } catch (error) {
        console.error(`Error moving card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

app.post('/api/cards/process-tasks', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        board.processInProgressTasks();
        const updatedColumns = board.listCards();
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error processing tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cards/auto-move', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const todoTasks = board.columns.todo.slice();
        todoTasks.forEach(task => {
            try {
                board.moveCard(task.id, 'todo', 'in-progress');
            } catch (error) {
                console.error(`Failed to move task ${task.id}:`, error);
            }
        });
        const updatedColumns = board.listCards();
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error auto-moving tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/heartbeat/reload', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        board.loadHeartbeatTasks();
        const updatedColumns = board.listCards();
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error reloading heartbeat tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/heartbeat/sync', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        board.syncToHeartbeat();
        res.json({ success: true, message: 'Synced to HEARTBEAT.md' });
    } catch (error) {
        console.error('Error syncing to heartbeat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Archive endpoints
app.post('/api/archive/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const archivedCard = board.archiveCard(cardId);
        res.json(archivedCard);
    } catch (error) {
        console.error('Error archiving card:', error);
        res.status(404).json({ error: error.message });
    }
});

app.post('/api/archive/all', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const result = board.archiveAllDone();
        res.json(result);
    } catch (error) {
        console.error('Error archiving all:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/archive', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const limit = parseInt(req.query.limit) || 100;
        const archive = board.getArchive(limit);
        res.json(archive);
    } catch (error) {
        console.error('Error fetching archive:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/archive/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const deletedCard = board.permanentlyDelete(cardId);
        res.json(deletedCard);
    } catch (error) {
        console.error('Error permanently deleting:', error);
        res.status(404).json({ error: error.message });
    }
});

app.delete('/api/archive', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const result = board.clearArchive();
        res.json(result);
    } catch (error) {
        console.error('Error clearing archive:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'kanban' });
});

// Get execution log
app.get('/api/executions/log', async (req, res) => {
    try {
        const executor = new TaskExecutor();
        const log = await executor.getExecutionLog();
        res.type('text/plain').send(log);
    } catch (error) {
        console.error('Error fetching execution log:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get pending task queue
app.get('/api/executions/queue', async (req, res) => {
    try {
        const fs = require('fs-extra');
        const path = require('path');
        const queueFile = path.join(process.env.HOME, '.openclaw', 'workspace', 'kanban-task-queue.json');
        
        if (await fs.pathExists(queueFile)) {
            const queue = await fs.readJson(queueFile);
            res.json(queue);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching task queue:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear task queue (after processing)
app.delete('/api/executions/queue', async (req, res) => {
    try {
        const fs = require('fs-extra');
        const path = require('path');
        const queueFile = path.join(process.env.HOME, '.openclaw', 'workspace', 'kanban-task-queue.json');
        
        if (await fs.pathExists(queueFile)) {
            await fs.remove(queueFile);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing task queue:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html at /kanban
app.get('/kanban', (req, res) => {
    res.sendFile(path.join(ASSETS_DIR, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🏴 The Big Man's Kanban Server running on http://127.0.0.1:${PORT}/kanban`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
