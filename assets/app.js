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
    
    cardElement.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-800 text-lg flex-1">${card.title || 'Untitled Card'}</h3>
            <span class="text-xs font-bold uppercase ${priorityColors[card.priority] || 'text-gray-600'}">${card.priority || 'medium'}</span>
        </div>
        ${tagsHtml}
        <p class="text-gray-600 text-sm mb-2">${card.description || ''}</p>
        ${card.dueDate ? `<div class="text-xs text-purple-600 font-semibold">📅 ${card.dueDate}</div>` : ''}
    `;

    // Drag events
    cardElement.addEventListener('dragstart', (e) => {
        draggedCard = card;
        cardElement.classList.add('dragging');
    });

    cardElement.addEventListener('dragend', () => {
        cardElement.classList.remove('dragging');
        draggedCard = null;
    });

    // Click to edit
    cardElement.addEventListener('click', () => {
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
    document.getElementById('cardTitleInput').value = card.title;
    document.getElementById('cardDescriptionInput').value = card.description || '';
    document.getElementById('cardPriorityInput').value = card.priority;
    document.getElementById('cardTagsInput').value = card.tags ? card.tags.join(', ') : '';
    document.getElementById('cardDueDateInput').value = card.dueDate || '';

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
    const title = document.getElementById('cardTitleInput').value;
    const description = document.getElementById('cardDescriptionInput').value;
    const priority = document.getElementById('cardPriorityInput').value;
    const tags = document.getElementById('cardTagsInput').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
    const dueDate = document.getElementById('cardDueDateInput').value;

    try {
        const url = cardId ? `/api/cards/${cardId}` : '/api/cards';
        const method = cardId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify({ 
                title, 
                description, 
                priority, 
                tags,
                dueDate,
                column: currentColumn
            })
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

async function reloadHeartbeat() {
    debugLog('Reloading heartbeat tasks');
    
    try {
        const response = await fetch('/api/heartbeat/reload', {
            method: 'POST',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to reload heartbeat');
        }

        await fetchCards();
    } catch (error) {
        console.error('Error reloading heartbeat:', error);
        alert('Failed to reload heartbeat');
    }
}

// Event listeners
document.getElementById('addCardBtn').addEventListener('click', () => {
    document.getElementById('cardIdInput').value = '';
    document.getElementById('cardCurrentColumn').value = 'todo';
    document.getElementById('cardTitleInput').value = '';
    document.getElementById('cardDescriptionInput').value = '';
    document.getElementById('cardPriorityInput').value = 'medium';
    document.getElementById('cardTagsInput').value = '';
    document.getElementById('cardDueDateInput').value = '';
    document.getElementById('modalTitle').textContent = 'Add Task';
    
    const modal = document.getElementById('cardModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

document.getElementById('saveCardBtn').addEventListener('click', saveCard);
document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);
document.getElementById('cancelCardBtn').addEventListener('click', closeModal);
document.getElementById('reloadHeartbeatBtn').addEventListener('click', reloadHeartbeat);

// Initialize
if (checkAuth()) {
    fetchCards();
    setInterval(fetchCards, 5000);
}
