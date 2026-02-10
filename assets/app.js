// The Big Man's Kanban Board Client - Modern Dashboard Edition

let draggedCard = null;
let currentCards = {}; // Track current card state for comparison
let authToken = null;

// === AUTH & LOGIN ===

function getAuthToken() {
    if (authToken) return authToken;
    authToken = localStorage.getItem('kanban_token');
    return authToken;
}

function setAuthToken(token) {
    authToken = token;
    localStorage.setItem('kanban_token', token);
}

function clearAuthToken() {
    authToken = null;
    localStorage.removeItem('kanban_token');
}

function authHeaders() {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

function checkAuth() {
    const token = getAuthToken();
    
    if (!token) {
        showLoginScreen();
        return false;
    }
    
    showDashboard();
    return true;
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('flex');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('passwordInput').focus();
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    initTheme(); // Initialize theme when dashboard shows
    fetchCards(); // Load initial data
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            setAuthToken(data.token);
            showDashboard();
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login failed: ' + error.message;
        errorDiv.classList.remove('hidden');
    }
});

// Logout button
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Logout and clear authentication?')) {
        clearAuthToken();
        showLoginScreen();
    }
});

// === DARK MODE ===

function initTheme() {
    const savedTheme = localStorage.getItem('kanban_theme');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    } else {
        if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    
    if (html.classList.contains('dark-mode')) {
        html.classList.remove('dark-mode');
        localStorage.setItem('kanban_theme', 'light');
        if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
    } else {
        html.classList.add('dark-mode');
        localStorage.setItem('kanban_theme', 'dark');
        if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }
}

// Theme toggle button
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
});

// === KANBAN LOGIC ===

function debugLog(...args) {
    console.log('[Kanban]', ...args);
}

function cardsHaveChanged(newColumns) {
    const stringifyCards = (columns) => {
        return Object.entries(columns).map(([col, cards]) => 
            cards.map(card => `${card.id}-${card.column}-${card.updatedAt}`).join('|')
        ).join('--');
    };

    const oldCardsString = stringifyCards(currentCards);
    const newCardsString = stringifyCards(newColumns);

    return oldCardsString !== newCardsString;
}

function renderColumns(columns) {
    debugLog('Rendering columns:', columns);
    const columnNames = ['backlog', 'todo', 'in-progress', 'done'];
    
    columnNames.forEach(columnName => {
        const columnContainer = document.querySelector(`[data-column="${columnName}"]`);
        if (!columnContainer) {
            console.error(`Column container not found for: ${columnName}`);
            return;
        }
        
        columnContainer.innerHTML = ''; 

        (columns[columnName] || []).forEach(card => {
            const cardElement = createCardElement(card);
            columnContainer.appendChild(cardElement);
        });
    });
}

let draggedCardElement = null;
let draggedOverCard = null;

function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.classList.add(
        'card', 
        'bg-white/95',
        'backdrop-blur-sm',
        'rounded-xl', 
        'p-4', 
        'shadow-lg',
        'cursor-move',
        'hover:shadow-xl',
        'transition-all',
        'hover:scale-105',
        `priority-${card.priority}`
    );
    cardElement.setAttribute('draggable', true);
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.column = card.column;
    
    let tagsHtml = '';
    if (card.tags && card.tags.length > 0) {
        tagsHtml = '<div class="mb-2">' + 
            card.tags.map(tag => `<span class="tag">${tag}</span>`).join('') + 
            '</div>';
    }
    
    const priorityColors = {
        low: 'text-green-600',
        medium: 'text-orange-600',
        high: 'text-red-600'
    };
    
    const scheduleIcons = {
        once: '',
        heartbeat: '💓',
        cron: '⏰'
    };
    
    const scheduleIcon = scheduleIcons[card.schedule] || '';
    
    // Subtask progress
    let subtaskHtml = '';
    if (card.subtasks && card.subtasks.length > 0) {
        const completed = card.subtasks.filter(s => s.completed).length;
        const total = card.subtasks.length;
        const percent = Math.round((completed / total) * 100);
        subtaskHtml = `<div class="mt-2"><div class="flex items-center gap-2 text-xs text-gray-600"><span class="font-semibold">✅ ${completed}/${total}</span><div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div class="h-full bg-green-500 rounded-full" style="width: ${percent}%"></div></div></div></div>`;
    }

    cardElement.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-800 text-lg flex-1">${scheduleIcon} ${card.title || 'Untitled Card'}</h3>
            <span class="text-xs font-bold uppercase ${priorityColors[card.priority] || 'text-gray-600'}">${card.priority || 'medium'}</span>
        </div>
        ${tagsHtml}
        <p class="text-gray-600 text-sm mb-2">${card.description || ''}</p>
        ${subtaskHtml}
        ${card.dueDate ? `<div class="text-xs text-purple-600 font-semibold mt-1">📅 ${card.dueDate}</div>` : ''}
        ${card.schedule === 'cron' && card.cronExpression ? `<div class="text-xs text-blue-600 font-semibold mt-1">⏰ ${card.cronExpression}</div>` : ''}
        ${card.schedule === 'heartbeat' ? `<div class="text-xs text-pink-600 font-semibold mt-1">💓 Recurring</div>` : ''}
    `;

    // Drag events for the card
    cardElement.addEventListener('dragstart', (e) => {
        draggedCard = card;
        draggedCardElement = cardElement;
        cardElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    cardElement.addEventListener('dragend', () => {
        cardElement.classList.remove('dragging');
        // Clear all drag-over effects
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        draggedCard = null;
        draggedCardElement = null;
        draggedOverCard = null;
    });

    // Touch events for mobile drag-and-drop
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDragging = false;
    let touchClone = null;
    let touchCurrentTarget = null;

    cardElement.addEventListener('touchstart', (e) => {
        // Only handle single finger, not scrolling
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchDragging = false;
        
        // Long press detection for drag start
        cardElement.touchTimer = setTimeout(() => {
            touchDragging = true;
            draggedCard = card;
            draggedCardElement = cardElement;
            cardElement.classList.add('dragging');
            
            // Create visual clone
            touchClone = cardElement.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.width = cardElement.offsetWidth + 'px';
            touchClone.style.opacity = '0.8';
            touchClone.style.zIndex = '1000';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.transform = 'rotate(2deg) scale(1.05)';
            document.body.appendChild(touchClone);
            
            updateTouchClonePosition(touch);
            
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    }, { passive: false });

    cardElement.addEventListener('touchmove', (e) => {
        if (!cardElement.touchTimer && !touchDragging) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        // Cancel drag if scrolling
        if (!touchDragging && (deltaX > 10 || deltaY > 10)) {
            clearTimeout(cardElement.touchTimer);
            cardElement.touchTimer = null;
            return;
        }
        
        if (touchDragging) {
            e.preventDefault();
            updateTouchClonePosition(touch);
            
            // Find element under touch
            touchClone.style.display = 'none';
            const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            touchClone.style.display = 'block';
            
            if (elemBelow) {
                const targetCard = elemBelow.closest('.card');
                const targetColumn = elemBelow.closest('.card-container');
                
                // Clear previous indicators
                document.querySelectorAll('.card').forEach(c => {
                    c.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                document.querySelectorAll('.card-container').forEach(c => {
                    c.style.backgroundColor = '';
                });
                
                if (targetCard && targetCard !== cardElement) {
                    const rect = targetCard.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    
                    if (touch.clientY < midpoint) {
                        targetCard.classList.add('drag-over-top');
                    } else {
                        targetCard.classList.add('drag-over-bottom');
                    }
                    touchCurrentTarget = targetCard;
                } else if (targetColumn) {
                    targetColumn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    touchCurrentTarget = targetColumn;
                }
            }
        }
    }, { passive: false });

    cardElement.addEventListener('touchend', async (e) => {
        clearTimeout(cardElement.touchTimer);
        cardElement.touchTimer = null;
        
        if (!touchDragging) return;
        
        touchDragging = false;
        cardElement.classList.remove('dragging');
        
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        
        // Clear all indicators
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        document.querySelectorAll('.card-container').forEach(c => {
            c.style.backgroundColor = '';
        });
        
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (elemBelow && draggedCard) {
            const targetCard = elemBelow.closest('.card');
            const targetColumn = elemBelow.closest('.card-container');
            
            if (targetCard && targetCard !== cardElement) {
                // Drop on another card - determine position
                const rect = targetCard.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                const insertBefore = touch.clientY < midpoint;
                
                // Same column reorder
                if (targetCard.dataset.column === card.column) {
                    await handleReorder(draggedCard, targetCard, insertBefore);
                } else {
                    // Different column move
                    await moveCardToColumn(draggedCard, targetCard.dataset.column);
                }
            } else if (targetColumn) {
                // Drop on empty column area
                await moveCardToColumn(draggedCard, targetColumn.dataset.column);
            }
        }
        
        draggedCard = null;
        draggedCardElement = null;
        touchCurrentTarget = null;
    });

    function updateTouchClonePosition(touch) {
        if (touchClone) {
            touchClone.style.left = (touch.clientX - touchClone.offsetWidth / 2) + 'px';
            touchClone.style.top = (touch.clientY - touchClone.offsetHeight / 2) + 'px';
        }
    }

    async function handleReorder(card, targetCard, insertBefore) {
        try {
            const container = targetCard.parentElement;
            const allCards = Array.from(container.children);
            const fromIndex = allCards.findIndex(c => c.dataset.cardId === card.id);
            const toIndex = allCards.findIndex(c => c === targetCard);
            
            let newPosition = insertBefore ? toIndex : toIndex + 1;
            if (fromIndex < newPosition) newPosition--;
            
            const response = await fetch(`/api/cards/${card.id}/reorder`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ column: card.column, position: newPosition })
            });
            
            if (!response.ok) throw new Error('Failed to reorder');
            await fetchCards();
        } catch (error) {
            console.error('Error reordering:', error);
        }
    }

    async function moveCardToColumn(card, toColumn) {
        try {
            const fromColumn = card.column;
            const response = await fetch(`/api/cards/${card.id}/move`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ fromColumn, toColumn })
            });
            
            if (!response.ok) throw new Error('Failed to move card');
            await fetchCards();
        } catch (error) {
            console.error('Error moving card:', error);
        }
    }

    // Reordering: drag over other cards
    cardElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        if (!draggedCardElement || draggedCardElement === cardElement) return;
        
        // Same column - show reorder indicator and stop propagation
        if (card.column === draggedCard.column) {
            e.stopPropagation(); // Only stop for same-column
            
            // Clear all previous indicators
            document.querySelectorAll('.card').forEach(c => {
                c.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            // Determine if drop should be above or below
            const rect = cardElement.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const mouseY = e.clientY;
            
            if (mouseY < midpoint) {
                // Drop above this card - show line on top
                cardElement.classList.add('drag-over-top');
            } else {
                // Drop below this card - show line on bottom
                cardElement.classList.add('drag-over-bottom');
            }
            
            draggedOverCard = cardElement;
        }
        // Different column - let event bubble to column container
    });

    cardElement.addEventListener('dragleave', (e) => {
        // Only clear if actually leaving the element
        const rect = cardElement.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || 
            e.clientY < rect.top || e.clientY >= rect.bottom) {
            cardElement.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    });

    // Handle drop on card (reordering within same column)
    cardElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        cardElement.classList.remove('drag-over-top', 'drag-over-bottom');
        
        if (!draggedCard || draggedCardElement === cardElement) return;
        
        const targetColumn = card.column;
        const sourceColumn = draggedCard.column;
        
        // Same column = reorder (stop propagation to prevent column handler)
        if (targetColumn === sourceColumn) {
            e.stopPropagation(); // Only stop for reordering
            
            const container = cardElement.parentElement;
            const allCards = Array.from(container.children);
            let targetIndex = allCards.indexOf(cardElement);
            
            // Check if we should drop below (insert after)
            const rect = cardElement.getBoundingClientRect();
            const mouseY = e.clientY;
            const midpoint = rect.top + rect.height / 2;
            
            if (mouseY >= midpoint) {
                targetIndex++; // Insert after this card
            }
            
            debugLog(`Reordering card ${draggedCard.title} to position ${targetIndex} in ${targetColumn}`);
            
            try {
                const response = await fetch(`/api/cards/${draggedCard.id}/reorder`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ 
                        column: targetColumn,
                        position: targetIndex
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to reorder card');
                }
                
                await fetchCards();
            } catch (error) {
                console.error('Error reordering card:', error);
                alert('Failed to reorder card');
            }
        }
        // Different column = let the column container handle it (don't stop propagation)
    });

    // Click to edit (don't trigger during drag)
    cardElement.addEventListener('click', (e) => {
        if (cardElement.classList.contains('dragging')) return;
        openEditModal(card);
    });

    return cardElement;
}

// Drag and drop setup - MUST run after DOM is ready
function setupColumnDropZones() {
    document.querySelectorAll('.card-container').forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });

        container.addEventListener('dragleave', () => {
            container.style.backgroundColor = '';
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.style.backgroundColor = '';
            
            debugLog('Drop event on column container', container.dataset.column);
            
            if (!draggedCard) {
                debugLog('No draggedCard - drop ignored');
                return;
            }

            const toColumn = container.dataset.column;
            const fromColumn = draggedCard.column;

            debugLog(`Column drop: from ${fromColumn} to ${toColumn}`);

            if (fromColumn === toColumn) {
                debugLog('Same column - ignoring (reorder handles this)');
                return;
            }

            debugLog(`Moving card ${draggedCard.id} from ${fromColumn} to ${toColumn}`);

        try {
            const response = await fetch(`/api/cards/${draggedCard.id}/move`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ fromColumn, toColumn })
            });

            if (!response.ok) {
                throw new Error('Failed to move card');
            }

            await fetchCards();
        } catch (error) {
            console.error('Error moving card:', error);
            alert('Failed to move card');
        }
    });
    });
}

async function fetchCards() {
    debugLog('Fetching cards...');
    try {
        const response = await fetch('/api/cards', {
            headers: authHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
            clearAuthToken();
            showLoginScreen();
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch cards');
        }

        const newColumns = await response.json();

        if (cardsHaveChanged(newColumns)) {
            debugLog('Cards have changed, re-rendering');
            currentCards = newColumns;
            renderColumns(newColumns);
        } else {
            debugLog('No changes detected, skipping render');
        }
    } catch (error) {
        console.error('Failed to fetch cards:', error);
    }
}

// Modal functions
function openEditModal(card) {
    debugLog('Opening edit modal for card:', card);
    const modal = document.getElementById('cardModal');
    const modalTitle = document.getElementById('modalTitle');

    if (!card) {
        console.error('Card not provided to openEditModal');
        return;
    }

    document.getElementById('cardIdInput').value = card.id;
    document.getElementById('cardCurrentColumn').value = card.column;
    document.getElementById('cardColumnInput').value = card.column;
    document.getElementById('cardTitleInput').value = card.title;
    document.getElementById('cardDescriptionInput').value = card.description || '';
    document.getElementById('cardPriorityInput').value = card.priority;
    document.getElementById('cardTagsInput').value = card.tags ? card.tags.join(', ') : '';
    document.getElementById('cardDueDateInput').value = card.dueDate || '';
    document.getElementById('cardScheduleInput').value = card.schedule || 'once';
    document.getElementById('cardCronInput').value = card.cronExpression || '';
    
    // Show/hide cron expression field
    const cronDiv = document.getElementById('cronExpressionDiv');
    if (card.schedule === 'cron') {
        cronDiv.classList.remove('hidden');
    } else {
        cronDiv.classList.add('hidden');
    }

    modalTitle.textContent = 'Edit Task';
    
    // Load comments, subtasks, tracking, and subagents
    loadComments(card.id);
    loadSubtasks(card.id);
    loadTracking(card.id);
    loadSubagents(card.id);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    debugLog('Closing modal');
    const modal = document.getElementById('cardModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

async function saveCard() {
    debugLog('Saving card');
    const cardId = document.getElementById('cardIdInput').value;
    const currentColumn = document.getElementById('cardCurrentColumn').value;
    const targetColumn = document.getElementById('cardColumnInput').value;
    const title = document.getElementById('cardTitleInput').value;
    const description = document.getElementById('cardDescriptionInput').value;
    const priority = document.getElementById('cardPriorityInput').value;
    const tags = document.getElementById('cardTagsInput').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
    const dueDate = document.getElementById('cardDueDateInput').value;
    const schedule = document.getElementById('cardScheduleInput').value;
    const cronExpression = document.getElementById('cardCronInput').value;

    try {
        const url = cardId ? `/api/cards/${cardId}` : '/api/cards';
        const method = cardId ? 'PUT' : 'POST';
        
        const payload = { 
            title, 
            description, 
            priority, 
            tags,
            dueDate,
            column: cardId ? currentColumn : targetColumn, // Use targetColumn for new cards
            schedule
        };
        
        // Add cron expression if schedule is cron
        if (schedule === 'cron' && cronExpression) {
            payload.cronExpression = cronExpression;
        }
        
        const response = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to save card');
        }

        closeModal();
        await fetchCards();
    } catch (error) {
        console.error('Error saving card:', error);
        alert('Failed to save card');
    }
}

async function deleteCard() {
    const cardId = document.getElementById('cardIdInput').value;
    
    if (!cardId) return;
    
    if (!confirm('Delete this task?')) return;

    debugLog(`Deleting card ${cardId}`);

    try {
        const response = await fetch(`/api/cards/${cardId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete card');
        }

        closeModal();
        await fetchCards();
    } catch (error) {
        console.error('Error deleting card:', error);
        alert('Failed to delete card');
    }
}

// Event listeners
document.getElementById('addCardBtn').addEventListener('click', () => {
    document.getElementById('cardIdInput').value = '';
    document.getElementById('cardCurrentColumn').value = '';
    document.getElementById('cardColumnInput').value = 'backlog';
    document.getElementById('cardTitleInput').value = '';
    document.getElementById('cardDescriptionInput').value = '';
    document.getElementById('cardPriorityInput').value = 'medium';
    document.getElementById('cardTagsInput').value = '';
    document.getElementById('cardDueDateInput').value = '';
    document.getElementById('cardScheduleInput').value = 'once';
    document.getElementById('cardCronInput').value = '';
    document.getElementById('modalTitle').textContent = 'Add Task';
    
    // Hide cron field by default
    document.getElementById('cronExpressionDiv').classList.add('hidden');
    
    // Clear comments for new task
    document.getElementById('commentsContainer').innerHTML = '<p class="text-white/50 text-sm italic">No comments yet</p>';
    
    const modal = document.getElementById('cardModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

document.getElementById('saveCardBtn').addEventListener('click', saveCard);
document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);
document.getElementById('cancelCardBtn').addEventListener('click', closeModal);

// Initialize
if (checkAuth()) {
    setupColumnDropZones(); // Set up drag-drop handlers
    fetchCards();
    setInterval(fetchCards, 5000);
}

// Schedule type change handler
document.getElementById('cardScheduleInput').addEventListener('change', (e) => {
    const cronDiv = document.getElementById('cronExpressionDiv');
    if (e.target.value === 'cron') {
        cronDiv.classList.remove('hidden');
    } else {
        cronDiv.classList.add('hidden');
    }
});

// === ARCHIVE FUNCTIONS ===

async function openArchiveModal() {
    const modal = document.getElementById('archiveModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await loadArchive();
}

function closeArchiveModal() {
    const modal = document.getElementById('archiveModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

async function loadArchive() {
    try {
        const response = await fetch('/api/archive', {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to load archive');
        }
        
        const archive = await response.json();
        renderArchive(archive);
    } catch (error) {
        console.error('Error loading archive:', error);
    }
}

function renderArchive(archive) {
    const listDiv = document.getElementById('archiveList');
    const emptyDiv = document.getElementById('archiveEmpty');
    
    if (archive.length === 0) {
        listDiv.classList.add('hidden');
        emptyDiv.classList.remove('hidden');
        return;
    }
    
    listDiv.classList.remove('hidden');
    emptyDiv.classList.add('hidden');
    
    listDiv.innerHTML = archive.map(card => {
        const archivedDate = new Date(card.archivedAt).toLocaleDateString();
        const tagsHtml = card.tags ? card.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';
        
        return `
            <div class="bg-white/95 rounded-xl p-4 flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800 mb-1">${card.title}</h4>
                    <p class="text-gray-600 text-sm mb-2">${card.description || ''}</p>
                    <div class="flex gap-2 items-center text-xs text-gray-500">
                        <span class="font-semibold uppercase ${card.priority === 'high' ? 'text-red-600' : card.priority === 'medium' ? 'text-orange-600' : 'text-green-600'}">${card.priority}</span>
                        <span>•</span>
                        <span>Archived: ${archivedDate}</span>
                    </div>
                    ${tagsHtml ? `<div class="mt-2">${tagsHtml}</div>` : ''}
                </div>
                <div class="flex gap-2 ml-4">
                    <button 
                        class="bg-green-500 text-white py-1 px-3 rounded-lg font-semibold hover:bg-green-600 transition-all text-sm"
                        onclick="restoreCard('${card.id}')"
                    >
                        ↩️ Restore
                    </button>
                    <button 
                        class="bg-red-500 text-white py-1 px-3 rounded-lg font-semibold hover:bg-red-600 transition-all text-sm"
                        onclick="permanentlyDeleteCard('${card.id}')"
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function archiveAllDone() {
    if (!confirm('Archive all done tasks?')) return;
    
    try {
        const response = await fetch('/api/archive/all', {
            method: 'POST',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to archive done tasks');
        }
        
        const result = await response.json();
        alert(`Archived ${result.count} tasks`);
        
        await fetchCards();
        await loadArchive();
    } catch (error) {
        console.error('Error archiving done tasks:', error);
        alert('Failed to archive done tasks');
    }
}

async function permanentlyDeleteCard(cardId) {
    if (!confirm('Permanently delete this task? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/archive/${cardId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete card');
        }
        
        await loadArchive();
    } catch (error) {
        console.error('Error deleting card:', error);
        alert('Failed to delete card');
    }
}

async function clearArchive() {
    if (!confirm('Clear entire archive? This will permanently delete all archived tasks.')) return;
    
    try {
        const response = await fetch('/api/archive', {
            method: 'DELETE',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear archive');
        }
        
        const result = await response.json();
        alert(`Cleared ${result.count} archived tasks`);
        
        await loadArchive();
    } catch (error) {
        console.error('Error clearing archive:', error);
        alert('Failed to clear archive');
    }
}

async function restoreCard(cardId) {
    try {
        const response = await fetch(`/api/archive/${cardId}/restore`, {
            method: 'POST',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to restore card');
        }
        
        await loadArchive();
        await fetchCards(); // Refresh main board
    } catch (error) {
        console.error('Error restoring card:', error);
        alert('Failed to restore card');
    }
}

// Archive button handlers
document.getElementById('archiveBtn').addEventListener('click', openArchiveModal);
document.getElementById('closeArchiveBtn').addEventListener('click', closeArchiveModal);
document.getElementById('archiveAllDoneBtn').addEventListener('click', archiveAllDone);
document.getElementById('clearArchiveBtn').addEventListener('click', clearArchive);

// Archive card from modal
async function archiveCardFromModal() {
    const cardId = document.getElementById('cardIdInput').value;
    const currentColumn = document.getElementById('cardCurrentColumn').value;
    
    if (!cardId) {
        alert('No card selected');
        return;
    }
    
    if (!confirm('Archive this task?')) return;
    
    try {
        const response = await fetch(`/api/archive/${cardId}`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ fromColumn: currentColumn })
        });
        
        if (!response.ok) {
            throw new Error('Failed to archive card');
        }
        
        closeModal();
        await fetchCards();
    } catch (error) {
        console.error('Error archiving card:', error);
        alert('Failed to archive card');
    }
}

// Archive button handler
document.getElementById('archiveCardBtn').addEventListener('click', archiveCardFromModal);

// === EXPORT/IMPORT ===

function openExportModal() {
    const modal = document.getElementById('exportModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function openImportModal() {
    const modal = document.getElementById('importModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('importStatus').classList.add('hidden');
    document.getElementById('importError').classList.add('hidden');
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.getElementById('importFileInput').value = '';
}

async function exportJSON() {
    try {
        const response = await fetch('/api/export/json', {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kanban-board-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        closeExportModal();
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export JSON');
    }
}

async function exportCSV() {
    try {
        const response = await fetch('/api/export/csv', {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kanban-board-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        closeExportModal();
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export CSV');
    }
}

async function importJSON() {
    const fileInput = document.getElementById('importFileInput');
    const statusDiv = document.getElementById('importStatus');
    const errorDiv = document.getElementById('importError');
    
    statusDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    
    if (!fileInput.files || !fileInput.files[0]) {
        errorDiv.textContent = 'Please select a file';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/import/json', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            statusDiv.textContent = result.message;
            statusDiv.classList.remove('hidden');
            
            setTimeout(() => {
                closeImportModal();
                fetchCards();
            }, 1500);
        } else {
            errorDiv.textContent = result.error || 'Import failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Import error:', error);
        errorDiv.textContent = 'Import failed: ' + error.message;
        errorDiv.classList.remove('hidden');
    }
}

// Export/Import button handlers
document.getElementById('exportBtn').addEventListener('click', openExportModal);
document.getElementById('importBtn').addEventListener('click', openImportModal);
document.getElementById('closeExportBtn').addEventListener('click', closeExportModal);
document.getElementById('closeImportBtn').addEventListener('click', closeImportModal);
document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
document.getElementById('importJsonBtn').addEventListener('click', importJSON);

// === COMMENTS ===

async function loadComments(cardId) {
    try {
        const response = await fetch(`/api/cards/${cardId}/comments`, {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to load comments');
        }
        
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderComments(comments) {
    const container = document.getElementById('commentsContainer');
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<p class="text-white/50 text-sm italic">No comments yet</p>';
        return;
    }
    
    container.innerHTML = comments.map(comment => {
        const date = new Date(comment.createdAt).toLocaleString();
        return `
            <div class="bg-white/10 rounded-lg p-3 border border-white/20">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-white/90 font-semibold text-sm">${comment.author || 'Unknown'}</span>
                    <button class="text-white/60 hover:text-red-400 text-xs" onclick="deleteComment('${comment.id}')">🗑️</button>
                </div>
                <p class="text-white/80 text-sm mb-1">${comment.text}</p>
                <span class="text-white/50 text-xs">${date}</span>
            </div>
        `;
    }).join('');
}

async function addComment() {
    const cardId = document.getElementById('cardIdInput').value;
    const commentInput = document.getElementById('newCommentInput');
    const text = commentInput.value.trim();
    
    if (!text) return;
    
    try {
        const response = await fetch(`/api/cards/${cardId}/comments`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ text, author: 'The Big Man' })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add comment');
        }
        
        commentInput.value = '';
        await loadComments(cardId);
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment');
    }
}

async function deleteComment(commentId) {
    const cardId = document.getElementById('cardIdInput').value;
    
    if (!confirm('Delete this comment?')) return;
    
    try {
        const response = await fetch(`/api/cards/${cardId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }
        
        await loadComments(cardId);
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment');
    }
}

// Comment button handler
document.getElementById('addCommentBtn').addEventListener('click', addComment);

// Allow Enter key to add comment
document.getElementById('newCommentInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addComment();
    }
});

// === TRACKING ===

async function loadTracking(cardId) {
    try {
        const response = await fetch(`/api/cards/${cardId}/tracking`, {
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load tracking');
        }

        const tracking = await response.json();
        renderTracking(tracking);
    } catch (error) {
        console.error('Error loading tracking:', error);
    }
}

function renderTracking(tracking) {
    const tokensDiv = document.getElementById('trackingTokens');
    const costDiv = document.getElementById('trackingCost');
    const executionsDiv = document.getElementById('trackingExecutions');

    tokensDiv.textContent = (tracking.totalTokens || 0).toLocaleString();
    costDiv.textContent = '$' + (tracking.totalCost || 0).toFixed(2);

    if (!tracking.executions || tracking.executions.length === 0) {
        executionsDiv.innerHTML = '<p class="text-white/50 text-sm italic">No tracking entries yet</p>';
        return;
    }

    executionsDiv.innerHTML = tracking.executions.slice().reverse().map(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        const notes = entry.metadata && entry.metadata.notes ? ` - ${entry.metadata.notes}` : '';
        return `
            <div class="flex justify-between items-center bg-white/10 rounded-lg p-2">
                <span class="text-white/80">${entry.tokens.toLocaleString()} tokens · $${entry.cost.toFixed(2)}${notes}</span>
                <span class="text-white/50 text-xs">${date}</span>
            </div>
        `;
    }).join('');
}

function openTrackingModal() {
    const modal = document.getElementById('trackingEntryModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('trackingTokensInput').value = '';
    document.getElementById('trackingCostInput').value = '';
    document.getElementById('trackingNotesInput').value = '';
    document.getElementById('trackingTokensInput').focus();
}

function closeTrackingModal() {
    const modal = document.getElementById('trackingEntryModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

async function saveTrackingEntry() {
    const cardId = document.getElementById('cardIdInput').value;
    const tokens = parseInt(document.getElementById('trackingTokensInput').value) || 0;
    const cost = parseFloat(document.getElementById('trackingCostInput').value) || 0;
    const notes = document.getElementById('trackingNotesInput').value.trim();

    if (!cardId || (tokens === 0 && cost === 0)) {
        alert('Please enter tokens or cost');
        return;
    }

    try {
        const response = await fetch(`/api/cards/${cardId}/tracking`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                tokens,
                cost,
                metadata: { notes }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add tracking entry');
        }

        closeTrackingModal();
        await loadTracking(cardId);
    } catch (error) {
        console.error('Error adding tracking entry:', error);
        alert('Failed to add tracking entry');
    }
}

// Tracking button handlers
document.getElementById('addTrackingBtn').addEventListener('click', openTrackingModal);
document.getElementById('saveTrackingBtn').addEventListener('click', saveTrackingEntry);
document.getElementById('cancelTrackingBtn').addEventListener('click', closeTrackingModal);

// Allow Enter key to save tracking
document.getElementById('trackingCostInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveTrackingEntry();
    }
});

// === SUBAGENTS ===

let currentPlan = null;

async function loadSubagents(cardId) {
    try {
        const response = await fetch(`/api/subagents/plans?parentTaskId=${cardId}`, {
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load subagent plans');
        }

        const plans = await response.json();
        renderSubagents(plans);
    } catch (error) {
        console.error('Error loading subagents:', error);
        document.getElementById('subagentsContainer').innerHTML = '<p class="text-white/50 text-sm italic">No subagent plans yet</p>';
    }
}

function renderSubagents(plans) {
    const container = document.getElementById('subagentsContainer');

    if (!plans || plans.length === 0) {
        container.innerHTML = '<p class="text-white/50 text-sm italic">No subagent plans yet. Click "Plan Task" to break this task into sub-tasks for agents.</p>';
        return;
    }

    container.innerHTML = plans.map(plan => {
        const completed = plan.subtasks.filter(st => st.status === 'completed').length;
        const total = plan.subtasks.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return `
            <div class="bg-white/10 rounded-xl p-4 border border-white/20">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="text-white font-semibold">Plan: ${escapeHtml(plan.title)}</span>
                        <span class="text-white/50 text-sm ml-2">${completed}/${total} (${percent}%)</span>
                    </div>
                    <span class="px-2 py-1 rounded text-xs font-semibold ${getStatusColor(plan.status)}">${plan.status}</span>
                </div>
                <div class="w-full bg-white/10 rounded-full h-2 mb-3">
                    <div class="bg-purple-500 h-2 rounded-full transition-all" style="width: ${percent}%"></div>
                </div>
                <div class="space-y-1 text-sm">
                    ${plan.subtasks.map(st => `
                        <div class="flex justify-between items-center bg-white/5 rounded p-2">
                            <span class="text-white/80 ${st.status === 'completed' ? 'line-through' : ''}">${st.index}. ${escapeHtml(st.title)}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-xs ${getStatusColor(st.status)}">${st.status}</span>
                                ${st.status === 'pending' ? `<button onclick="spawnSubagent('${plan.id}', '${st.id}')" class="text-purple-400 hover:text-purple-300 text-xs">🚀 Spawn</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function getStatusColor(status) {
    const colors = {
        'completed': 'text-green-400 bg-green-500/20',
        'executing': 'text-blue-400 bg-blue-500/20',
        'in-progress': 'text-orange-400 bg-orange-500/20',
        'assigned': 'text-yellow-400 bg-yellow-500/20',
        'pending': 'text-gray-400 bg-gray-500/20',
        'failed': 'text-red-400 bg-red-500/20',
        'planned': 'text-purple-400 bg-purple-500/20'
    };
    return colors[status] || 'text-gray-400';
}

async function planSubagents() {
    const cardId = document.getElementById('cardIdInput').value;
    const title = document.getElementById('cardTitleInput').value;
    const description = document.getElementById('cardDescriptionInput').value;

    if (!cardId || !title) {
        alert('Card must have a title to plan subagents');
        return;
    }

    try {
        const response = await fetch('/api/subagents/plan', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                parentTaskId: cardId,
                title,
                description
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create plan');
        }

        currentPlan = await response.json();
        renderPlanModal(currentPlan);
        openSubagentPlanModal();
    } catch (error) {
        console.error('Error planning subagents:', error);
        alert('Failed to create plan: ' + error.message);
    }
}

function renderPlanModal(plan) {
    const container = document.getElementById('subagentPlanContent');

    container.innerHTML = `
        <div class="bg-white/10 rounded-xl p-4">
            <h5 class="text-white font-semibold mb-2">${escapeHtml(plan.title)}</h5>
            <p class="text-white/70 text-sm mb-4">${escapeHtml(plan.description || '')}</p>
            <h6 class="text-white/90 font-semibold mb-2">Generated Sub-tasks:</h6>
            <div class="space-y-2">
                ${plan.subtasks.map((st, i) => `
                    <div class="flex items-start gap-3 bg-white/5 rounded p-3">
                        <span class="text-purple-400 font-bold">${i + 1}</span>
                        <div>
                            <span class="text-white font-medium">${escapeHtml(st.title)}</span>
                            <p class="text-white/60 text-sm">${escapeHtml(st.description)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function openSubagentPlanModal() {
    const modal = document.getElementById('subagentPlanModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeSubagentPlanModal() {
    const modal = document.getElementById('subagentPlanModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    currentPlan = null;
}

async function executePlan() {
    if (!currentPlan) return;

    try {
        // Spawn agents for all pending subtasks
        for (const subtask of currentPlan.subtasks) {
            if (subtask.status === 'pending') {
                await spawnSubagent(currentPlan.id, subtask.id);
            }
        }

        closeSubagentPlanModal();

        // Reload to show updated status
        const cardId = document.getElementById('cardIdInput').value;
        await loadSubagents(cardId);
    } catch (error) {
        console.error('Error executing plan:', error);
        alert('Failed to execute plan: ' + error.message);
    }
}

async function spawnSubagent(planId, subtaskId) {
    try {
        const response = await fetch('/api/subagents/spawn', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                planId,
                subtaskId,
                name: `Agent-${subtaskId.slice(0, 4)}`
            })
        });

        if (!response.ok) {
            throw new Error('Failed to spawn subagent');
        }

        const agent = await response.json();
        console.log('Subagent spawned:', agent);

        // Reload subagents display
        const cardId = document.getElementById('cardIdInput').value;
        await loadSubagents(cardId);
    } catch (error) {
        console.error('Error spawning subagent:', error);
        alert('Failed to spawn subagent: ' + error.message);
    }
}

// Subagent button handlers
document.getElementById('planSubagentsBtn').addEventListener('click', planSubagents);
document.getElementById('executePlanBtn').addEventListener('click', executePlan);
document.getElementById('cancelPlanBtn').addEventListener('click', closeSubagentPlanModal);

// === SUBTASKS ===

async function loadSubtasks(cardId) {
    try {
        const response = await fetch(`/api/cards/${cardId}/subtasks`, {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to load subtasks');
        }
        
        const subtasks = await response.json();
        renderSubtasks(subtasks);
    } catch (error) {
        console.error('Error loading subtasks:', error);
    }
}

function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasksContainer');
    const progressSpan = document.getElementById('subtaskProgress');
    
    if (subtasks.length === 0) {
        container.innerHTML = '<p class="text-white/50 text-sm italic">No subtasks yet</p>';
        progressSpan.textContent = '';
        return;
    }
    
    const completed = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const percent = Math.round((completed / total) * 100);
    
    progressSpan.textContent = `${completed}/${total} (${percent}%)`;
    
    container.innerHTML = subtasks.map(subtask => `
        <div class="flex items-center gap-3 bg-white/10 rounded-lg p-2">
            <input type="checkbox" 
                ${subtask.completed ? 'checked' : ''} 
                onchange="toggleSubtask('${subtask.id}', this.checked)"
                class="w-5 h-5 rounded border-white/30 bg-white/20 text-green-500 focus:ring-2 focus:ring-white/50 cursor-pointer"
            >
            <span class="flex-1 text-white ${subtask.completed ? 'line-through text-white/50' : ''}">${escapeHtml(subtask.text)}</span>
            <button class="text-white/60 hover:text-red-400 text-xs" onclick="deleteSubtask('${subtask.id}')">🗑️</button>
        </div>
    `).join('');
}

async function addSubtask() {
    const subtaskInput = document.getElementById('newSubtaskInput');
    const text = subtaskInput.value.trim();
    const cardId = document.getElementById('cardIdInput').value;
    
    if (!text || !cardId) return;
    
    try {
        const response = await fetch(`/api/cards/${cardId}/subtasks`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add subtask');
        }
        
        subtaskInput.value = '';
        await loadSubtasks(cardId);
        await fetchCards(); // Refresh to show progress on card
    } catch (error) {
        console.error('Error adding subtask:', error);
        alert('Failed to add subtask');
    }
}

async function toggleSubtask(subtaskId, completed) {
    const cardId = document.getElementById('cardIdInput').value;
    
    try {
        const response = await fetch(`/api/cards/${cardId}/subtasks/${subtaskId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ completed })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update subtask');
        }
        
        await loadSubtasks(cardId);
        await fetchCards(); // Refresh to show progress on card
    } catch (error) {
        console.error('Error updating subtask:', error);
    }
}

async function deleteSubtask(subtaskId) {
    if (!confirm('Delete this subtask?')) return;
    
    const cardId = document.getElementById('cardIdInput').value;
    
    try {
        const response = await fetch(`/api/cards/${cardId}/subtasks/${subtaskId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete subtask');
        }
        
        await loadSubtasks(cardId);
        await fetchCards(); // Refresh to show progress on card
    } catch (error) {
        console.error('Error deleting subtask:', error);
        alert('Failed to delete subtask');
    }
}

// Subtask button handler
document.getElementById('addSubtaskBtn').addEventListener('click', addSubtask);

// Allow Enter key to add subtask
document.getElementById('newSubtaskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addSubtask();
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
