#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const KanbanBoard = require('./models/board');

const app = express();
const PORT = process.env.KANBAN_PORT || 18790;

// Skill directory paths
const SKILL_DIR = path.dirname(__dirname);
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

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

app.post('/api/cards', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardData = req.body;
        const newCard = board.addCard(cardData);
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

app.delete('/api/cards/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const deletedCard = board.deleteCard(cardId);
        res.json(deletedCard);
    } catch (error) {
        console.error(`Error deleting card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

app.put('/api/cards/:id/move', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const { fromColumn, toColumn } = req.body;
        const movedCard = board.moveCard(cardId, fromColumn, toColumn);
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'kanban' });
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
