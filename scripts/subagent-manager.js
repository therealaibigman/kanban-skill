const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * SubAgent Manager - Orchestrates sub-agents for task execution
 * Plans tasks, delegates to sub-agents, collects results
 */
class SubAgentManager {
    constructor() {
        this.workspaceDir = path.join(process.env.HOME, '.openclaw', 'workspace');
        this.subagentsDir = path.join(this.workspaceDir, 'subagents');
        this.tasksFile = path.join(this.subagentsDir, 'tasks.json');
        this.resultsFile = path.join(this.subagentsDir, 'results.json');
        this.agentsFile = path.join(this.subagentsDir, 'agents.json');
        this.initStorage();
    }

    async initStorage() {
        await fs.ensureDir(this.subagentsDir);
        
        if (!await fs.pathExists(this.tasksFile)) {
            await fs.writeJson(this.tasksFile, {}, { spaces: 2 });
        }
        if (!await fs.pathExists(this.resultsFile)) {
            await fs.writeJson(this.resultsFile, {}, { spaces: 2 });
        }
        if (!await fs.pathExists(this.agentsFile)) {
            await fs.writeJson(this.agentsFile, {}, { spaces: 2 });
        }
    }

    /**
     * Plan a main task into sub-tasks
     */
    async planTask(parentTaskId, taskDetails) {
        const planId = uuidv4();
        const plan = {
            id: planId,
            parentTaskId,
            title: taskDetails.title,
            description: taskDetails.description,
            status: 'planning',
            createdAt: new Date().toISOString(),
            subtasks: [],
            agents: []
        };

        // Generate sub-tasks using OpenClaw planning
        const subtasks = await this.generateSubtasks(taskDetails);
        
        plan.subtasks = subtasks.map((subtask, index) => ({
            id: uuidv4(),
            index: index + 1,
            title: subtask.title,
            description: subtask.description,
            status: 'pending',
            assignedTo: null,
            result: null,
            createdAt: new Date().toISOString(),
            completedAt: null
        }));

        plan.status = 'planned';
        
        // Save plan
        const tasks = await fs.readJson(this.tasksFile);
        tasks[planId] = plan;
        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        return plan;
    }

    /**
     * Generate subtasks using OpenClaw
     */
    async generateSubtasks(taskDetails) {
        // For now, use a simple algorithmic approach
        // In production, this would call OpenClaw to break down the task
        
        const subtasks = [];
        
        // Check if task description contains implementation steps
        if (taskDetails.description) {
            const lines = taskDetails.description.split('\n');
            let currentSubtask = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    if (currentSubtask) {
                        subtasks.push(currentSubtask);
                    }
                    currentSubtask = {
                        title: trimmed.substring(2),
                        description: ''
                    };
                } else if (currentSubtask && trimmed) {
                    currentSubtask.description += trimmed + ' ';
                }
            }
            
            if (currentSubtask) {
                subtasks.push(currentSubtask);
            }
        }
        
        // If no subtasks found, create default ones
        if (subtasks.length === 0) {
            subtasks.push(
                { title: `Analyze ${taskDetails.title}`, description: 'Research and analyze requirements' },
                { title: `Design ${taskDetails.title}`, description: 'Create design and architecture' },
                { title: `Implement ${taskDetails.title}`, description: 'Build the solution' },
                { title: `Test ${taskDetails.title}`, description: 'Verify and validate implementation' }
            );
        }
        
        return subtasks;
    }

    /**
     * Create and spawn a sub-agent for a subtask
     */
    async createSubagent(planId, subtaskId, agentConfig = {}) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        const subtask = plan.subtasks.find(st => st.id === subtaskId);
        if (!subtask) {
            throw new Error(`Subtask ${subtaskId} not found`);
        }

        const agentId = uuidv4();
        const agent = {
            id: agentId,
            planId,
            subtaskId,
            name: agentConfig.name || `Agent-${agentId.slice(0, 8)}`,
            model: agentConfig.model || 'openrouter/moonshotai/kimi-k2.5',
            status: 'spawning',
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            result: null
        };

        // Save agent
        const agents = await fs.readJson(this.agentsFile);
        agents[agentId] = agent;
        await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

        // Update subtask
        subtask.assignedTo = agentId;
        subtask.status = 'assigned';
        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        // Spawn the sub-agent session
        await this.spawnAgentSession(agent, subtask);

        return agent;
    }

    /**
     * Spawn an OpenClaw session for a sub-agent
     */
    async spawnAgentSession(agent, subtask) {
        try {
            agent.status = 'running';
            agent.startedAt = new Date().toISOString();
            
            const agents = await fs.readJson(this.agentsFile);
            agents[agent.id] = agent;
            await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

            // Build task message for sub-agent
            const taskMessage = this.buildSubagentTask(subtask);
            
            // Spawn sub-agent via OpenClaw sessions API
            const cmd = `curl -s -X POST http://127.0.0.1:18789/rpc \
                -H "Content-Type: application/json" \
                -d '{"method":"sessions.spawn","params":{"agentId":"${agent.model}","task":"${taskMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","label":"subagent-${agent.id.slice(0, 8)}"}}'`;
            
            const { stdout } = await execPromise(cmd);
            const result = JSON.parse(stdout);
            
            if (result.error) {
                throw new Error(result.error);
            }

            agent.sessionId = result.result?.sessionKey;
            agent.status = 'executing';

            agents[agent.id] = agent;
            await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

            // Update subtask status to in-progress
            const tasks = await fs.readJson(this.tasksFile);
            const plan = tasks[agent.planId];
            const st = plan.subtasks.find(s => s.id === subtask.id);
            st.status = 'in-progress';
            st.startedAt = new Date().toISOString();
            await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

            // Also update the parent task status in the kanban board
            await this.updateParentTaskStatus(plan.parentTaskId, 'in-progress');

            return agent;
        } catch (error) {
            console.error(`[SubAgentManager] Failed to spawn agent ${agent.id}:`, error);
            agent.status = 'failed';
            agent.error = error.message;
            
            const agents = await fs.readJson(this.agentsFile);
            agents[agent.id] = agent;
            await fs.writeJson(this.agentsFile, agents, { spaces: 2 });
            
            throw error;
        }
    }

    /**
     * Build task message for sub-agent
     */
    buildSubagentTask(subtask) {
        return `🤖 **Sub-Agent Task**

**Objective:** ${subtask.title}

**Details:** ${subtask.description}

**Instructions:**
1. Complete this task independently
2. Report back with status and results
3. Use available tools to accomplish the goal
4. If blocked, report the blocker clearly

When complete, report: "TASK_COMPLETE: [summary of what was done]"`;
    }

    /**
     * Report result from a sub-agent
     */
    async reportResult(agentId, result) {
        const agents = await fs.readJson(this.agentsFile);
        const agent = agents[agentId];
        
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        agent.status = 'completed';
        agent.completedAt = new Date().toISOString();
        agent.result = result;
        
        await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

        // Update subtask
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[agent.planId];
        const subtask = plan.subtasks.find(st => st.id === agent.subtaskId);
        
        subtask.status = 'completed';
        subtask.completedAt = new Date().toISOString();
        subtask.result = result;
        
        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        // Check if all subtasks are complete
        await this.checkPlanCompletion(agent.planId);

        return { agent, subtask };
    }

    /**
     * Check if all subtasks in a plan are complete
     */
    async checkPlanCompletion(planId) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) return;

        const allCompleted = plan.subtasks.every(st => st.status === 'completed');
        const anyFailed = plan.subtasks.some(st => st.status === 'failed');
        
        if (allCompleted) {
            plan.status = 'completed';
            plan.completedAt = new Date().toISOString();
            
            // Aggregate results
            plan.result = {
                summary: `All ${plan.subtasks.length} subtasks completed`,
                subtasks: plan.subtasks.map(st => ({
                    title: st.title,
                    result: st.result
                }))
            };
            
            await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });
            
            // Notify parent (would trigger callback or webhook)
            await this.notifyParentComplete(plan);
        } else if (anyFailed) {
            plan.status = 'partial';
            await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });
        }
    }

    /**
     * Notify parent task of completion
     */
    async notifyParentComplete(plan) {
        // This would typically call back to the kanban board or send a notification
        console.log(`[SubAgentManager] Plan ${plan.id} completed. Parent task: ${plan.parentTaskId}`);

        // Write completion notice to a file that can be polled
        const results = await fs.readJson(this.resultsFile);
        results[plan.id] = {
            parentTaskId: plan.parentTaskId,
            status: 'completed',
            completedAt: plan.completedAt,
            summary: plan.result.summary
        };
        await fs.writeJson(this.resultsFile, results, { spaces: 2 });

        // Move parent task to todo for review (not done - needs verification)
        await this.moveTaskForReview(plan);

        // Notify master agent to review
        await this.notifyMasterAgentForReview(plan);
    }

    /**
     * Move task to todo for review
     */
    async moveTaskForReview(plan) {
        try {
            const KanbanBoard = require('./models/board');
            const board = KanbanBoard.getInstance();

            // Find the card
            let card = null;
            let currentColumn = null;

            for (const col of ['backlog', 'todo', 'in-progress', 'done']) {
                card = board.columns[col].find(c => c.id === plan.parentTaskId);
                if (card) {
                    currentColumn = col;
                    break;
                }
            }

            if (!card) {
                console.log(`[SubAgentManager] Parent task ${plan.parentTaskId} not found`);
                return;
            }

            // Move to todo for review (if not already there)
            if (currentColumn !== 'todo') {
                board.moveCard(plan.parentTaskId, currentColumn, 'todo');
                console.log(`[SubAgentManager] Moved parent task ${plan.parentTaskId} to todo for review`);
            }

            // Add a comment indicating review is needed
            const comments = card.comments || [];
            comments.push({
                id: uuidv4(),
                text: `🔍 **SubAgent Work Complete - Ready for Review**\n\nAll ${plan.subtasks.length} sub-tasks completed.\n\n**Results Summary:**\n${plan.subtasks.map(st => `- ${st.title}: ${st.result ? st.result.substring(0, 100) + (st.result.length > 100 ? '...' : '') : 'No result'}`).join('\n')}\n\nPlease review and verify before marking as done.`,
                author: 'SubAgent Manager',
                createdAt: new Date().toISOString()
            });
            card.comments = comments;
            board.saveBoard();

        } catch (error) {
            console.error(`[SubAgentManager] Failed to move task for review:`, error);
        }
    }

    /**
     * Notify master agent that work is ready for review
     */
    async notifyMasterAgentForReview(plan) {
        try {
            const message = `🤖 **SubAgents Complete - Review Required**\n\n**Task:** ${plan.title}\n**Task ID:** ${plan.parentTaskId}\n\nAll ${plan.subtasks.length} sub-agents have completed their work.\n\n**Sub-task Results:**\n${plan.subtasks.map((st, i) => `${i + 1}. ${st.title}: ${st.status}`).join('\n')}\n\n**Action Required:**\nPlease review the results and move to Done if satisfied, or move back to In Progress if changes are needed.\n\nClick the task to view detailed results in the SubAgents section.`;

            // Send notification via OpenClaw wake
            const cmd = `curl -s -X POST http://127.0.0.1:18789/rpc \
                -H "Content-Type: application/json" \
                -d '{"method":"cron.wake","params":{"text":"${message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","mode":"now"}}'`;

            await execPromise(cmd);
            console.log(`[SubAgentManager] Notified master agent for review of ${plan.parentTaskId}`);

        } catch (error) {
            console.error(`[SubAgentManager] Failed to notify master agent:`, error);
        }
    }

    /**
     * Get status of a plan and its subtasks
     */
    async getPlanStatus(planId) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        const agents = await fs.readJson(this.agentsFile);
        const agentDetails = plan.subtasks
            .filter(st => st.assignedTo)
            .map(st => agents[st.assignedTo]);

        return {
            ...plan,
            agents: agentDetails,
            progress: {
                total: plan.subtasks.length,
                completed: plan.subtasks.filter(st => st.status === 'completed').length,
                executing: plan.subtasks.filter(st => st.status === 'executing').length,
                pending: plan.subtasks.filter(st => st.status === 'pending').length,
                failed: plan.subtasks.filter(st => st.status === 'failed').length
            }
        };
    }

    /**
     * Get all plans for a parent task
     */
    async getPlansForParent(parentTaskId) {
        const tasks = await fs.readJson(this.tasksFile);
        
        return Object.values(tasks).filter(plan => plan.parentTaskId === parentTaskId);
    }

    /**
     * List all active sub-agents
     */
    async listActiveAgents() {
        const agents = await fs.readJson(this.agentsFile);
        
        return Object.values(agents).filter(agent => 
            agent.status === 'running' || agent.status === 'executing'
        );
    }

    /**
     * Cancel a sub-agent
     */
    async cancelAgent(agentId) {
        const agents = await fs.readJson(this.agentsFile);
        const agent = agents[agentId];

        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        agent.status = 'cancelled';
        agent.cancelledAt = new Date().toISOString();

        await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

        // Update subtask
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[agent.planId];
        const subtask = plan.subtasks.find(st => st.id === agent.subtaskId);

        subtask.status = 'cancelled';

        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        return agent;
    }

    /**
     * Update parent task status in kanban board
     */
    async updateParentTaskStatus(parentTaskId, status) {
        try {
            // Import KanbanBoard to move the parent task
            const KanbanBoard = require('./models/board');
            const board = KanbanBoard.getInstance();

            // Find the card in any column
            let card = null;
            let currentColumn = null;

            for (const col of ['backlog', 'todo', 'in-progress', 'done']) {
                card = board.columns[col].find(c => c.id === parentTaskId);
                if (card) {
                    currentColumn = col;
                    break;
                }
            }

            if (!card) {
                console.log(`[SubAgentManager] Parent task ${parentTaskId} not found in kanban`);
                return;
            }

            // Only move if currently in backlog or todo
            if (status === 'in-progress' && (currentColumn === 'backlog' || currentColumn === 'todo')) {
                board.moveCard(parentTaskId, currentColumn, 'in-progress');
                console.log(`[SubAgentManager] Moved parent task ${parentTaskId} to in-progress`);
            } else if (status === 'done' && currentColumn !== 'done') {
                board.moveCard(parentTaskId, currentColumn, 'done');
                console.log(`[SubAgentManager] Moved parent task ${parentTaskId} to done`);
            }
        } catch (error) {
            console.error(`[SubAgentManager] Failed to update parent task status:`, error);
        }
    }
}

module.exports = SubAgentManager;
