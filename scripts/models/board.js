const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class KanbanBoard {
    constructor() {
        this.dataFile = path.join(process.env.HOME, '.openclaw', 'kanban-board.json');
        this.heartbeatFile = path.join(process.env.HOME, '.openclaw', 'workspace', 'HEARTBEAT.md');
        this.columns = {
            backlog: [],
            todo: [],
            'in-progress': [],
            done: []
        };
        this.loadBoard();
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
            cronJobId: options.cronJobId || null
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
}

module.exports = KanbanBoard;