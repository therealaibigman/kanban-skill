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

// === KANBAN LOGIC ===

function debugLog(...args) {
    console.log('[Kanban]', ...args);
}

function updateStats(columns) {
    document.getElementById('statBacklog').textContent = columns.backlog.length;
    document.getElementById('statTodo').textContent = columns.todo.length;
    document.getElementById('statInProgress').textContent = columns['in-progress'].length;
    document.getElementById('statDone').textContent = columns.done.length;
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
    
    updateStats(columns);
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
    
    cardElement.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-800 text-lg flex-1">${scheduleIcon} ${card.title || 'Untitled Card'}</h3>
            <span class="text-xs font-bold uppercase ${priorityColors[card.priority] || 'text-gray-600'}">${card.priority || 'medium'}</span>
        </div>
        ${tagsHtml}
        <p class="text-gray-600 text-sm mb-2">${card.description || ''}</p>
        ${card.dueDate ? `<div class="text-xs text-purple-600 font-semibold">📅 ${card.dueDate}</div>` : ''}
        ${card.schedule === 'cron' && card.cronExpression ? `<div class="text-xs text-blue-600 font-semibold">⏰ ${card.cronExpression}</div>` : ''}
        ${card.schedule === 'heartbeat' ? `<div class="text-xs text-pink-600 font-semibold">💓 Recurring</div>` : ''}
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

// Drag and drop setup
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
        
        if (!draggedCard) return;

        const toColumn = container.dataset.column;
        const fromColumn = draggedCard.column;

        if (fromColumn === toColumn) return;

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
    
    const modal = document.getElementById('cardModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

document.getElementById('saveCardBtn').addEventListener('click', saveCard);
document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);
document.getElementById('cancelCardBtn').addEventListener('click', closeModal);

// Initialize
if (checkAuth()) {
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
