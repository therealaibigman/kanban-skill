// The Big Man's Kanban Board Client

let draggedCard = null;
let currentCards = {}; // Track current card state for comparison
let authToken = null;

// Get auth token from localStorage only
function getAuthToken() {
    if (authToken) return authToken;
    
    // Check localStorage
    authToken = localStorage.getItem('kanban_token');
    
    // If no token, prompt user
    if (!authToken) {
        authToken = prompt('Enter your OpenClaw gateway token:\n\n(Find it in ~/.openclaw/openclaw.json under gateway.auth.token)');
        if (authToken) {
            localStorage.setItem('kanban_token', authToken);
        }
    }
    
    return authToken;
}

// Add auth header to fetch requests
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

// Debugging helper
function debugLog(...args) {
    console.log('[Kanban Debug]', ...args);
}

// Compare current cards with new cards
function cardsHaveChanged(newColumns) {
    // Simple deep comparison
    const stringifyCards = (columns) => {
        return Object.entries(columns).map(([col, cards]) => 
            cards.map(card => `${card.id}-${card.column}-${card.updatedAt}`).join('|')
        ).join('--');
    };

    const oldCardsString = stringifyCards(currentCards);
    const newCardsString = stringifyCards(newColumns);

    return oldCardsString !== newCardsString;
}

// Render columns with cards
function renderColumns(columns) {
    debugLog('Rendering columns:', columns);
    const columnNames = ['backlog', 'todo', 'in-progress', 'done'];
    
    columnNames.forEach(columnName => {
        const columnContainer = document.querySelector(`[data-column="${columnName}"]`);
        if (!columnContainer) {
            console.error(`Column container not found for: ${columnName}`);
            return;
        }
        
        columnContainer.innerHTML = ''; // Clear existing cards

        (columns[columnName] || []).forEach(card => {
            const cardElement = createCardElement(card);
            columnContainer.appendChild(cardElement);
        });
    });
}

// Create card element
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.classList.add(
        'card', 
        'bg-white', 
        'rounded-lg', 
        'p-4', 
        'shadow-md', 
        'cursor-move',
        `priority-${card.priority}`
    );
    cardElement.setAttribute('draggable', true);
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.column = card.column;
    
    cardElement.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-lg mb-2">${card.title || 'Untitled Card'}</h3>
            <span class="text-xs text-gray-500 font-semibold uppercase">${card.priority || 'medium'}</span>
        </div>
        <p class="text-gray-600 mb-2">${card.description || ''}</p>
        <div class="text-xs text-gray-500">Status: ${card.status || 'pending'}</div>
    `;

    // Tags
    if (card.tags && card.tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.classList.add('tags-container', 'mb-2');
        card.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.classList.add('tag');
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
        cardElement.appendChild(tagsContainer);
    }

    // Due date
    if (card.dueDate) {
        const dueDateElement = document.createElement('div');
        dueDateElement.classList.add('text-xs', 'text-gray-500');
        const formattedDate = new Date(card.dueDate).toLocaleDateString();
        dueDateElement.textContent = `Due: ${formattedDate}`;
        cardElement.appendChild(dueDateElement);
    }

    // Drag events
    cardElement.addEventListener('dragstart', dragStart);
    cardElement.addEventListener('dragend', dragEnd);
    cardElement.addEventListener('click', () => openEditModal(card));
    
    return cardElement;
}

// Fetch and render cards
async function fetchCards() {
    debugLog('Fetching cards...');
    try {
        const response = await fetch('/api/cards', {
            headers: authHeaders()
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const columns = await response.json();
        debugLog('Fetched columns:', columns);
        
        // Check if cards have changed
        if (!cardsHaveChanged(columns)) {
            debugLog('Cards have not changed');
            return;
        }

        currentCards = columns;
        renderColumns(columns);
    } catch (error) {
        console.error('Failed to fetch cards:', error);
    }
}

// Modal functionality
function openAddModal() {
    debugLog('Opening add modal');
    const modal = document.getElementById('cardModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !modalTitle) {
        console.error('Modal elements not found');
        return;
    }

    // Reset form
    document.getElementById('cardIdInput').value = '';
    document.getElementById('cardCurrentColumn').value = 'backlog';
    document.getElementById('cardTitleInput').value = '';
    document.getElementById('cardDescriptionInput').value = '';
    document.getElementById('cardPriorityInput').value = 'medium';
    document.getElementById('cardTagsInput').value = '';
    document.getElementById('cardDueDateInput').value = '';

    // Update modal title
    modalTitle.textContent = 'Add New Card';
    
    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openEditModal(card) {
    debugLog('Opening edit modal', card);
    const modal = document.getElementById('cardModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !modalTitle) {
        console.error('Modal elements not found');
        return;
    }

    // Populate form
    document.getElementById('cardIdInput').value = card.id;
    document.getElementById('cardCurrentColumn').value = card.column;
    document.getElementById('cardTitleInput').value = card.title;
    document.getElementById('cardDescriptionInput').value = card.description || '';
    document.getElementById('cardPriorityInput').value = card.priority;
    document.getElementById('cardTagsInput').value = card.tags ? card.tags.join(', ') : '';
    document.getElementById('cardDueDateInput').value = card.dueDate || '';

    // Update modal title
    modalTitle.textContent = 'Edit Card';
    
    // Show modal
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchCards();
        closeModal();
    } catch (error) {
        console.error('Failed to save card:', error);
    }
}

async function deleteCard() {
    const cardId = document.getElementById('cardIdInput').value;
    
    if (!cardId) return;

    try {
        const response = await fetch(`/api/cards/${cardId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchCards();
        closeModal();
    } catch (error) {
        console.error('Failed to delete card:', error);
    }
}

async function reloadHeartbeatTasks() {
    debugLog('Reloading heartbeat tasks');
    try {
        const response = await fetch('/api/heartbeat/reload', {
            method: 'POST',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchCards();
        await processInProgressTasks(); // Immediately move heartbeat tasks to in-progress
    } catch (error) {
        console.error('Failed to reload Heartbeat tasks:', error);
    }
}

// Drag and drop functionality
function setupDragAndDrop() {
    const columns = document.querySelectorAll('.column-container');
    
    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (!draggedCard) return;

            const fromColumn = draggedCard.dataset.column;
            const toColumn = e.currentTarget.querySelector('.card-container').dataset.column;
            const cardId = draggedCard.dataset.cardId;

            if (fromColumn === toColumn) return;

            try {
                const response = await fetch(`/api/cards/${cardId}/move`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ fromColumn, toColumn })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // If moved to in-progress, trigger auto-move
                if (toColumn === 'in-progress') {
                    await processInProgressTasks();
                }

                await fetchCards(); // Reload entire board
            } catch (error) {
                console.error('Failed to move card:', error);
            }

            draggedCard = null;
        });
    });
}

// Periodic tasks
async function processInProgressTasks() {
    debugLog('Processing in-progress tasks');
    try {
        const response = await fetch('/api/cards/process-tasks', {
            method: 'POST',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const updatedColumns = await response.json();
        renderColumns(updatedColumns);
    } catch (error) {
        console.error('Error processing tasks:', error);
    }
}

// Drag start and end handlers
function dragStart(e) {
    draggedCard = e.target;
    e.target.classList.add('dragging');
}

function dragEnd(e) {
    e.target.classList.remove('dragging');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM content loaded');

    // Initial fetch
    fetchCards();
    setupDragAndDrop();

    // Event listeners
    const addCardBtn = document.getElementById('addCardBtn');
    const saveCardBtn = document.getElementById('saveCardBtn');
    const deleteCardBtn = document.getElementById('deleteCardBtn');
    const cancelCardBtn = document.getElementById('cancelCardBtn');
    const reloadHeartbeatBtn = document.getElementById('reloadHeartbeatBtn');

    if (addCardBtn) {
        addCardBtn.addEventListener('click', openAddModal);
    } else {
        console.error('Add Card button not found');
    }

    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', saveCard);
    } else {
        console.error('Save Card button not found');
    }

    if (deleteCardBtn) {
        deleteCardBtn.addEventListener('click', deleteCard);
    } else {
        console.error('Delete Card button not found');
    }

    if (cancelCardBtn) {
        cancelCardBtn.addEventListener('click', closeModal);
    } else {
        console.error('Cancel Card button not found');
    }

    if (reloadHeartbeatBtn) {
        reloadHeartbeatBtn.addEventListener('click', reloadHeartbeatTasks);
    } else {
        console.error('Reload Heartbeat button not found');
    }

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('cardModal');
            if (modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        }
    });

    // Periodic updates
    setInterval(fetchCards, 5000);
    setInterval(processInProgressTasks, 10000);
});
// Logout button handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Clear authentication token and logout?')) {
        localStorage.removeItem('kanban_token');
        authToken = null;
        alert('Logged out. Page will reload.');
        window.location.reload();
    }
});
