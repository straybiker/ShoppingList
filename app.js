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
    const STORAGE_KEY = `shoppingList_${listId}`;
    let items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    // Initialize
    renderItems();

    // Event Listeners
    addBtn.addEventListener('click', addItem);
    deleteCompletedBtn.addEventListener('click', deleteCompletedItems);
    sortAzBtn.addEventListener('click', () => sortItems('asc'));
    sortZaBtn.addEventListener('click', () => sortItems('desc'));
    itemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });

    // Functions
    function addItem() {
        const text = itemInput.value.trim();
        if (text === '') return;

        const newItem = {
            id: Date.now(),
            text: text,
            completed: false,
            amount: 1,
            addedBy: userName
        };

        items.push(newItem);
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
        // Add exit animation class before removing
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.style.transform = 'translateX(20px)';
            element.style.opacity = '0';

            setTimeout(() => {
                items = items.filter(item => item.id !== id);
                saveAndRender();
            }, 300); // Match CSS transition
        } else {
            items = items.filter(item => item.id !== id);
            saveAndRender();
        }
    }

    function deleteCompletedItems() {
        items = items.filter(item => !item.completed);
        saveAndRender();
    }

    function saveAndRender() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        renderItems();
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
                        <div class="checkbox"></div>
                        <div class="text-content">
                            ${item.addedBy ? `<span class="item-author">${escapeHtml(item.addedBy)}</span>` : ''}
                            <span class="item-text">${escapeHtml(item.text)}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <div class="qty-controls" onclick="event.stopPropagation()">
                            <span class="qty-display">${item.amount || 1}</span>
                            <button class="qty-btn minus" aria-label="Decrease quantity">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14"/>
                                </svg>
                            </button>
                            <button class="qty-btn plus" aria-label="Increase quantity">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 5v14M5 12h14"/>
                                </svg>
                            </button>
                        </div>
                        <button class="delete-btn" aria-label="Delete item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;

                // Event listeners for this item
                const contentDiv = li.querySelector('.item-content');
                contentDiv.addEventListener('click', () => toggleItem(item.id));

                const minusBtn = li.querySelector('.minus');
                minusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    decrementItem(item.id);
                });

                const plusBtn = li.querySelector('.plus');
                plusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    incrementItem(item.id);
                });

                const deleteBtn = li.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                });

                shoppingList.appendChild(li);
            });

            // Handle Delete Completed button visibility specifically
            const hasCompleted = items.some(item => item.completed);
            if (hasCompleted) {
                deleteCompletedBtn.classList.remove('hidden');
                deleteCompletedBtn.style.visibility = 'visible';
            } else {
                deleteCompletedBtn.classList.add('hidden');
            }
        }
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
