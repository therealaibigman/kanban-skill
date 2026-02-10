const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class KanbanBoard {
    constructor() {
        this.dataFile = path.join(process.env.HOME, '.openclaw', 'kanban-board.json');
        this.archiveFile = path.join(process.env.HOME, '.openclaw', 'kanban-archive.json');
        this.heartbeatFile = path.join(process.env.HOME, '.openclaw', 'workspace', 'HEARTBEAT.md');
        this.columns = {
            backlog: [],
            todo: [],
            'in-progress': [],
            done: []
        };
        this.archive = [];
        this.loadBoard();
        this.loadArchive();
    }

    // Singleton pattern
    static instance = null;
    static getInstance() {
        if (!KanbanBoard.instance) {
            KanbanBoard.instance = new KanbanBoard();
        }
        return KanbanBoard.instance;
    }

    loadBoard() {
        try {
            // Initialize with an empty board if no existing data
            if (!fs.existsSync(this.dataFile)) {
                this.saveBoard();
            } else {
                // Read existing board data
                this.columns = fs.readJsonSync(this.dataFile);
            }
            
            // Load tasks from Heartbeat if no tasks exist
            if (Object.values(this.columns).every(column => column.length === 0)) {
                this.loadHeartbeatTasks();
            }
        } catch (error) {
            console.error('Failed to load Kanban board:', error);
            // Fallback to default empty board
            this.columns = {
                backlog: [],
                todo: [],
                'in-progress': [],
                done: []
            };
            this.saveBoard();
        }
    }

    saveBoard() {
        try {
            fs.ensureFileSync(this.dataFile);
            fs.writeJsonSync(this.dataFile, this.columns, { spaces: 2 });
        } catch (error) {
            console.error('Failed to save Kanban board:', error);
        }
    }

    loadHeartbeatTasks() {
        try {
            if (fs.existsSync(this.heartbeatFile)) {
                const heartbeatContent = fs.readFileSync(this.heartbeatFile, 'utf8');
                
                // Find all sections (lines starting with ##)
                const sectionRegex = /^## (.+)$/gm;
                let match;
                const sections = [];
                
                while ((match = sectionRegex.exec(heartbeatContent)) !== null) {
                    sections.push({
                        name: match[1].trim(),
                        startIndex: match.index
                    });
                }
                
                // Process each section
                sections.forEach((section, index) => {
                    const startIndex = section.startIndex;
                    const endIndex = index < sections.length - 1 ? sections[index + 1].startIndex : heartbeatContent.length;
                    const sectionContent = heartbeatContent.substring(startIndex, endIndex);
                    
                    // Extract unchecked tasks
                    const taskLines = sectionContent.split('\n')
                        .filter(line => line.trim().startsWith('- [ ]'))
                        .map(line => line.replace('- [ ]', '').trim());
                    
                    // Determine priority based on section name
                    let priority = 'medium';
                    if (section.name.toLowerCase().includes('daily')) priority = 'high';
                    if (section.name.toLowerCase().includes('hourly')) priority = 'high';
                    
                    // Add tasks to todo column
                    taskLines.forEach(taskText => {
                        const existingTask = this.findTaskByTitle(taskText);
                        if (!existingTask) {
                            this.addCard({
                                title: taskText,
                                description: `From ${section.name}`,
                                priority: priority,
                                tags: ['heartbeat', section.name.toLowerCase().replace(/\s/g, '-')]
                            });
                        }
                    });
                });

                this.saveBoard();
            }
        } catch (error) {
            console.error('Failed to load Heartbeat tasks:', error);
        }
    }

    findTaskByTitle(title) {
        for (const column in this.columns) {
            const task = this.columns[column].find(card => card.title.trim() === title.trim());
            if (task) return task;
        }
        return null;
    }

    addCard(options) {
        // Default to backlog unless specified
        const targetColumn = options.column || 'backlog';
        
        const card = {
            id: uuidv4(),
            title: options.title,
            description: options.description || '',
            priority: options.priority || 'medium',
            tags: options.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dueDate: options.dueDate || null,
            column: targetColumn,
            schedule: options.schedule || 'once', // once, heartbeat, cron
            cronExpression: options.cronExpression || null,
            cronJobId: options.cronJobId || null,
            comments: options.comments || [],
            tracking: {
                totalTokens: 0,
                totalCost: 0,
                executions: []
            }
        };

        // Add to specified column
        this.columns[targetColumn].push(card);
        this.saveBoard();
        
        // If cron schedule, create OpenClaw cron job
        if (card.schedule === 'cron' && card.cronExpression) {
            this.createCronJob(card);
        }
        
        return card;
    }

    createCronJob(card) {
        // This will be called via API endpoint to create OpenClaw cron job
        console.log(`[Cron] Task ${card.id} needs cron job: ${card.cronExpression}`);
        // The actual cron creation happens in the server via OpenClaw API
    }

    deleteCronJob(card) {
        if (card.cronJobId) {
            console.log(`[Cron] Deleting cron job ${card.cronJobId} for task ${card.id}`);
            // The actual cron deletion happens in the server via OpenClaw API
        }
    }

    updateCard(cardId, updates) {
        // Search through all columns
        for (const columnName in this.columns) {
            const column = this.columns[columnName];
            const cardIndex = column.findIndex(card => card.id === cardId);
            
            if (cardIndex !== -1) {
                const card = column[cardIndex];
                const updatedCard = {
                    ...card,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                column[cardIndex] = updatedCard;
                this.saveBoard();
                return updatedCard;
            }
        }

        throw new Error(`Card ${cardId} not found`);
    }

    moveCard(cardId, fromColumn, toColumn) {
        // Find the card in the source column
        const sourceColumnCards = this.columns[fromColumn];
        const cardIndex = sourceColumnCards.findIndex(card => card.id === cardId);
        
        if (cardIndex === -1) {
            throw new Error(`Card ${cardId} not found in ${fromColumn} column`);
        }

        // Remove card from source column
        const [card] = sourceColumnCards.splice(cardIndex, 1);
        
        // Update card's column
        card.column = toColumn;
        card.updatedAt = new Date().toISOString();

        // Add to destination column
        this.columns[toColumn].push(card);
        this.saveBoard();

        return card;
    }

    deleteCard(cardId) {
        for (const columnName in this.columns) {
            const column = this.columns[columnName];
            const cardIndex = column.findIndex(card => card.id === cardId);
            
            if (cardIndex !== -1) {
                const deletedCard = column.splice(cardIndex, 1)[0];
                
                // Delete associated cron job if exists
                this.deleteCronJob(deletedCard);
                
                this.saveBoard();
                return deletedCard;
            }
        }

        throw new Error(`Card ${cardId} not found`);
    }

    processInProgressTasks() {
        const inProgressTasks = this.columns['in-progress'].slice(); // Create a copy
        
        inProgressTasks.forEach(task => {
            try {
                // Move all in-progress tasks to done
                this.moveCard(task.id, 'in-progress', 'done');
            } catch (error) {
                console.error(`Failed to process task ${task.id}:`, error);
            }
        });

        this.saveBoard();
    }

    listCards() {
        return this.columns;
    }

    syncToHeartbeat() {
        try {
            if (!fs.existsSync(this.heartbeatFile)) {
                console.log('HEARTBEAT.md not found, skipping sync');
                return;
            }

            let heartbeatContent = fs.readFileSync(this.heartbeatFile, 'utf8');
            
            // Get all tasks from kanban that have heartbeat tag
            const heartbeatTasks = [];
            for (const columnName in this.columns) {
                const columnTasks = this.columns[columnName].filter(card => 
                    card.tags && card.tags.includes('heartbeat')
                );
                heartbeatTasks.push(...columnTasks.map(task => ({ ...task, column: columnName })));
            }

            // Update heartbeat checkboxes based on task status
            heartbeatTasks.forEach(task => {
                const isDone = task.column === 'done';
                const checkbox = isDone ? '- [x]' : '- [ ]';
                const uncheckedPattern = new RegExp(`- \\[ \\] ${this.escapeRegex(task.title)}`, 'g');
                const checkedPattern = new RegExp(`- \\[x\\] ${this.escapeRegex(task.title)}`, 'g');
                
                // Replace both checked and unchecked versions with the correct state
                heartbeatContent = heartbeatContent.replace(uncheckedPattern, `${checkbox} ${task.title}`);
                heartbeatContent = heartbeatContent.replace(checkedPattern, `${checkbox} ${task.title}`);
            });

            fs.writeFileSync(this.heartbeatFile, heartbeatContent, 'utf8');
            console.log('Synced kanban state to HEARTBEAT.md');
        } catch (error) {
            console.error('Failed to sync to Heartbeat:', error);
            throw error;
        }
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    loadArchive() {
        try {
            if (fs.existsSync(this.archiveFile)) {
                this.archive = fs.readJsonSync(this.archiveFile);
            } else {
                this.archive = [];
                this.saveArchive();
            }
        } catch (error) {
            console.error('Failed to load archive:', error);
            this.archive = [];
        }
    }

    saveArchive() {
        try {
            fs.ensureFileSync(this.archiveFile);
            fs.writeJsonSync(this.archiveFile, this.archive, { spaces: 2 });
        } catch (error) {
            console.error('Failed to save archive:', error);
        }
    }

    archiveCard(cardId, fromColumn = 'done') {
        // Find card in specified column (or search all)
        let card = null;
        let cardIndex = -1;
        let sourceColumn = fromColumn;
        
        if (fromColumn === 'any') {
            // Search all columns
            for (const col in this.columns) {
                cardIndex = this.columns[col].findIndex(c => c.id === cardId);
                if (cardIndex !== -1) {
                    sourceColumn = col;
                    card = this.columns[col][cardIndex];
                    break;
                }
            }
        } else {
            const column = this.columns[fromColumn];
            cardIndex = column.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                card = column[cardIndex];
            }
        }
        
        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        // Remove from source column
        this.columns[sourceColumn].splice(cardIndex, 1);
        
        // Disable recurrence (heartbeat/cron)
        if (card.schedule === 'heartbeat') {
            card.schedule = 'once'; // Convert to one-time
        }
        // Cron jobs will be cancelled by server
        
        card.archivedAt = new Date().toISOString();
        this.archive.unshift(card); // Add to beginning
        
        this.saveBoard();
        this.saveArchive();
        
        console.log(`[Archive] Archived card: ${card.title} from ${sourceColumn}`);
        return card;
    }

    archiveAllDone() {
        const doneCards = [...this.columns.done];
        const count = doneCards.length;
        
        doneCards.forEach(card => {
            card.archivedAt = new Date().toISOString();
            this.archive.unshift(card);
        });
        
        this.columns.done = [];
        
        this.saveBoard();
        this.saveArchive();
        
        console.log(`[Archive] Archived ${count} done cards`);
        return { count, cards: doneCards };
    }

    getArchive(limit = 100) {
        return this.archive.slice(0, limit);
    }

    permanentlyDelete(cardId) {
        // Try to delete from archive
        const archiveIndex = this.archive.findIndex(card => card.id === cardId);
        
        if (archiveIndex !== -1) {
            const [deletedCard] = this.archive.splice(archiveIndex, 1);
            this.saveArchive();
            console.log(`[Archive] Permanently deleted: ${deletedCard.title}`);
            return deletedCard;
        }
        
        throw new Error(`Card ${cardId} not found in archive`);
    }

    clearArchive() {
        const count = this.archive.length;
        this.archive = [];
        this.saveArchive();
        console.log(`[Archive] Cleared ${count} archived cards`);
        return { count };
    }

    restoreFromArchive(cardId) {
        const archiveIndex = this.archive.findIndex(card => card.id === cardId);
        
        if (archiveIndex === -1) {
            throw new Error(`Card ${cardId} not found in archive`);
        }

        // Remove from archive
        const [card] = this.archive.splice(archiveIndex, 1);
        
        // Remove archived timestamp
        delete card.archivedAt;
        
        // Add back to done column
        card.column = 'done';
        card.updatedAt = new Date().toISOString();
        this.columns.done.push(card);
        
        this.saveBoard();
        this.saveArchive();
        
        console.log(`[Archive] Restored card: ${card.title}`);
        return card;
    }

    reorderCard(cardId, column, newPosition) {
        const columnCards = this.columns[column];
        const oldIndex = columnCards.findIndex(card => card.id === cardId);
        
        if (oldIndex === -1) {
            throw new Error(`Card ${cardId} not found in ${column} column`);
        }

        // Remove card from old position
        const [card] = columnCards.splice(oldIndex, 1);
        
        // Insert at new position
        columnCards.splice(newPosition, 0, card);
        
        card.updatedAt = new Date().toISOString();
        this.saveBoard();
        
        console.log(`[Reorder] Moved ${card.title} from position ${oldIndex} to ${newPosition} in ${column}`);
        return this.columns;
    }

    addComment(cardId, commentText, author = 'The Big Man') {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }
        
        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        if (!card.comments) {
            card.comments = [];
        }

        const comment = {
            id: uuidv4(),
            text: commentText,
            author: author,
            createdAt: new Date().toISOString()
        };

        card.comments.push(comment);
        card.updatedAt = new Date().toISOString();
        this.saveBoard();

        console.log(`[Comment] Added to ${card.title}: ${commentText.substring(0, 50)}...`);
        return comment;
    }

    getComments(cardId) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }
        
        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        return card.comments || [];
    }

    deleteComment(cardId, commentId) {
        // Find card
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }
        
        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        if (!card.comments) {
            throw new Error('No comments on this card');
        }

        const commentIndex = card.comments.findIndex(c => c.id === commentId);
        
        if (commentIndex === -1) {
            throw new Error(`Comment ${commentId} not found`);
        }

        const [deletedComment] = card.comments.splice(commentIndex, 1);
        card.updatedAt = new Date().toISOString();
        this.saveBoard();

        console.log(`[Comment] Deleted from ${card.title}`);
        return deletedComment;
    }

    // === SUBTASKS ===

    addSubtask(cardId, text) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        if (!card.subtasks) {
            card.subtasks = [];
        }

        const subtask = {
            id: uuidv4(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        card.subtasks.push(subtask);
        card.updatedAt = new Date().toISOString();
        this.saveBoard();

        console.log(`[Subtask] Added to ${card.title}: ${text}`);
        return subtask;
    }

    updateSubtask(cardId, subtaskId, updates) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        if (!card.subtasks) {
            throw new Error(`Card has no subtasks`);
        }

        const subtaskIndex = card.subtasks.findIndex(s => s.id === subtaskId);
        if (subtaskIndex === -1) {
            throw new Error(`Subtask ${subtaskId} not found`);
        }

        card.subtasks[subtaskIndex] = {
            ...card.subtasks[subtaskIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        card.updatedAt = new Date().toISOString();
        this.saveBoard();

        console.log(`[Subtask] Updated ${subtaskId} on ${card.title}`);
        return card.subtasks[subtaskIndex];
    }

    deleteSubtask(cardId, subtaskId) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        if (!card.subtasks) {
            throw new Error(`Card has no subtasks`);
        }

        const subtaskIndex = card.subtasks.findIndex(s => s.id === subtaskId);
        if (subtaskIndex === -1) {
            throw new Error(`Subtask ${subtaskId} not found`);
        }

        const [deletedSubtask] = card.subtasks.splice(subtaskIndex, 1);
        card.updatedAt = new Date().toISOString();
        this.saveBoard();

        console.log(`[Subtask] Deleted ${subtaskId} from ${card.title}`);
        return deletedSubtask;
    }

    getSubtasks(cardId) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        return card.subtasks || [];
    }

    // === TRACKING ===

    addTrackingEntry(cardId, tokens, cost, metadata = {}) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        // Initialize tracking if not exists
        if (!card.tracking) {
            card.tracking = {
                totalTokens: 0,
                totalCost: 0,
                executions: []
            };
        }

        const entry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            tokens: tokens || 0,
            cost: cost || 0,
            metadata: metadata
        };

        card.tracking.executions.push(entry);
        card.tracking.totalTokens += entry.tokens;
        card.tracking.totalCost += entry.cost;
        card.updatedAt = new Date().toISOString();

        this.saveBoard();

        console.log(`[Tracking] Added entry to ${card.title}: ${tokens} tokens, $${cost}`);
        return entry;
    }

    getTracking(cardId) {
        // Find card in any column
        let card = null;
        for (const col in this.columns) {
            card = this.columns[col].find(c => c.id === cardId);
            if (card) break;
        }

        if (!card) {
            throw new Error(`Card ${cardId} not found`);
        }

        return card.tracking || {
            totalTokens: 0,
            totalCost: 0,
            executions: []
        };
    }

    getAllTracking() {
        const allCards = [
            ...this.columns.backlog,
            ...this.columns.todo,
            ...this.columns['in-progress'],
            ...this.columns.done
        ];

        let totalTokens = 0;
        let totalCost = 0;
        const taskTracking = [];

        allCards.forEach(card => {
            if (card.tracking) {
                totalTokens += card.tracking.totalTokens;
                totalCost += card.tracking.totalCost;
                taskTracking.push({
                    id: card.id,
                    title: card.title,
                    column: card.column,
                    tokens: card.tracking.totalTokens,
                    cost: card.tracking.totalCost,
                    executions: card.tracking.executions.length
                });
            }
        });

        return {
            summary: {
                totalTokens,
                totalCost,
                totalTasks: allCards.length,
                trackedTasks: taskTracking.length
            },
            tasks: taskTracking
        };
    }
}

module.exports = KanbanBoard;