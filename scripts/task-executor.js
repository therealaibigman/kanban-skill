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
        
        message += `\n`;
        
        // The actual instruction
        message += task.title;
        
        return message;
    }

    async injectToSession(message) {
        // Use OpenClaw's cron wake mechanism to inject a system event
        // This triggers The Big Man to handle the task
        const wakeFile = path.join(this.workspaceDir, '.kanban-wake');
        await fs.writeFile(wakeFile, JSON.stringify({
            timestamp: Date.now(),
            message: message,
            source: 'kanban-auto-execute'
        }));
        
        // Alternative: use openclaw CLI to send to session
        // But we'll use the simpler file-based approach for now
        
        // Actually, let's use the cron wake API
        try {
            const cmd = `curl -s -X POST http://127.0.0.1:18789/rpc \
                -H "Content-Type: application/json" \
                -d '{"method":"cron.wake","params":{"text":"${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","mode":"now"}}'`;
            
            await execPromise(cmd);
        } catch (error) {
            console.error('Failed to wake via API, using fallback');
            // Fallback: write to a file that The Big Man checks during heartbeat
            const taskQueueFile = path.join(this.workspaceDir, 'kanban-task-queue.json');
            let queue = [];
            
            if (await fs.pathExists(taskQueueFile)) {
                queue = await fs.readJson(taskQueueFile);
            }
            
            queue.push({
                timestamp: Date.now(),
                message: message
            });
            
            await fs.writeJson(taskQueueFile, queue, { spaces: 2 });
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
