document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const itemInput = document.getElementById('item-input');
    const addBtn = document.getElementById('add-btn');
    const shoppingList = document.getElementById('shopping-list');
    const emptyState = document.getElementById('empty-state');
    const deleteCompletedBtn = document.getElementById('delete-completed-btn');
    const sortAzBtn = document.getElementById('sort-az-btn');
    const sortZaBtn = document.getElementById('sort-za-btn');

    // URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list') || 'default';
    const userName = urlParams.get('user') || 'Guest';

    // State
    const API_URL = '/api/items';
    let items = [];

    // Initialize
    loadItems();

    // Auto-refresh every 2 seconds
    setInterval(loadItems, 2000);

    // Event Listeners
    addBtn.addEventListener('click', addItem);
    deleteCompletedBtn.addEventListener('click', deleteCompletedItems);
    sortAzBtn.addEventListener('click', () => sortItems('asc'));
    sortZaBtn.addEventListener('click', () => sortItems('desc'));
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });

    // Event delegation for list item interactions
    shoppingList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const listItem = target.closest('.list-item');
        if (!listItem) return;

        const itemId = parseInt(listItem.getAttribute('data-id'));
        const action = target.getAttribute('data-action');

        switch (action) {
            case 'toggle':
                toggleItem(itemId);
                break;
            case 'increment':
                incrementItem(itemId);
                break;
            case 'decrement':
                decrementItem(itemId);
                break;
            case 'delete':
                deleteItem(itemId);
                break;
        }
    });

    // Functions
    async function loadItems() {
        try {
            const response = await fetch(`${API_URL}/${listId}`);
            if (response.ok) {
                const newItems = await response.json();

                // Only re-render if data has changed
                if (JSON.stringify(newItems) !== JSON.stringify(items)) {
                    items = newItems;
                    renderItems();
                }
            }
        } catch (error) {
            console.error('Error loading items:', error);
        }
    }

    async function saveAndRender() {
        try {
            await fetch(`${API_URL}/${listId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(items)
            });
            renderItems();
        } catch (error) {
            console.error('Error saving items:', error);
        }
    }

    function addItem() {
        const text = itemInput.value.trim();
        if (text === '') return;

        // Check if item with same name already exists (case-insensitive)
        const existingItem = items.find(item =>
            item.text.toLowerCase() === text.toLowerCase()
        );

        if (existingItem) {
            // Increment existing item's amount
            items = items.map(item => {
                if (item.id === existingItem.id) {
                    return { ...item, amount: (item.amount || 1) + 1 };
                }
                return item;
            });
        } else {
            // Create new item
            const newItem = {
                id: Date.now(),
                text: text,
                completed: false,
                amount: 1,
                addedBy: userName
            };
            items.push(newItem);
        }

        saveAndRender();
        itemInput.value = '';
        itemInput.focus();
    }

    function toggleItem(id) {
        items = items.map(item => {
            if (item.id === id) {
                return { ...item, completed: !item.completed };
            }
            return item;
        });
        saveAndRender();
    }

    function incrementItem(id) {
        items = items.map(item => {
            if (item.id === id) {
                return { ...item, amount: (item.amount || 1) + 1 };
            }
            return item;
        });
        saveAndRender();
    }

    function decrementItem(id) {
        items = items.map(item => {
            if (item.id === id) {
                const currentAmount = item.amount || 1;
                if (currentAmount > 1) {
                    return { ...item, amount: currentAmount - 1 };
                }
            }
            return item;
        });
        saveAndRender();
    }

    function deleteItem(id) {
        items = items.filter(item => item.id !== id);
        saveAndRender();
    }

    function deleteCompletedItems() {
        items = items.filter(item => !item.completed);
        saveAndRender();
    }

    function sortItems(direction) {
        items.sort((a, b) => {
            const textA = a.text.toLowerCase();
            const textB = b.text.toLowerCase();
            if (direction === 'asc') {
                return textA.localeCompare(textB);
            } else {
                return textB.localeCompare(textA);
            }
        });
        saveAndRender();
    }

    function renderItems() {
        shoppingList.innerHTML = '';

        // Show/hide List Controls (Sort + Delete)
        const listControls = document.getElementById('list-controls');
        const sortControls = document.querySelector('.sort-controls');

        if (items.length === 0) {
            emptyState.classList.remove('hidden');
            listControls.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            listControls.classList.remove('hidden');

            // Sort Controls Visibility (Only show if > 1 item)
            if (items.length > 1) {
                sortControls.classList.remove('hidden');
            } else {
                sortControls.classList.add('hidden');
            }

            items.forEach(item => {
                const li = document.createElement('li');
                li.className = `list-item ${item.completed ? 'completed' : ''}`;
                li.setAttribute('data-id', item.id);

                li.innerHTML = `
                    <div class="item-content">
                        <div class="checkbox" data-action="toggle"></div>
                        <div class="text-content">
                            ${item.addedBy && item.addedBy !== 'Guest' ? `<span class="item-author">${escapeHtml(item.addedBy)}</span>` : ''}
                            <span class="item-text">${escapeHtml(item.text)}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <div class="qty-controls">
                            <span class="qty-display">${item.amount || 1}</span>
                            <button class="qty-btn" data-action="increment">+</button>
                            <button class="qty-btn" data-action="decrement">-</button>
                        </div>
                        <button class="delete-btn" data-action="delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                `;
                shoppingList.appendChild(li);
            });

            // Show/Hide Delete Completed Button
            const hasCompleted = items.some(item => item.completed);
            if (hasCompleted) {
                deleteCompletedBtn.classList.remove('hidden');
                deleteCompletedBtn.style.visibility = 'visible';
            } else {
                deleteCompletedBtn.classList.add('hidden');
            }
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
