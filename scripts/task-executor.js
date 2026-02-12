#!/usr/bin/env node

/**
 * Task Executor - Auto-execute tasks when moved to "in-progress"
 * Sends task to OpenClaw for execution via sessions API
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

class TaskExecutor {
    constructor() {
        this.workspaceDir = path.join(process.env.HOME, '.openclaw', 'workspace');
        this.executionLog = path.join(this.workspaceDir, 'kanban-executions.log');
    }

    async executeTask(task) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] Executing task: ${task.title} (${task.id})\n`;
        
        await fs.appendFile(this.executionLog, logEntry);
        
        console.log(`[TaskExecutor] Auto-executing task: ${task.title}`);
        
        try {
            // Create a session message to execute the task
            const message = this.buildExecutionMessage(task);
            
            // Send to OpenClaw main session via file-based injection
            // This is safer than trying to call internal APIs
            await this.injectToSession(message);
            
            console.log(`[TaskExecutor] Task injected to OpenClaw session`);
            
            const successEntry = `[${timestamp}] ✅ Injected: ${task.title}\n`;
            await fs.appendFile(this.executionLog, successEntry);
            
            return { success: true, message: 'Task injected to OpenClaw' };
        } catch (error) {
            console.error(`[TaskExecutor] Failed to execute task:`, error);
            
            const errorEntry = `[${timestamp}] ❌ Failed: ${task.title} - ${error.message}\n`;
            await fs.appendFile(this.executionLog, errorEntry);
            
            return { success: false, error: error.message };
        }
    }

    buildExecutionMessage(task) {
        let message = `🚧 Auto-executing from Kanban:\n\n`;
        message += `**Task:** ${task.title}\n`;
        
        if (task.description && task.description !== 'From Hourly Checks' && task.description !== 'From Daily checks') {
            message += `**Details:** ${task.description}\n`;
        }
        
        if (task.tags && task.tags.length > 0) {
            message += `**Tags:** ${task.tags.join(', ')}\n`;
        }
        
        // Add incremental writing directive for analysis/research/planning tasks
        const isLargeOutputTask = this.isLargeOutputTask(task);
        if (isLargeOutputTask) {
            message += `\n`;
            message += `**⚠️ CRITICAL - WRITE INCREMENTALLY:**\n`;
            message += `- This is a LARGE task that requires creating documents or extensive output\n`;
            message += `- **DO NOT** generate all content in your response text\n`;
            message += `- Use MULTIPLE write() calls with small chunks (500 words max per write)\n`;
            message += `- Start with an outline, then write sections one at a time\n`;
            message += `- After first write, use APPEND mode to add more content\n`;
            message += `- If you hit token limits, the task will FAIL without saving\n`;
            message += `- Write EARLY and OFTEN - don't wait until the end\n`;
            message += `\n`;
        }
        
        // The actual instruction
        message += task.title;
        
        return message;
    }
    
    isLargeOutputTask(task) {
        // Check title for analysis/research/planning keywords
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();
        const tags = (task.tags || []).map(t => t.toLowerCase());
        
        const largeOutputKeywords = [
            'analyze', 'analysis', 'research', 'design', 'plan', 'planning',
            'document', 'documentation', 'report', 'study', 'investigate',
            'proposal', 'strategy', 'architecture', 'blueprint', 'spec'
        ];
        
        // Check if any keyword appears in title, description, or tags
        return largeOutputKeywords.some(keyword => 
            title.includes(keyword) || 
            description.includes(keyword) ||
            tags.some(tag => tag.includes(keyword))
        );
    }

    async injectToSession(message) {
        // Write to kanban task queue - HEARTBEAT.md checks this file
        const taskQueueFile = path.join(this.workspaceDir, 'kanban-task-queue.json');
        let queue = [];
        
        if (await fs.pathExists(taskQueueFile)) {
            queue = await fs.readJson(taskQueueFile);
        }
        
        // Add new task to queue
        queue.push({
            timestamp: Date.now(),
            message: message
        });
        
        await fs.writeJson(taskQueueFile, queue, { spaces: 2 });
        console.log(`[TaskExecutor] Task added to queue: ${taskQueueFile}`);
        
        // Try to trigger immediate execution via OpenClaw CLI
        try {
            const cmd = `openclaw cron wake "${message.replace(/"/g, '\\"').substring(0, 100)}..." --mode now 2>&1 || true`;
            const { stdout } = await execPromise(cmd);
            console.log(`[TaskExecutor] Wake command result: ${stdout}`);
        } catch (error) {
            // CLI might not be available, queue will be processed on next heartbeat
            console.log('[TaskExecutor] CLI wake not available, will process via heartbeat');
        }
    }

    async getExecutionLog() {
        if (await fs.pathExists(this.executionLog)) {
            return await fs.readFile(this.executionLog, 'utf8');
        }
        return '';
    }
}

module.exports = TaskExecutor;
