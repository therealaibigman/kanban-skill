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
        
        this.spawnQueueFile = path.join(this.subagentsDir, 'spawn-queue.json');
        if (!await fs.pathExists(this.spawnQueueFile)) {
            await fs.writeJson(this.spawnQueueFile, [], { spaces: 2 });
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
            output: null,           // Store completed task output for handoffs
            dependsOn: [],          // Array of subtask IDs this task depends on
            executionMode: subtask.executionMode || 'parallel', // 'parallel' | 'sequential'
            createdAt: new Date().toISOString(),
            completedAt: null
        }));

        // Auto-set dependencies for common workflow patterns
        this.autoSetDependencies(plan.subtasks);

        plan.status = 'planned';
        
        // Save plan
        const tasks = await fs.readJson(this.tasksFile);
        tasks[planId] = plan;
        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        return plan;
    }

    /**
     * Analyze task context and determine appropriate workflow pattern
     */
    analyzeTaskType(taskDetails) {
        const title = (taskDetails.title || '').toLowerCase();
        const description = (taskDetails.description || '').toLowerCase();
        const combined = `${title} ${description}`;
        
        // Define workflow patterns with detection criteria
        const patterns = {
            'development': {
                keywords: ['implement', 'build', 'create', 'add', 'feature', 'functionality', 'integration', 'system', 'app', 'application', 'service', 'api'],
                workflow: [
                    { title: 'Analyze', description: 'Research requirements and existing codebase', keywords: ['analyze', 'research', 'investigate'] },
                    { title: 'Design', description: 'Create architecture and design document', keywords: ['design', 'plan', 'architect'] },
                    { title: 'Implement', description: 'Build the solution according to design', keywords: ['implement', 'build', 'code', 'develop'] },
                    { title: 'Test', description: 'Verify and validate the implementation', keywords: ['test', 'verify', 'validate'] }
                ]
            },
            'research': {
                keywords: ['research', 'investigate', 'study', 'explore', 'evaluate', 'compare', 'survey', 'assessment', 'analysis'],
                workflow: [
                    { title: 'Research', description: 'Gather information and sources', keywords: ['research', 'gather', 'collect'] },
                    { title: 'Analyze', description: 'Analyze findings and identify patterns', keywords: ['analyze', 'examine', 'study'] },
                    { title: 'Summarize', description: 'Create summary of key findings', keywords: ['summarize', 'synthesize', 'compile'] },
                    { title: 'Report', description: 'Document conclusions and recommendations', keywords: ['report', 'document', 'present'] }
                ]
            },
            'bugfix': {
                keywords: ['fix', 'bug', 'error', 'issue', 'crash', 'broken', 'repair', 'resolve', 'problem', 'defect'],
                workflow: [
                    { title: 'Reproduce', description: 'Reproduce the issue and confirm the bug', keywords: ['reproduce', 'confirm', 'identify'] },
                    { title: 'Diagnose', description: 'Investigate root cause and analyze', keywords: ['diagnose', 'investigate', 'analyze'] },
                    { title: 'Fix', description: 'Implement the fix', keywords: ['fix', 'repair', 'resolve'] },
                    { title: 'Verify', description: 'Test the fix and ensure no regressions', keywords: ['verify', 'test', 'validate'] }
                ]
            },
            'documentation': {
                keywords: ['document', 'documentation', 'guide', 'manual', 'readme', 'wiki', 'tutorial', 'reference', 'explain'],
                workflow: [
                    { title: 'Outline', description: 'Create structure and outline', keywords: ['outline', 'structure', 'plan'] },
                    { title: 'Draft', description: 'Write initial content', keywords: ['draft', 'write', 'compose'] },
                    { title: 'Review', description: 'Review for accuracy and clarity', keywords: ['review', 'edit', 'refine'] },
                    { title: 'Publish', description: 'Final formatting and publishing', keywords: ['publish', 'finalize', 'release'] }
                ]
            },
            'data_analysis': {
                keywords: ['data', 'analytics', 'metrics', 'statistics', 'visualization', 'chart', 'report', 'dashboard', 'insights'],
                workflow: [
                    { title: 'Collect', description: 'Gather and validate data sources', keywords: ['collect', 'gather', 'extract'] },
                    { title: 'Process', description: 'Clean and transform data', keywords: ['process', 'clean', 'transform'] },
                    { title: 'Analyze', description: 'Perform analysis and find insights', keywords: ['analyze', 'examine', 'investigate'] },
                    { title: 'Visualize', description: 'Create charts and visualizations', keywords: ['visualize', 'chart', 'graph', 'display'] }
                ]
            },
            'optimization': {
                keywords: ['optimize', 'improve', 'performance', 'speed', 'efficiency', 'refactor', 'enhance', 'upgrade', 'tuning'],
                workflow: [
                    { title: 'Measure', description: 'Measure current performance and identify bottlenecks', keywords: ['measure', 'benchmark', 'profile'] },
                    { title: 'Analyze', description: 'Analyze bottlenecks and opportunities', keywords: ['analyze', 'investigate', 'examine'] },
                    { title: 'Optimize', description: 'Implement optimizations', keywords: ['optimize', 'improve', 'refactor'] },
                    { title: 'Validate', description: 'Measure improvements and validate', keywords: ['validate', 'verify', 'test'] }
                ]
            },
            'integration': {
                keywords: ['integrate', 'connect', 'sync', 'import', 'export', 'migration', 'adapter', 'bridge', 'interface'],
                workflow: [
                    { title: 'Plan', description: 'Plan integration approach and requirements', keywords: ['plan', 'design', 'specify'] },
                    { title: 'Connect', description: 'Establish connection and authentication', keywords: ['connect', 'authenticate', 'link'] },
                    { title: 'Configure', description: 'Configure data mapping and flow', keywords: ['configure', 'map', 'setup'] },
                    { title: 'Validate', description: 'Test integration end-to-end', keywords: ['validate', 'test', 'verify'] }
                ]
            }
        };
        
        // Score each pattern based on keyword matches
        const scores = {};
        for (const [patternName, pattern] of Object.entries(patterns)) {
            scores[patternName] = 0;
            for (const keyword of pattern.keywords) {
                if (combined.includes(keyword)) {
                    scores[patternName] += 1;
                }
            }
        }
        
        // Find best matching pattern
        let bestPattern = 'development'; // default
        let bestScore = 0;
        
        for (const [patternName, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestPattern = patternName;
            }
        }
        
        // If no strong match, use heuristics based on description length and content
        if (bestScore === 0) {
            if (combined.includes('write') || combined.includes('generate') || combined.includes('create')) {
                if (combined.includes('code') || combined.includes('script') || combined.includes('function')) {
                    bestPattern = 'development';
                } else if (combined.includes('doc') || combined.includes('guide')) {
                    bestPattern = 'documentation';
                }
            }
        }
        
        return {
            pattern: bestPattern,
            score: bestScore,
            workflow: patterns[bestPattern].workflow
        };
    }

    /**
     * Generate subtasks using context-aware workflow analysis
     */
    async generateSubtasks(taskDetails) {
        const subtasks = [];
        
        // First, try to extract explicit subtasks from description bullet points
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
        
        // If no explicit subtasks found, analyze task context and generate appropriate workflow
        if (subtasks.length === 0) {
            const analysis = this.analyzeTaskType(taskDetails);
            console.log(`[SubAgentManager] Detected workflow pattern: ${analysis.pattern} (score: ${analysis.score})`);
            
            // Generate subtasks from detected workflow pattern
            for (const step of analysis.workflow) {
                subtasks.push({
                    title: `${step.title} ${taskDetails.title}`,
                    description: step.description,
                    workflowKeywords: step.keywords // Store for dependency detection
                });
            }
        }
        
        return subtasks;
    }

    /**
     * Auto-set dependencies based on workflow context
     * Uses stored workflowKeywords or falls back to title analysis
     */
    autoSetDependencies(subtasks) {
        // Define workflow chains - each pattern has its own sequential order
        const workflowChains = {
            'development': ['analyze', 'design', 'implement', 'test'],
            'research': ['research', 'analyze', 'summarize', 'report'],
            'bugfix': ['reproduce', 'diagnose', 'fix', 'verify'],
            'documentation': ['outline', 'draft', 'review', 'publish'],
            'data_analysis': ['collect', 'process', 'analyze', 'visualize'],
            'optimization': ['measure', 'analyze', 'optimize', 'validate'],
            'integration': ['plan', 'connect', 'configure', 'validate']
        };

        // Classify each subtask by type
        const classified = subtasks.map(st => {
            const titleLower = st.title.toLowerCase();
            
            // First try workflowKeywords if available (from context-aware generation)
            if (st.workflowKeywords) {
                // Find which workflow chain this belongs to
                for (const [chainName, keywords] of Object.entries(workflowChains)) {
                    for (const keyword of keywords) {
                        if (st.workflowKeywords.includes(keyword) || titleLower.includes(keyword)) {
                            return { ...st, workflowType: keyword, workflowChain: chainName };
                        }
                    }
                }
            }
            
            // Fallback: try all keywords from all chains
            for (const [chainName, chain] of Object.entries(workflowChains)) {
                for (const step of chain) {
                    if (titleLower.includes(step)) {
                        return { ...st, workflowType: step, workflowChain: chainName };
                    }
                }
            }
            
            return { ...st, workflowType: 'other', workflowChain: 'unknown' };
        });

        // Set execution mode and dependencies based on workflow chain
        for (let i = 0; i < classified.length; i++) {
            const current = classified[i];
            const currentType = current.workflowType;
            const currentChain = current.workflowChain;
            
            // Skip if not recognized
            if (currentType === 'other') continue;
            
            // Set sequential execution mode
            current.executionMode = 'sequential';
            
            // Get the workflow order for this chain
            const workflowOrder = workflowChains[currentChain] || [];
            
            // Find previous task in workflow chain
            const currentOrderIndex = workflowOrder.indexOf(currentType);
            if (currentOrderIndex > 0) {
                const previousType = workflowOrder[currentOrderIndex - 1];
                
                // Find most recent task of previous type in SAME chain
                for (let j = i - 1; j >= 0; j--) {
                    if (classified[j].workflowType === previousType && 
                        classified[j].workflowChain === currentChain) {
                        current.dependsOn = [classified[j].id];
                        break;
                    }
                }
            }
        }

        // Update original subtasks
        for (let i = 0; i < subtasks.length; i++) {
            subtasks[i].executionMode = classified[i].executionMode;
            subtasks[i].dependsOn = classified[i].dependsOn;
            subtasks[i].workflowType = classified[i].workflowType;
            subtasks[i].workflowChain = classified[i].workflowChain;
        }
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
     * Queues the spawn request - actual spawning is done by main agent via heartbeat
     */
    async spawnAgentSession(agent, subtask) {
        try {
            // Build task message for sub-agent
            const taskMessage = this.buildSubagentTask(subtask);
            
            // Queue the spawn request instead of trying to spawn directly
            // The main agent's heartbeat will process this queue
            const queueFile = path.join(this.subagentsDir, 'spawn-queue.json');
            let queue = [];
            
            if (await fs.pathExists(queueFile)) {
                queue = await fs.readJson(queueFile);
            }
            
            queue.push({
                agentId: agent.id,
                agentName: agent.name,
                planId: agent.planId,
                subtaskId: agent.subtaskId,
                model: agent.model,
                label: `subagent-${agent.id.slice(0, 8)}`,
                task: taskMessage,
                cleanup: 'delete',  // Auto-cleanup session after completion
                createdAt: new Date().toISOString(),
                status: 'pending'
            });
            
            await fs.writeJson(queueFile, queue, { spaces: 2 });
            
            // Update agent status to queued
            agent.status = 'queued';
            const agents = await fs.readJson(this.agentsFile);
            agents[agent.id] = agent;
            await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

            console.log(`[SubAgentManager] Queued agent ${agent.name} for spawning`);
            return agent;
        } catch (error) {
            console.error(`[SubAgentManager] Failed to queue agent ${agent.id}:`, error);
            agent.status = 'failed';
            agent.error = error.message;
            
            const agents = await fs.readJson(this.agentsFile);
            agents[agent.id] = agent;
            await fs.writeJson(this.agentsFile, agents, { spaces: 2 });
            
            throw error;
        }
    }

    /**
     * Mark an agent as executing after it's been spawned by main agent
     */
    async markAgentExecuting(agentId, sessionKey) {
        const agents = await fs.readJson(this.agentsFile);
        const agent = agents[agentId];
        
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        agent.status = 'executing';
        agent.sessionId = sessionKey;
        agent.startedAt = new Date().toISOString();
        
        await fs.writeJson(this.agentsFile, agents, { spaces: 2 });

        // Update subtask status
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[agent.planId];
        const subtask = plan.subtasks.find(st => st.id === agent.subtaskId);
        
        subtask.status = 'in-progress';
        subtask.startedAt = new Date().toISOString();
        await fs.writeJson(this.tasksFile, tasks, { spaces: 2 });

        // Move parent task to in-progress
        await this.updateParentTaskStatus(plan.parentTaskId, 'in-progress');

        console.log(`[SubAgentManager] Agent ${agent.name} now executing with session ${sessionKey}`);
        return agent;
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

            // Send notification via OpenClaw cron wake
            const cmd = `openclaw cron wake "${message.replace(/"/g, '\\"')}" --mode now 2>&1`;

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

    /**
     * Get pending spawn requests from queue
     */
    async getPendingSpawns() {
        const queueFile = path.join(this.subagentsDir, 'spawn-queue.json');
        
        if (!await fs.pathExists(queueFile)) {
            return [];
        }
        
        const queue = await fs.readJson(queueFile);
        return queue.filter(item => item.status === 'pending');
    }

    /**
     * Mark spawn request as processed
     */
    async markSpawnProcessed(agentId, sessionKey) {
        const queueFile = path.join(this.subagentsDir, 'spawn-queue.json');
        
        if (!await fs.pathExists(queueFile)) {
            return;
        }
        
        const queue = await fs.readJson(queueFile);
        const item = queue.find(q => q.agentId === agentId);
        
        if (item) {
            item.status = 'spawned';
            item.sessionKey = sessionKey;
            item.spawnedAt = new Date().toISOString();
            await fs.writeJson(queueFile, queue, { spaces: 2 });
            
            // Also mark agent as executing
            await this.markAgentExecuting(agentId, sessionKey);
        }
    }

    /**
     * Check if a subtask's dependencies are satisfied
     */
    async checkDependenciesSatisfied(subtaskId, planId) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) return false;
        
        const subtask = plan.subtasks.find(st => st.id === subtaskId);
        if (!subtask) return false;
        
        // No dependencies = ready to execute
        if (!subtask.dependsOn || subtask.dependsOn.length === 0) {
            return true;
        }
        
        // Check all dependencies are completed
        for (const depId of subtask.dependsOn) {
            const depTask = plan.subtasks.find(st => st.id === depId);
            if (!depTask || depTask.status !== 'completed') {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get all subtasks ready for execution (dependencies satisfied)
     */
    async getReadySubtasks(planId) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) return [];
        
        const readySubtasks = [];
        
        for (const subtask of plan.subtasks) {
            // Must be pending or assigned
            if (subtask.status !== 'pending' && subtask.status !== 'assigned') {
                continue;
            }
            
            // Check dependencies
            const depsSatisfied = await this.checkDependenciesSatisfied(subtask.id, planId);
            if (depsSatisfied) {
                readySubtasks.push(subtask);
            }
        }
        
        return readySubtasks;
    }

    /**
     * Get output from completed dependency tasks
     */
    async getDependencyOutputs(subtaskId, planId) {
        const tasks = await fs.readJson(this.tasksFile);
        const plan = tasks[planId];
        
        if (!plan) return [];
        
        const subtask = plan.subtasks.find(st => st.id === subtaskId);
        if (!subtask || !subtask.dependsOn) return [];
        
        const outputs = [];
        for (const depId of subtask.dependsOn) {
            const depTask = plan.subtasks.find(st => st.id === depId);
            if (depTask && depTask.output) {
                outputs.push({
                    taskId: depId,
                    taskTitle: depTask.title,
                    output: depTask.output
                });
            }
        }
        
        return outputs;
    }

    /**
     * Execute next ready subtasks in a plan
     * This handles sequential execution - only spawns tasks whose dependencies are met
     */
    async executeNextReady(planId) {
        const readySubtasks = await this.getReadySubtasks(planId);
        
        if (readySubtasks.length === 0) {
            console.log(`[SubAgentManager] No ready subtasks for plan ${planId}`);
            return [];
        }

        const spawnedAgents = [];
        
        for (const subtask of readySubtasks) {
            try {
                // Get dependency outputs for handoff
                const depOutputs = await this.getDependencyOutputs(subtask.id, planId);
                
                // Create agent with enhanced context
                const agent = await this.createSubagent(planId, subtask.id, {
                    name: `Agent-${subtask.id.slice(0, 4)}`,
                    model: 'openrouter/moonshotai/kimi-k2.5'
                }, depOutputs); // Pass dependency outputs
                
                spawnedAgents.push(agent);
                console.log(`[SubAgentManager] Spawned ${agent.name} for ${subtask.title}`);
            } catch (error) {
                console.error(`[SubAgentManager] Failed to spawn for ${subtask.title}:`, error);
            }
        }
        
        return spawnedAgents;
    }

    /**
     * Enhanced createSubagent with dependency handoffs
     */
    async createSubagentWithHandoff(planId, subtaskId, agentConfig = {}, dependencyOutputs = []) {
        // Create the base agent
        const agent = await this.createSubagent(planId, subtaskId, agentConfig);
        
        // If there are dependency outputs, enhance the task message
        if (dependencyOutputs.length > 0) {
            const tasks = await fs.readJson(this.tasksFile);
            const plan = tasks[planId];
            const subtask = plan.subtasks.find(st => st.id === subtaskId);
            
            // Build handoff context
            let handoffContext = '\n\n**Previous Task Outputs:**\n\n';
            for (const dep of dependencyOutputs) {
                handoffContext += `## ${dep.taskTitle}\n${dep.output}\n\n`;
            }
            
            // Update the spawn queue item with enhanced task
            const queueFile = path.join(this.subagentsDir, 'spawn-queue.json');
            const queue = await fs.readJson(queueFile);
            
            const queueItem = queue.find(q => q.agentId === agent.id);
            if (queueItem) {
                queueItem.task += handoffContext;
                queueItem.dependencyOutputs = dependencyOutputs;
                await fs.writeJson(queueFile, queue, { spaces: 2 });
            }
        }
        
        return agent;
    }

    /**
     * Update kanban card with current subagent progress
     * Call this periodically to keep the kanban card in sync with subagent status
     */
    async updateKanbanCardProgress(planId) {
        try {
            const tasks = await fs.readJson(this.tasksFile);
            const plan = tasks[planId];
            
            if (!plan) return;

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
                console.log(`[SubAgentManager] Card ${plan.parentTaskId} not found in kanban`);
                return;
            }

            // Move to in-progress if still in backlog/todo and subagents are running
            const hasExecuting = plan.subtasks.some(st => st.status === 'in-progress' || st.status === 'executing');
            const hasCompleted = plan.subtasks.some(st => st.status === 'completed');
            
            if (hasExecuting && (currentColumn === 'backlog' || currentColumn === 'todo')) {
                board.moveCard(plan.parentTaskId, currentColumn, 'in-progress');
                console.log(`[SubAgentManager] Moved ${plan.parentTaskId} to in-progress`);
                currentColumn = 'in-progress';
            }

            // Update subagent section in card
            card.subagents = {
                planId: plan.id,
                total: plan.subtasks.length,
                completed: plan.subtasks.filter(st => st.status === 'completed').length,
                executing: plan.subtasks.filter(st => st.status === 'in-progress' || st.status === 'executing').length,
                pending: plan.subtasks.filter(st => st.status === 'pending' || st.status === 'assigned').length,
                subtasks: plan.subtasks.map(st => ({
                    title: st.title,
                    status: st.status,
                    result: st.result ? st.result.substring(0, 100) : null
                }))
            };

            // Add/update progress comment if significant change
            const progress = card.subagents.completed / card.subagents.total;
            const lastProgress = card.lastSubagentProgress || 0;
            
            if (progress > lastProgress || hasCompleted) {
                card.lastSubagentProgress = progress;
                
                // Initialize comments array
                if (!card.comments) card.comments = [];
                
                // Remove old progress comments to avoid clutter
                card.comments = card.comments.filter(c => 
                    !(c.author === 'SubAgent Manager' && c.text.includes('Progress Update'))
                );
                
                // Add new progress comment
                card.comments.push({
                    id: uuidv4(),
                    text: `🤖 **Progress Update** (${Math.round(progress * 100)}%)\n\n` +
                          plan.subtasks.map(st => {
                              const icon = st.status === 'completed' ? '✅' : 
                                          st.status === 'in-progress' ? '⏳' : '⏸️';
                              return `${icon} ${st.title}`;
                          }).join('\n'),
                    author: 'SubAgent Manager',
                    createdAt: new Date().toISOString()
                });
            }

            board.saveBoard();
            console.log(`[SubAgentManager] Updated kanban card ${plan.parentTaskId} with subagent progress`);

        } catch (error) {
            console.error(`[SubAgentManager] Failed to update kanban card:`, error);
        }
    }

    /**
     * Sync all active plans to kanban
     * Call this from heartbeat to keep kanban in sync
     */
    async syncAllPlansToKanban() {
        try {
            const tasks = await fs.readJson(this.tasksFile);
            
            for (const [planId, plan] of Object.entries(tasks)) {
                // Only sync executing or recently completed plans
                if (plan.status === 'executing' || plan.status === 'completed') {
                    await this.updateKanbanCardProgress(planId);
                }
            }
        } catch (error) {
            console.error(`[SubAgentManager] Failed to sync plans:`, error);
        }
    }
}

module.exports = SubAgentManager;
