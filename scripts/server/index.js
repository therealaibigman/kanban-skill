const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const KanbanBoard = require('../models/board');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Detailed logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    if (req.body) {
        console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

// Serve static files from the client directory
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, {
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.js') {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Routes for Kanban board
app.get('/api/cards', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cards = board.listCards();
        console.log('Fetched cards:', JSON.stringify(cards));
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
        console.log('Added card:', JSON.stringify(newCard));
        res.status(201).json(newCard);
    } catch (error) {
        console.error('Error adding card:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update an existing card
app.put('/api/cards/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const updateData = req.body;
        
        console.log(`Updating card ${cardId}:`, JSON.stringify(updateData));
        
        const updatedCard = board.updateCard(cardId, updateData);
        console.log('Updated card:', JSON.stringify(updatedCard));
        
        res.json(updatedCard);
    } catch (error) {
        console.error(`Error updating card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

// Delete a card
app.delete('/api/cards/:id', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        
        console.log(`Deleting card ${cardId}`);
        
        const deletedCard = board.deleteCard(cardId);
        console.log('Deleted card:', JSON.stringify(deletedCard));
        
        res.json(deletedCard);
    } catch (error) {
        console.error(`Error deleting card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

// Move a card between columns
app.put('/api/cards/:id/move', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        const cardId = req.params.id;
        const { fromColumn, toColumn } = req.body;
        
        console.log(`Moving card ${cardId} from ${fromColumn} to ${toColumn}`);
        
        const movedCard = board.moveCard(cardId, fromColumn, toColumn);
        console.log('Moved card:', JSON.stringify(movedCard));
        
        res.json(movedCard);
    } catch (error) {
        console.error(`Error moving card ${req.params.id}:`, error);
        res.status(404).json({ error: error.message });
    }
});

// New route for processing in-progress tasks
app.post('/api/cards/process-tasks', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        console.log('Processing tasks in the in-progress column');
        
        // Process tasks in the in-progress column
        board.processInProgressTasks();

        const updatedColumns = board.listCards();
        console.log('Updated columns after processing:', JSON.stringify(updatedColumns));
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error processing tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cards/auto-move', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        console.log('Auto-moving tasks from todo to in-progress');
        
        // Move tasks from todo to in-progress
        const todoTasks = board.columns.todo.slice();
        todoTasks.forEach(task => {
            try {
                board.moveCard(task.id, 'todo', 'in-progress');
            } catch (error) {
                console.error(`Failed to move task ${task.id}:`, error);
            }
        });

        const updatedColumns = board.listCards();
        console.log('Updated columns after auto-move:', JSON.stringify(updatedColumns));
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error auto-moving tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reload heartbeat tasks
app.post('/api/heartbeat/reload', (req, res) => {
    try {
        const board = KanbanBoard.getInstance();
        console.log('Reloading heartbeat tasks');
        
        board.loadHeartbeatTasks();
        
        const updatedColumns = board.listCards();
        console.log('Updated columns after heartbeat reload:', JSON.stringify(updatedColumns));
        res.json(updatedColumns);
    } catch (error) {
        console.error('Error reloading heartbeat tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
    console.log('Serving index.html for route:', req.path);
    res.sendFile(path.join(clientDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏴 The Big Man's Kanban Board Server running on port ${PORT}`);
    console.log(`Static files served from: ${clientDir}`);
});

// Ensure any unhandled promise rejections are logged
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});