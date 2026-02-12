// The Big Man's Kanban Board Client - Modern Dashboard Edition

let draggedCard = null;
let currentCards = {}; // Track current card state for comparison
let filteredCards = {}; // Filtered cards for display
let authToken = null;

// === FILTER STATE ===
let filterState = {
    searchTerm: '',
    priority: '',
    column: '',
    schedule: '',
    dueDate: '',
    subtasks: '',
    tags: [] // Array of selected tag strings
};
let searchDebounceTimer = null;

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
    let touchScrollContainer = null;
    let touchScrollLeftStart = 0;
    let autoScrollInterval = null;

    cardElement.addEventListener('touchstart', (e) => {
        // Only handle single finger, not scrolling
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchDragging = false;
        
        // Store the scroll container to disable scrolling during drag
        touchScrollContainer = document.querySelector('#dashboard .grid-cols-4');
        if (touchScrollContainer) {
            touchScrollLeftStart = touchScrollContainer.scrollLeft;
        }
        
        // Add pressing feedback immediately
        cardElement.classList.add('pressing');
        
        // Long press detection for drag start (300ms for snappier feel)
        cardElement.touchTimer = setTimeout(() => {
            touchDragging = true;
            cardElement.classList.remove('pressing');
            draggedCard = card;
            draggedCardElement = cardElement;
            cardElement.classList.add('dragging');
            
            // Disable horizontal scrolling while dragging
            if (touchScrollContainer) {
                touchScrollContainer.style.overflowX = 'hidden';
            }
            
            // Create visual clone
            touchClone = cardElement.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.width = cardElement.offsetWidth + 'px';
            touchClone.style.opacity = '0.8';
            touchClone.style.zIndex = '10000'; // Higher z-index to stay on top
            touchClone.style.pointerEvents = 'none';
            touchClone.style.transform = 'rotate(2deg) scale(1.05)';
            touchClone.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
            document.body.appendChild(touchClone);
            
            updateTouchClonePosition(touch);
            
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate(50);
        }, 300);
    }, { passive: false });

    cardElement.addEventListener('touchmove', (e) => {
        if (!cardElement.touchTimer && !touchDragging) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        // Cancel drag if scrolling significantly before timer fires
        if (!touchDragging && (deltaX > 15 || deltaY > 15)) {
            clearTimeout(cardElement.touchTimer);
            cardElement.touchTimer = null;
            cardElement.classList.remove('pressing');
            return;
        }
        
        if (touchDragging) {
            e.preventDefault(); // Prevent scrolling while dragging
            updateTouchClonePosition(touch);
            
            // Auto-scroll horizontal container when near edges
            const scrollContainer = document.querySelector('#dashboard .grid-cols-4');
            if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const edgeThreshold = 180; // pixels from edge to trigger scroll (increased from 120)
                const scrollSpeed = 15; // pixels per frame (increased from 12)
                
                // Clear existing auto-scroll
                if (autoScrollInterval) {
                    clearInterval(autoScrollInterval);
                    autoScrollInterval = null;
                }
                
                // Near right edge - scroll right
                if (touch.clientX > containerRect.right - edgeThreshold) {
                    autoScrollInterval = setInterval(() => {
                        scrollContainer.scrollLeft += scrollSpeed;
                    }, 16);
                }
                // Near left edge - scroll left
                else if (touch.clientX < containerRect.left + edgeThreshold) {
                    autoScrollInterval = setInterval(() => {
                        scrollContainer.scrollLeft -= scrollSpeed;
                    }, 16);
                }
            }
            
            // Find element under touch (clone must be hidden to detect elements below)
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
                    c.classList.remove('drag-active');
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
                    targetColumn.classList.add('drag-active');
                    touchCurrentTarget = targetColumn;
                }
            }
        }
    }, { passive: false });

    cardElement.addEventListener('touchend', async (e) => {
        clearTimeout(cardElement.touchTimer);
        cardElement.touchTimer = null;
        
        // Re-enable horizontal scrolling
        if (touchScrollContainer) {
            touchScrollContainer.style.overflowX = '';
            touchScrollContainer = null;
        }
        
        // Stop auto-scroll
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
        
        if (!touchDragging) {
            cardElement.classList.remove('pressing');
            return;
        }
        
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
            c.classList.remove('drag-active');
        });
        
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (elemBelow && draggedCard) {
            const targetCard = elemBelow.closest('.card');
            const targetColumn = elemBelow.closest('.card-container');
            const movedCardId = draggedCard.id;
            const movedCardColumn = draggedCard.column;
            
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
    
    // Cleanup touch handlers on touchcancel (e.g., if OS interrupts the touch)
    cardElement.addEventListener('touchcancel', () => {
        clearTimeout(cardElement.touchTimer);
        cardElement.touchTimer = null;
        
        // Re-enable horizontal scrolling
        if (touchScrollContainer) {
            touchScrollContainer.style.overflowX = '';
            touchScrollContainer = null;
        }
        
        // Stop auto-scroll
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
        
        touchDragging = false;
        cardElement.classList.remove('dragging');
        cardElement.classList.remove('pressing');
        
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        
        document.querySelectorAll('.card').forEach(c => {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        document.querySelectorAll('.card-container').forEach(c => {
            c.classList.remove('drag-active');
        });

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
            container.classList.add('drag-active');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-active');
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-active');
            
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
            // Apply filters to new data
            filteredCards = filterCards();
            renderColumns(filteredCards);
            updateResultsCount();
            populateTagFilters();
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
    initFilters(); // Initialize filter functionality
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
    const container = document.getElementById('commentsContainer');
    if (!container) {
        console.warn('Comments container not found');
        return;
    }
    
    try {
        const response = await fetch(`/api/cards/${cardId}/comments`, {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn('Failed to load comments:', errorData.error || response.statusText);
            container.innerHTML = '<p class="text-white/50 text-sm italic">Unable to load comments</p>';
            return;
        }
        
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        if (container) {
            container.innerHTML = '<p class="text-white/50 text-sm italic">Error loading comments</p>';
        }
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
let currentSubagentPlans = null;

async function executeAllSubagents() {
    if (!currentSubagentPlans || currentSubagentPlans.length === 0) return;
    
    try {
        // Find first plan with pending subtasks
        const plan = currentSubagentPlans.find(p => p.subtasks.some(st => st.status === 'pending'));
        if (!plan) {
            alert('No pending subagents to execute');
            return;
        }
        
        currentPlan = plan;
        await executePlan();
    } catch (error) {
        console.error('Error executing all subagents:', error);
        alert('Failed to execute subagents: ' + error.message);
    }
}

async function loadSubagents(cardId) {
    try {
        const response = await fetch(`/api/subagents/plans?parentTaskId=${cardId}`, {
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load subagent plans');
        }

        const plans = await response.json();
        currentSubagentPlans = plans; // Store for execute all
        renderSubagents(plans);
        
        // Show/hide Execute All button
        const executeBtn = document.getElementById('executeAllSubagentsBtn');
        const hasPending = plans.some(p => p.subtasks.some(st => st.status === 'pending'));
        if (hasPending) {
            executeBtn.classList.remove('hidden');
        } else {
            executeBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading subagents:', error);
        document.getElementById('subagentsContainer').innerHTML = '<p class="text-white/50 text-sm italic">No subagent plans yet</p>';
        document.getElementById('executeAllSubagentsBtn').classList.add('hidden');
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
                        <div class="flex justify-between items-center bg-white/5 rounded p-2 ${st.dependsOn && st.dependsOn.length > 0 ? 'border-l-2 border-purple-400' : ''}">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-white/80 ${st.status === 'completed' ? 'line-through' : ''}">${st.index}. ${escapeHtml(st.title)}</span>
                                    ${st.executionMode === 'sequential' ? '<span class="text-xs text-purple-400" title="Sequential execution">⏳</span>' : ''}
                                </div>
                                ${st.dependsOn && st.dependsOn.length > 0 ? `
                                    <div class="text-xs text-white/50 ml-4">
                                        ⬆️ Depends on: ${plan.subtasks.filter(d => st.dependsOn.includes(d.id)).map(d => d.title).join(', ')}
                                    </div>
                                ` : ''}
                                ${st.output ? `
                                    <div class="text-xs text-green-400 ml-4">
                                        📝 Output available
                                    </div>
                                ` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                ${st.status === 'completed' && st.output ? `
                                    <button onclick="viewSubtaskOutput('${plan.id}', '${st.id}')" class="text-blue-400 hover:text-blue-300 text-xs">📄 Output</button>
                                ` : ''}
                                <span class="text-xs ${getStatusColor(st.status)}">${st.status}</span>
                                ${st.status === 'pending' && (!st.dependsOn || st.dependsOn.length === 0) ? `<button onclick="spawnSubagent('${plan.id}', '${st.id}')" class="text-purple-400 hover:text-purple-300 text-xs">🚀 Spawn</button>` : ''}
                                ${st.status === 'pending' && st.dependsOn && st.dependsOn.length > 0 ? `<span class="text-xs text-white/40" title="Waiting for dependencies">⏸️ Waiting</span>` : ''}
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
        // Check if any subtasks have dependencies (sequential mode)
        const hasDependencies = currentPlan.subtasks.some(st => 
            st.dependsOn && st.dependsOn.length > 0
        );
        
        if (hasDependencies) {
            // Sequential mode: Use execute-next-ready endpoint
            const response = await fetch(`/api/subagents/plans/${currentPlan.id}/execute-next`, {
                method: 'POST',
                headers: authHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to execute next ready subtasks');
            
            const result = await response.json();
            
            if (result.spawned === 0) {
                alert('No subtasks ready to execute. Dependencies must be completed first.');
                return;
            }
            
            alert(`Sequential execution started. Spawned ${result.spawned} subtask(s) with satisfied dependencies.\n\nRemaining tasks will execute as dependencies complete.`);
        } else {
            // Parallel mode: Spawn all pending subtasks at once
            for (const subtask of currentPlan.subtasks) {
                if (subtask.status === 'pending') {
                    await spawnSubagent(currentPlan.id, subtask.id);
                }
            }
            alert('Parallel execution: All subtasks spawned simultaneously');
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
document.getElementById('executeAllSubagentsBtn').addEventListener('click', executeAllSubagents);

// View subtask output
async function viewSubtaskOutput(planId, subtaskId) {
    try {
        const response = await fetch(`/api/subagents/plans/${planId}`, {
            headers: authHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to load plan');
        
        const plan = await response.json();
        const subtask = plan.subtasks.find(st => st.id === subtaskId);
        
        if (!subtask || !subtask.output) {
            alert('No output available for this subtask');
            return;
        }
        
        // Show output in a simple modal/alert
        const outputWindow = window.open('', '_blank', 'width=800,height=600');
        outputWindow.document.write(`
            <html>
            <head>
                <title>Output: ${subtask.title}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; background: #1a1a2e; color: white; }
                    pre { background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h2>${subtask.title} - Output</h2>
                <pre>${subtask.output}</pre>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error viewing output:', error);
        alert('Failed to load output');
    }
}

// Execute next ready subtasks (sequential mode)
async function executeNextReady() {
    if (!currentPlan) return;
    
    try {
        const response = await fetch(`/api/subagents/plans/${currentPlan.id}/execute-next`, {
            method: 'POST',
            headers: authHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to execute next subtasks');
        
        const result = await response.json();
        
        if (result.spawned === 0) {
            alert('No subtasks ready to execute. Dependencies may not be satisfied yet.');
        } else {
            alert(`Spawned ${result.spawned} subtask(s) with satisfied dependencies`);
            closeSubagentPlanModal();
            
            // Reload to show updated status
            const cardId = document.getElementById('cardIdInput').value;
            await loadSubagents(cardId);
        }
    } catch (error) {
        console.error('Error executing next subtasks:', error);
        alert('Failed to execute: ' + error.message);
    }
}

// === SUBTASKS ===

async function loadSubtasks(cardId) {
    const container = document.getElementById('subtasksContainer');
    const progressSpan = document.getElementById('subtaskProgress');
    
    if (!container) {
        console.warn('Subtasks container not found');
        return;
    }
    
    try {
        const response = await fetch(`/api/cards/${cardId}/subtasks`, {
            headers: authHeaders()
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn('Failed to load subtasks:', errorData.error || response.statusText);
            container.innerHTML = '<p class="text-white/50 text-sm italic">Unable to load subtasks</p>';
            if (progressSpan) progressSpan.textContent = '';
            return;
        }
        
        const subtasks = await response.json();
        renderSubtasks(subtasks);
    } catch (error) {
        console.error('Error loading subtasks:', error);
        if (container) {
            container.innerHTML = '<p class="text-white/50 text-sm italic">Error loading subtasks</p>';
        }
        if (progressSpan) progressSpan.textContent = '';
    }
}

function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasksContainer');
    const progressSpan = document.getElementById('subtaskProgress');
    
    if (!container) {
        console.warn('Subtasks container not found for rendering');
        return;
    }
    
    if (!subtasks || subtasks.length === 0) {
        container.innerHTML = '<p class="text-white/50 text-sm italic">No subtasks yet</p>';
        if (progressSpan) progressSpan.textContent = '';
        return;
    }
    
    const completed = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const percent = Math.round((completed / total) * 100);
    
    if (progressSpan) progressSpan.textContent = `${completed}/${total} (${percent}%)`;
    
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

// === CALENDAR VIEW ===

let currentCalendarDate = new Date();
let calendarTasks = [];

// View toggle
function showKanbanView() {
    document.getElementById('kanbanBoard').classList.remove('hidden');
    document.getElementById('calendarView').classList.add('hidden');
    document.getElementById('kanbanViewBtn').classList.add('active');
    document.getElementById('calendarViewBtn').classList.remove('active');
}

function showCalendarView() {
    document.getElementById('kanbanBoard').classList.add('hidden');
    document.getElementById('calendarView').classList.remove('hidden');
    document.getElementById('kanbanViewBtn').classList.remove('active');
    document.getElementById('calendarViewBtn').classList.add('active');
    renderCalendar();
}

document.getElementById('kanbanViewBtn').addEventListener('click', showKanbanView);
document.getElementById('calendarViewBtn').addEventListener('click', showCalendarView);

// Calendar navigation
document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

document.getElementById('todayBtn').addEventListener('click', () => {
    currentCalendarDate = new Date();
    renderCalendar();
});

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYear = document.getElementById('calendarMonthYear');
    
    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    monthYear.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
    
    // Get all tasks with due dates - use filteredCards if filters are active
    calendarTasks = [];
    const cardsToUse = hasActiveFilters() ? filteredCards : currentCards;
    Object.values(cardsToUse).forEach(column => {
        if (Array.isArray(column)) {
            column.forEach(card => {
                if (card.dueDate) calendarTasks.push(card);
            });
        }
    });
    
    // Calculate calendar days
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    
    // Previous month days to show
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    let html = '';
    
    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }
    
    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const dayTasks = calendarTasks.filter(task => task.dueDate === dateStr);
        
        const todayClass = isToday ? 'today' : '';
        html += `
            <div class="calendar-day ${todayClass}" onclick="showDayTasks('${dateStr}')">
                <span class="calendar-day-number">${day}</span>
                <div class="calendar-task-dots">
                    ${dayTasks.slice(0, 5).map(task => `
                        <span class="task-dot ${task.priority}"></span>
                    `).join('')}
                    ${dayTasks.length > 5 ? '<span class="text-xs text-white/60">+' + (dayTasks.length - 5) + '</span>' : ''}
                </div>
            </div>
        `;
    }
    
    // Next month days to fill grid
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }
    
    grid.innerHTML = html;
}

function openTaskFromCalendar(taskId) {
    // Close the calendar day modal first
    const dayModal = document.getElementById('calendarDayModal');
    dayModal.classList.add('hidden');
    dayModal.classList.remove('flex');
    
    // Find the task in calendarTasks or currentCards
    let task = calendarTasks.find(t => t.id === taskId);
    
    if (!task && currentCards) {
        // Search through all columns in currentCards
        for (const col of Object.values(currentCards)) {
            task = col.find(c => c.id === taskId);
            if (task) break;
        }
    }
    
    if (task) {
        openEditModal(task);
    } else {
        console.error('Task not found:', taskId);
        alert('Task not found');
    }
}

function showDayTasks(dateStr) {
    const modal = document.getElementById('calendarDayModal');
    const title = document.getElementById('calendarDayTitle');
    const tasksContainer = document.getElementById('calendarDayTasks');
    
    const date = new Date(dateStr);
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    title.textContent = `Tasks for ${date.toLocaleDateString('en-US', options)}`;
    
    const dayTasks = calendarTasks.filter(task => task.dueDate === dateStr);
    
    if (dayTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-white/60 text-center py-8">No tasks due on this date</p>';
    } else {
        tasksContainer.innerHTML = dayTasks.map(task => `
            <div class="bg-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-all" 
                 onclick="openTaskFromCalendar('${task.id}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h4 class="text-white font-semibold ${task.column === 'done' ? 'line-through text-white/50' : ''}">${escapeHtml(task.title)}</h4>
                        <p class="text-white/70 text-sm mt-1">${escapeHtml(task.description || '').substring(0, 100)}${task.description && task.description.length > 100 ? '...' : ''}</p>
                    </div>
                    <span class="px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(task.priority)}">${task.priority}</span>
                </div>
                <div class="flex items-center gap-2 mt-2 text-xs text-white/60">
                    <span>${getColumnEmoji(task.column)} ${task.column}</span>
                    ${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function getColumnEmoji(column) {
    const emojis = {
        'backlog': '📋',
        'todo': '📝',
        'in-progress': '🚧',
        'done': '✅'
    };
    return emojis[column] || '📋';
}

function getPriorityColor(priority) {
    const colors = {
        'high': 'text-red-400 bg-red-500/20',
        'medium': 'text-yellow-400 bg-yellow-500/20',
        'low': 'text-green-400 bg-green-500/20'
    };
    return colors[priority] || 'text-blue-400 bg-blue-500/20';
}

document.getElementById('closeCalendarDayModal').addEventListener('click', () => {
    const modal = document.getElementById('calendarDayModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === FILTER FUNCTIONS ===

function initFilters() {
    // Filter toggle button
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterBar = document.getElementById('filterBar');
    
    if (filterToggleBtn && filterBar) {
        filterToggleBtn.addEventListener('click', () => {
            filterBar.classList.toggle('hidden');
            if (!filterBar.classList.contains('hidden')) {
                populateTagFilters();
            }
        });
    }
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterState.searchTerm = e.target.value.toLowerCase();
                applyFilters();
            }, 300);
        });
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Clear filters from empty state
    const clearFiltersEmptyBtn = document.getElementById('clearFiltersEmptyBtn');
    if (clearFiltersEmptyBtn) {
        clearFiltersEmptyBtn.addEventListener('click', clearAllFilters);
    }
    
    // Filter dropdowns
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) {
        priorityFilter.addEventListener('change', (e) => {
            filterState.priority = e.target.value;
            applyFilters();
        });
    }
    
    const columnFilter = document.getElementById('columnFilter');
    if (columnFilter) {
        columnFilter.addEventListener('change', (e) => {
            filterState.column = e.target.value;
            applyFilters();
        });
    }
    
    const scheduleFilter = document.getElementById('scheduleFilter');
    if (scheduleFilter) {
        scheduleFilter.addEventListener('change', (e) => {
            filterState.schedule = e.target.value;
            applyFilters();
        });
    }
    
    const dueDateFilter = document.getElementById('dueDateFilter');
    if (dueDateFilter) {
        dueDateFilter.addEventListener('change', (e) => {
            filterState.dueDate = e.target.value;
            applyFilters();
        });
    }
    
    const subtasksFilter = document.getElementById('subtasksFilter');
    if (subtasksFilter) {
        subtasksFilter.addEventListener('change', (e) => {
            filterState.subtasks = e.target.value;
            applyFilters();
        });
    }
}

function populateTagFilters() {
    const container = document.getElementById('availableTags');
    if (!container) return;
    
    // Collect all unique tags from all cards
    const allTags = new Set();
    Object.values(currentCards).forEach(column => {
        if (Array.isArray(column)) {
            column.forEach(card => {
                if (card.tags && Array.isArray(card.tags)) {
                    card.tags.forEach(tag => allTags.add(tag));
                }
            });
        }
    });
    
    if (allTags.size === 0) {
        container.innerHTML = '<span class="text-white/40 text-sm italic">No tags available</span>';
        return;
    }
    
    // Sort tags alphabetically
    const sortedTags = Array.from(allTags).sort();
    
    container.innerHTML = sortedTags.map(tag => {
        const isSelected = filterState.tags.includes(tag);
        return `
            <button 
                class="tag-filter-btn ${isSelected ? 'selected' : ''} px-3 py-1 rounded-full text-sm font-semibold transition-all ${isSelected ? 'bg-purple-500 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}"
                data-tag="${escapeHtml(tag)}"
                onclick="toggleTagFilter('${escapeHtml(tag).replace(/'/g, "\\'")}')"
            >
                ${isSelected ? '✓ ' : ''}${escapeHtml(tag)}
            </button>
        `;
    }).join('');
}

function toggleTagFilter(tag) {
    const index = filterState.tags.indexOf(tag);
    if (index > -1) {
        filterState.tags.splice(index, 1);
    } else {
        filterState.tags.push(tag);
    }
    applyFilters();
    populateTagFilters(); // Re-render tag buttons with updated state
}

function filterCards() {
    const filtered = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    Object.entries(currentCards).forEach(([columnName, cards]) => {
        if (!Array.isArray(cards)) return;
        
        filtered[columnName] = cards.filter(card => {
            // Text search (title, description)
            if (filterState.searchTerm) {
                const searchText = filterState.searchTerm.toLowerCase();
                const titleMatch = (card.title || '').toLowerCase().includes(searchText);
                const descMatch = (card.description || '').toLowerCase().includes(searchText);
                if (!titleMatch && !descMatch) return false;
            }
            
            // Priority filter
            if (filterState.priority && card.priority !== filterState.priority) {
                return false;
            }
            
            // Column filter
            if (filterState.column && card.column !== filterState.column) {
                return false;
            }
            
            // Schedule filter
            if (filterState.schedule && card.schedule !== filterState.schedule) {
                return false;
            }
            
            // Due date filter
            if (filterState.dueDate && card.dueDate) {
                const dueDate = new Date(card.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                
                switch (filterState.dueDate) {
                    case 'overdue':
                        if (dueDate >= today) return false;
                        break;
                    case 'today':
                        if (dueDate.getTime() !== today.getTime()) return false;
                        break;
                    case 'this-week':
                        if (dueDate < startOfWeek || dueDate > endOfWeek) return false;
                        break;
                    case 'this-month':
                        if (dueDate < startOfMonth || dueDate > endOfMonth) return false;
                        break;
                }
            } else if (filterState.dueDate && !card.dueDate) {
                return false;
            }
            
            // Subtasks filter
            if (filterState.subtasks) {
                const hasSubtasks = card.subtasks && card.subtasks.length > 0;
                const completedSubtasks = hasSubtasks ? card.subtasks.filter(s => s.completed).length : 0;
                
                switch (filterState.subtasks) {
                    case 'has-subtasks':
                        if (!hasSubtasks) return false;
                        break;
                    case 'all-complete':
                        if (!hasSubtasks || completedSubtasks !== card.subtasks.length) return false;
                        break;
                    case 'none-complete':
                        if (!hasSubtasks || completedSubtasks > 0) return false;
                        break;
                }
            }
            
            // Tags filter (AND logic - card must have ALL selected tags)
            if (filterState.tags.length > 0) {
                const cardTags = card.tags || [];
                const hasAllSelectedTags = filterState.tags.every(tag => cardTags.includes(tag));
                if (!hasAllSelectedTags) return false;
            }
            
            return true;
        });
    });
    
    return filtered;
}

function applyFilters() {
    filteredCards = filterCards();
    renderColumns(filteredCards);
    updateResultsCount();
    renderActiveFilterPills();
    updateEmptyState();
}

function clearAllFilters() {
    // Reset state
    filterState = {
        searchTerm: '',
        priority: '',
        column: '',
        schedule: '',
        dueDate: '',
        subtasks: '',
        tags: []
    };
    
    // Reset UI controls
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) priorityFilter.value = '';
    
    const columnFilter = document.getElementById('columnFilter');
    if (columnFilter) columnFilter.value = '';
    
    const scheduleFilter = document.getElementById('scheduleFilter');
    if (scheduleFilter) scheduleFilter.value = '';
    
    const dueDateFilter = document.getElementById('dueDateFilter');
    if (dueDateFilter) dueDateFilter.value = '';
    
    const subtasksFilter = document.getElementById('subtasksFilter');
    if (subtasksFilter) subtasksFilter.value = '';
    
    // Apply and update UI
    applyFilters();
    populateTagFilters();
}

function updateResultsCount() {
    const totalElement = document.getElementById('totalCardCount');
    const resultsCount = document.getElementById('resultsCount');
    
    if (!totalElement || !resultsCount) return;
    
    const totalVisible = Object.values(filteredCards).reduce((sum, cards) => sum + cards.length, 0);
    const totalAll = Object.values(currentCards).reduce((sum, cards) => sum + (Array.isArray(cards) ? cards.length : 0), 0);
    
    totalElement.textContent = totalVisible;
    
    if (hasActiveFilters()) {
        resultsCount.innerHTML = `Showing <span class="font-bold text-white">${totalVisible}</span> of <span class="font-bold text-white">${totalAll}</span> tasks`;
    } else {
        resultsCount.innerHTML = `Showing all <span class="font-bold text-white">${totalAll}</span> tasks`;
    }
}

function hasActiveFilters() {
    return filterState.searchTerm || 
           filterState.priority || 
           filterState.column || 
           filterState.schedule || 
           filterState.dueDate || 
           filterState.subtasks || 
           filterState.tags.length > 0;
}

function renderActiveFilterPills() {
    const container = document.getElementById('activeFilters');
    if (!container) return;
    
    const pills = [];
    
    if (filterState.searchTerm) {
        pills.push({ type: 'search', label: `🔍 "${filterState.searchTerm}"` });
    }
    
    if (filterState.priority) {
        pills.push({ type: 'priority', label: `⚡ ${filterState.priority}` });
    }
    
    if (filterState.column) {
        const columnLabels = { 'backlog': '📋', 'todo': '📝', 'in-progress': '🚧', 'done': '✅' };
        pills.push({ type: 'column', label: `${columnLabels[filterState.column] || ''} ${filterState.column}` });
    }
    
    if (filterState.schedule) {
        const scheduleLabels = { 'once': '', 'heartbeat': '💓', 'cron': '⏰' };
        pills.push({ type: 'schedule', label: `${scheduleLabels[filterState.schedule] || ''} ${filterState.schedule}` });
    }
    
    if (filterState.dueDate) {
        const dateLabels = { 'overdue': '⚠️ Overdue', 'today': '📅 Today', 'this-week': '📆 This Week', 'this-month': '📈 This Month' };
        pills.push({ type: 'dueDate', label: dateLabels[filterState.dueDate] });
    }
    
    if (filterState.subtasks) {
        const subtaskLabels = { 'has-subtasks': 'Has Subtasks', 'all-complete': 'All Complete', 'none-complete': 'None Complete' };
        pills.push({ type: 'subtasks', label: subtaskLabels[filterState.subtasks] });
    }
    
    filterState.tags.forEach(tag => {
        pills.push({ type: 'tag', label: `🏷️ ${tag}`, value: tag });
    });
    
    container.innerHTML = pills.map(pill => {
        let removeAction = '';
        if (pill.type === 'tag') {
            removeAction = `onclick="toggleTagFilter('${pill.value.replace(/'/g, "\\'")}')"`;
        } else if (pill.type !== 'search') {
            removeAction = `onclick="removeFilter('${pill.type}')"`;
        }
        return `
            <span class="inline-flex items-center gap-1 bg-white/20 text-white px-3 py-1 rounded-full text-sm">
                ${pill.label}
                ${pill.type !== 'search' ? `<button ${removeAction} class="ml-1 hover:text-red-300">×</button>` : ''}
            </span>
        `;
    }).join('');
}

function updateEmptyState() {
    const emptyState = document.getElementById('emptyFilterState');
    const kanbanColumns = document.getElementById('kanbanBoard');
    
    if (!emptyState || !kanbanColumns) return;
    
    const totalVisible = Object.values(filteredCards).reduce((sum, cards) => sum + cards.length, 0);
    
    if (hasActiveFilters() && totalVisible === 0) {
        emptyState.classList.remove('hidden');
        // Hide the column containers but keep structure
        const columns = kanbanColumns.querySelectorAll('.column-container');
        columns.forEach(col => col.style.display = 'none');
    } else {
        emptyState.classList.add('hidden');
        const columns = kanbanColumns.querySelectorAll('.column-container');
        columns.forEach(col => col.style.display = 'flex');
    }
}

// Remove pill filter
function removeFilter(filterType, value) {
    switch (filterType) {
        case 'search':
            filterState.searchTerm = '';
            document.getElementById('searchInput').value = '';
            break;
        case 'priority':
            filterState.priority = '';
            document.getElementById('priorityFilter').value = '';
            break;
        case 'column':
            filterState.column = '';
            document.getElementById('columnFilter').value = '';
            break;
        case 'schedule':
            filterState.schedule = '';
            document.getElementById('scheduleFilter').value = '';
            break;
        case 'dueDate':
            filterState.dueDate = '';
            document.getElementById('dueDateFilter').value = '';
            break;
        case 'subtasks':
            filterState.subtasks = '';
            document.getElementById('subtasksFilter').value = '';
            break;
    }
    applyFilters();
}
