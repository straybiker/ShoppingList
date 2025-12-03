window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error:', message, 'at', source, ':', lineno, ':', colno);
};

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const itemInput = document.getElementById('item-input');
    const addBtn = document.getElementById('add-btn');
    const shoppingList = document.getElementById('shopping-list');
    const emptyState = document.getElementById('empty-state');
    const listControls = document.getElementById('list-controls');
    const deleteCompletedBtn = document.getElementById('delete-completed-btn');
    const sortAzBtn = document.getElementById('sort-az-btn');
    const sortZaBtn = document.getElementById('sort-za-btn');
    const profileBtn = document.getElementById('profile-btn');
    const favoriteToggleBtn = document.getElementById('favorite-toggle-btn');

    // Online/Offline Status Handling
    window.addEventListener('online', () => {
        showToast('You are back online', 'success');
        document.body.classList.remove('offline');
    });

    window.addEventListener('offline', () => {
        showToast('You are offline. Changes may not save.', 'error');
        document.body.classList.add('offline');
    });

    // Initial check
    if (!navigator.onLine) {
        document.body.classList.add('offline');
    }

    // Check for saved user/list in URL
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('user')) {
        localStorage.setItem('username', urlParams.get('user'));
    }

    if (urlParams.has('list')) {
        localStorage.setItem('currentListId', urlParams.get('list'));
    }

    // Clean URL if parameters were present
    if (urlParams.has('user') || urlParams.has('list')) {
        window.history.replaceState({}, document.title, "/");
    }

    const listId = localStorage.getItem('currentListId') || 'default';

    // User Identification
    const storedUsername = localStorage.getItem('username');
    const storedDisplayName = localStorage.getItem('displayName');

    if (!storedUsername) {
        window.location.href = '/profile.html';
        return;
    }

    const userName = storedUsername;
    const displayName = storedDisplayName || userName;

    // State
    const API_URL = '/api/items';
    let items = [];
    let currentSortDirection = null; // 'asc' or 'desc'
    let isUpdating = false;
    let configMode = null; // 'lists' | 'users' | null
    let previousListId = null; // Store previous list ID for return
    let previousListName = null; // Store previous list display name
    let eventSource = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Generate unique ID
    function generateUniqueId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Deep equality check for arrays (more efficient than JSON.stringify)
    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
                return false;
            }
        }
        return true;
    }

    // Functions
    async function loadItems() {
        if (configMode) return; // Don't load items in config mode
        if (isUpdating) return; // Skip refresh if user is updating

        try {
            const response = await fetch(`${API_URL}/${listId}`);
            if (response.ok) {
                const newItems = await response.json();

                // Check again if an update started while we were fetching
                if (isUpdating) return;

                // Only re-render if data has changed
                if (!arraysEqual(newItems, items)) {
                    items = newItems;
                    if (currentSortDirection) {
                        applySort();
                    }
                    renderItems();
                    checkFavoriteStatus(); // Update favorite status
                }
            }
        } catch (error) {
            console.error('Error loading items:', error);
            showError('Error loading items');
        }
    }

    async function loadLists() {
        try {
            const response = await fetch(`/api/lists?t=${Date.now()}`);
            if (response.ok) {
                const lists = await response.json();
                // Map lists to item structure for rendering
                items = lists.map(list => ({
                    id: list.name,
                    text: list.displayName || list.name,
                    completed: false,
                    amount: null,
                    addedBy: null,
                    updatedAt: list.updatedAt,
                    itemCount: list.itemCount
                }));
                renderItems();
            }
        } catch (error) {
            console.error('Error loading lists:', error);
            showError('Error loading lists');
        }
    }

    async function loadUsers() {
        try {
            const response = await fetch(`/api/users?t=${Date.now()}`);
            if (response.ok) {
                const users = await response.json();
                // Map users to item structure for rendering
                items = users.map(user => ({
                    id: user.name,
                    text: `${user.name} / ${user.displayName || user.name}`,
                    completed: false,
                    amount: null,
                    addedBy: null,
                    updatedAt: user.lastSeen,
                    isUser: true // Flag to identify user items
                }));
                renderItems();
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showError('Error loading users');
        }
    }

    async function addItem() {
        const text = itemInput.value.trim();
        if (text === '') return;

        // Handle Slash Commands
        if (text.startsWith('/')) {
            if (text === '/clear-cache') {
                await clearList();
                itemInput.value = '';
                return;
            } else if (text === '/config-lists') {
                // Fetch current list name before switching
                try {
                    const response = await fetch(`/api/lists/${listId}`);
                    if (response.ok) {
                        const listData = await response.json();
                        previousListName = listData.displayName;
                    } else {
                        previousListName = listId;
                    }
                } catch (e) {
                    previousListName = listId;
                }

                configMode = 'lists';
                previousListId = listId; // Store current list
                itemInput.value = '';
                itemInput.placeholder = 'Add new list...'; // Update placeholder
                document.querySelector('.app-header h1').textContent = 'Configuration';
                document.querySelector('.subtitle').textContent = 'Manage Lists';
                await loadLists();
                return;
            } else if (text === '/config-users') {
                // Fetch current list name before switching
                try {
                    const response = await fetch(`/api/lists/${listId}`);
                    if (response.ok) {
                        const listData = await response.json();
                        previousListName = listData.displayName;
                    } else {
                        previousListName = listId;
                    }
                } catch (e) {
                    previousListName = listId;
                }

                configMode = 'users';
                previousListId = listId; // Store current list
                itemInput.value = '';
                itemInput.placeholder = 'Enter command...'; // Update placeholder
                document.querySelector('.app-header h1').textContent = 'User Configuration';
                document.querySelector('.subtitle').textContent = 'Manage Users';
                await loadUsers();
                return;
            } else {
                showError('Unknown command. Supported: /clear-cache, /config-lists, /config-users');
                return;
            }
        }

        // Handle list creation in config mode
        if (configMode === 'lists') {
            try {
                const response = await fetch('/api/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: text })
                });

                if (response.ok) {
                    const result = await response.json();
                    showToast(`List "${result.displayName}" created successfully`, 'success');
                    await loadLists();
                    itemInput.value = '';
                    itemInput.focus();
                } else {
                    const errText = await response.text();
                    showError('Failed to create list: ' + errText);
                }
            } catch (error) {
                console.error('Error creating list:', error);
                showError('Error creating list');
            }
            return;
        }

        // Check if item with same name already exists (case-insensitive)
        const existingItem = items.find(item =>
            item.text.toLowerCase() === text.toLowerCase()
        );

        if (existingItem) {
            // Increment existing item's amount via PATCH
            incrementItem(existingItem.id);
            itemInput.value = '';
            itemInput.focus();
            return;
        }

        const newItem = {
            id: generateUniqueId(),
            text: text,
            completed: false,
            amount: 1,
            addedBy: userName,
            authorName: displayName
        };

        isUpdating = true;
        try {
            const response = await fetch(`${API_URL}/${listId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newItem,
                    displayName: localStorage.getItem('currentListName') // Send current list name
                })
            });

            if (response.ok) {
                items.push(newItem);
                if (currentSortDirection) {
                    applySort();
                }
                renderItems();
                itemInput.value = '';
                itemInput.focus();
            } else {
                const errText = await response.text();
                console.error('Failed to add item:', errText);
                showError('Failed to add item: ' + errText);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            showError('Error adding item');
        } finally {
            isUpdating = false;
        }
    }

    async function toggleItem(id) {
        const item = items.find(i => String(i.id) === id);
        if (!item) return;

        const newCompleted = !item.completed;
        isUpdating = true;

        try {
            const response = await fetch(`${API_URL}/${listId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: newCompleted })
            });

            if (response.ok) {
                item.completed = newCompleted;
                renderItems();
            }
        } catch (error) {
            console.error('Error toggling item:', error);
            showError('Error toggling item');
        } finally {
            isUpdating = false;
        }
    }

    async function incrementItem(id) {
        const item = items.find(i => String(i.id) === id);
        if (!item) return;

        const newAmount = (item.amount || 1) + 1;
        isUpdating = true;

        try {
            const response = await fetch(`${API_URL}/${listId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: newAmount })
            });

            if (response.ok) {
                item.amount = newAmount;
                renderItems();
            }
        } catch (error) {
            console.error('Error incrementing item:', error);
            showError('Error incrementing item');
        } finally {
            isUpdating = false;
        }
    }

    async function decrementItem(id) {
        const item = items.find(i => String(i.id) === id);
        if (!item) return;

        const currentAmount = item.amount || 1;
        if (currentAmount <= 1) return;

        const newAmount = currentAmount - 1;
        isUpdating = true;

        try {
            const response = await fetch(`${API_URL}/${listId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: newAmount })
            });

            if (response.ok) {
                item.amount = newAmount;
                renderItems();
            }
        } catch (error) {
            console.error('Error decrementing item:', error);
            showError('Error decrementing item');
        } finally {
            isUpdating = false;
        }
    }

    async function deleteItem(id) {
        if (configMode === 'lists') {
            await deleteList(id);
            return;
        } else if (configMode === 'users') {
            await deleteUser(id);
            return;
        }

        isUpdating = true;
        try {
            const response = await fetch(`${API_URL}/${listId}/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                items = items.filter(item => String(item.id) !== id);
                renderItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showError('Error deleting item');
        } finally {
            isUpdating = false;
        }
    }

    async function deleteList(id) {
        try {
            // Get list name for toast
            const list = items.find(i => i.id === id);
            const listName = list ? list.text : id;

            const response = await fetch(`/api/lists/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast(`List "${listName}" deleted successfully`, 'success');
                await loadLists();
            } else {
                showError('Failed to delete list');
            }
        } catch (error) {
            console.error('Error deleting list:', error);
            showError('Error deleting list');
        }
    }

    async function deleteUser(username) {
        const user = items.find(i => i.id === username);
        const displayName = user ? user.text : username;

        try {
            const response = await fetch(`/api/users/${username}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast(`User "${displayName}" deleted successfully`, 'success');
                await loadUsers();
            } else {
                showError('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showError('Error deleting user');
        }
    }

    async function deleteCompletedItems() {
        isUpdating = true;
        try {
            const response = await fetch(`${API_URL}/${listId}/completed`, {
                method: 'DELETE'
            });

            if (response.ok) {
                items = items.filter(item => !item.completed);
                renderItems();
            }
        } catch (error) {
            console.error('Error deleting completed items:', error);
            showError('Error deleting completed items');
        } finally {
            isUpdating = false;
        }
    }

    async function clearList() {
        isUpdating = true;
        try {
            const response = await fetch(`${API_URL}/${listId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                items = [];
                renderItems();
                showToast('List cleared successfully', 'success');
            } else {
                showError('Failed to clear list');
            }
        } catch (error) {
            console.error('Error clearing list:', error);
            showError('Error clearing list');
        } finally {
            isUpdating = false;
        }
    }

    async function checkFavoriteStatus() {
        if (!storedUsername || configMode) {
            favoriteToggleBtn.classList.add('hidden');
            return;
        }

        favoriteToggleBtn.classList.remove('hidden');

        try {
            const response = await fetch(`/api/favorites/${storedUsername}`);
            if (response.ok) {
                const favorites = await response.json();
                const isFavorite = favorites.includes(listId);

                if (isFavorite) {
                    favoriteToggleBtn.classList.add('favorited');
                    favoriteToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
                } else {
                    favoriteToggleBtn.classList.remove('favorited');
                    favoriteToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
                }
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
        }
    }

    async function toggleFavorite() {
        if (!storedUsername) return;

        try {
            const response = await fetch(`/api/favorites/${storedUsername}/${listId}`, {
                method: 'POST'
            });

            if (response.ok) {
                const data = await response.json();
                const isFavorite = data.favorites.includes(listId);

                if (isFavorite) {
                    favoriteToggleBtn.classList.add('favorited');
                    favoriteToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
                    showToast('List added to favorites', 'success');
                } else {
                    favoriteToggleBtn.classList.remove('favorited');
                    favoriteToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
                    showToast('List removed from favorites', 'success');
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            showError('Failed to update favorite status');
        }
    }

    function sortItems(direction) {
        currentSortDirection = direction;
        applySort();
        renderItems();
    }

    function applySort() {
        if (!currentSortDirection) return;

        items.sort((a, b) => {
            const textA = a.text.toLowerCase();
            const textB = b.text.toLowerCase();
            if (currentSortDirection === 'asc') {
                return textA.localeCompare(textB);
            } else {
                return textB.localeCompare(textA);
            }
        });
    }

    function renderItems() {
        // Show/hide List Controls (Sort + Delete)
        const listControls = document.getElementById('list-controls');
        const sortControls = document.querySelector('.sort-controls');

        if (!items || items.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = '<p>Your list is empty.</p>';
            listControls.classList.add('hidden');
            shoppingList.innerHTML = ''; // Clear list if empty

            if (configMode) {
                const targetList = previousListId || 'default';

                // Check if target list exists (only if we are in lists config mode)
                let targetExists = true;
                if (configMode === 'lists') {
                    targetExists = items.some(i => i.id === targetList);
                }

                const returnLi = document.createElement('li');
                returnLi.className = 'list-item';
                returnLi.style.justifyContent = 'center';
                returnLi.style.cursor = targetExists ? 'pointer' : 'default';
                returnLi.style.marginTop = '20px';

                const btnText = targetExists ? `Return to ${escapeHtml(targetList)}` : `List "${escapeHtml(targetList)}" Deleted`;
                const btnStyle = targetExists ? 'width: 100%;' : 'width: 100%; opacity: 0.5; cursor: not-allowed;';

                returnLi.innerHTML = `
                    <button class="sort-btn" id="return-btn" style="${btnStyle}" ${targetExists ? '' : 'disabled'}>${btnText}</button>
                `;
                if (targetExists) {
                    returnLi.addEventListener('click', () => {
                        localStorage.setItem('currentListId', targetList);
                        window.location.href = '/';
                    });
                }
                shoppingList.appendChild(returnLi);
            }
            return;
        }

        emptyState.classList.remove('hidden');
        emptyState.innerHTML = '<p>Happy shopping</p>';
        listControls.classList.remove('hidden');

        // Sort Controls Visibility (Only show if > 1 item and NOT in config mode)
        if (items.length > 1 && !configMode) {
            sortControls.classList.remove('hidden');
        } else {
            sortControls.classList.add('hidden');
        }

        // Create a map of existing DOM elements by data-id
        const existingElements = new Map();
        shoppingList.querySelectorAll('.list-item').forEach(el => {
            existingElements.set(el.getAttribute('data-id'), el);
        });

        // Track which IDs we've processed to know what to remove later
        const processedIds = new Set();

        items.forEach(item => {
            processedIds.add(String(item.id));
            let li = existingElements.get(String(item.id));

            if (li) {
                // Update existing element
                if (li.className !== `list-item ${item.completed ? 'completed' : ''}`) {
                    li.className = `list-item ${item.completed ? 'completed' : ''}`;
                }

                // Update text if changed
                const textSpan = li.querySelector('.item-text');
                if (textSpan && textSpan.textContent !== item.text) {
                    textSpan.textContent = item.text;
                }

                // Handle Meta Text (Author in normal mode, Date in config mode)
                const metaSpan = li.querySelector('.item-author');
                // textSpan is already defined above
                let metaText = null;

                if (configMode) {
                    metaText = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Never updated';
                } else if (item.authorName) {
                    metaText = item.authorName;
                } else if (item.addedBy && item.addedBy !== 'Guest') {
                    metaText = item.addedBy;
                }

                if (metaText) {
                    if (!metaSpan) {
                        const textContentDiv = li.querySelector('.text-content');
                        const newMetaSpan = document.createElement('span');
                        newMetaSpan.className = 'item-author';
                        if (configMode) newMetaSpan.style.textTransform = 'none';
                        newMetaSpan.textContent = metaText;
                        textContentDiv.insertBefore(newMetaSpan, textSpan);
                    } else {
                        if (metaSpan.textContent !== metaText) metaSpan.textContent = metaText;
                        if (configMode) metaSpan.style.textTransform = 'none';
                        else metaSpan.style.textTransform = '';
                    }
                } else if (metaSpan) {
                    metaSpan.remove();
                }

                if (!configMode) {
                    // Update amount
                    const qtyDisplay = li.querySelector('.qty-display');
                    if (qtyDisplay && qtyDisplay.textContent !== String(item.amount || 1)) {
                        qtyDisplay.textContent = item.amount || 1;
                    }
                }

                // Ensure order (appendChild moves it to the end if it exists elsewhere)
                shoppingList.appendChild(li);

            } else {
                // Create new element
                li = document.createElement('li');
                li.className = `list-item ${item.completed ? 'completed' : ''}`;
                li.setAttribute('data-id', item.id);

                const checkboxHtml = configMode ? '' : `
                    <input type="checkbox" id="item-${item.id}" class="checkbox-input" ${item.completed ? 'checked' : ''} aria-label="Toggle ${escapeHtml(item.text)}">
                    <label for="item-${item.id}" class="checkbox-custom"></label>
                `;

                let metaHtml = '';
                if (configMode) {
                    const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Never updated';
                    metaHtml = `<span class="item-author" style="text-transform: none;">${escapeHtml(dateStr)}</span>`;
                } else if (item.authorName) {
                    metaHtml = `<span class="item-author">${escapeHtml(item.authorName)}</span>`;
                } else if (item.addedBy && item.addedBy !== 'Guest') {
                    metaHtml = `<span class="item-author">${escapeHtml(item.addedBy)}</span>`;
                }

                const qtyHtml = (configMode === 'lists') ? `
                    <button class="qty-btn" data-action="open" aria-label="Open list ${escapeHtml(item.text)}" style="width: auto; padding: 0 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                ` : (configMode === 'users') ? '' : `
                    <div class="qty-controls">
                        <span class="qty-display">${item.amount || 1}</span>
                        <button class="qty-btn" data-action="increment" aria-label="Increase quantity for ${escapeHtml(item.text)}">+</button>
                        <button class="qty-btn" data-action="decrement" aria-label="Decrease quantity for ${escapeHtml(item.text)}">-</button>
                    </div>
                `;

                const deleteIconColor = configMode ? 'color: var(--danger-color);' : '';

                li.innerHTML = `
                    <div class="item-content" data-action="${configMode ? '' : 'toggle'}">
                        ${checkboxHtml}
                        <div class="text-content">
                            ${metaHtml}
                            <span class="item-text">${escapeHtml(item.text)}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        ${qtyHtml}
                        <button class="delete-btn" data-action="delete" aria-label="Delete ${escapeHtml(item.text)}" style="${deleteIconColor}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                `;
                shoppingList.appendChild(li);
            }
        });

        // Add Return Button in Config Mode (Always show)
        if (configMode) {
            const targetList = previousListId || 'default';
            const targetName = previousListName || targetList;

            // Check if target list exists (only if we are in lists config mode)
            let targetExists = true;
            if (configMode === 'lists') {
                targetExists = items.some(i => i.id === targetList);
            }

            const returnLi = document.createElement('li');
            returnLi.className = 'list-item';
            returnLi.style.justifyContent = 'center';
            returnLi.style.cursor = targetExists ? 'pointer' : 'default';
            returnLi.style.marginTop = '20px';

            const btnText = targetExists ? `Return to ${escapeHtml(targetName)}` : `List "${escapeHtml(targetName)}" Deleted`;
            const btnStyle = targetExists ? 'width: 100%;' : 'width: 100%; opacity: 0.5; cursor: not-allowed;';

            returnLi.innerHTML = `
                <button class="sort-btn" id="return-btn" style="${btnStyle}" ${targetExists ? '' : 'disabled'}>${btnText}</button>
            `;
            if (targetExists) {
                returnLi.addEventListener('click', () => {
                    localStorage.setItem('currentListId', targetList);
                    // Persist the name so we can restore it if the list was deleted
                    if (targetName !== targetList) {
                        localStorage.setItem('currentListName', targetName);
                    }
                    window.location.href = '/';
                });
            }
            shoppingList.appendChild(returnLi);
        }

        // Remove elements that are no longer in the list
        existingElements.forEach((el, id) => {
            if (!processedIds.has(id)) {
                el.remove();
            }
        });

        // Show/Hide Delete Completed Button (Hide in config mode)
        const hasCompleted = items.some(item => item.completed);
        if (hasCompleted && !configMode) {
            deleteCompletedBtn.classList.remove('hidden');
            deleteCompletedBtn.style.visibility = 'visible';
        } else {
            deleteCompletedBtn.classList.add('hidden');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Simple toast for user-visible errors
    function showToast(message, type = 'default', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `app-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Force reflow for animation
        // eslint-disable-next-line no-unused-expressions
        toast.offsetHeight;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showError(message) {
        console.error(message);
        try {
            showToast(message, 'error');
        } catch (e) {
            // fallback
        }
    }

    // Setup SSE with error handling and reconnection
    function setupSSE() {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
            console.log('SSE connection established');
            reconnectAttempts = 0;
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'update') {
                loadItems();
            } else if (data.type === 'connected') {
                console.log('Connected to SSE with client ID:', data.clientId);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            eventSource.close();

            // Attempt to reconnect with exponential backoff
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

                setTimeout(() => {
                    reconnectAttempts++;
                    setupSSE();
                }, backoffTime);
            } else {
                console.error('Max reconnection attempts reached. Please refresh the page.');
            }
        };
    }

    // Initialize
    renderItems(); // Show empty state immediately if needed
    loadItems();
    checkFavoriteStatus();
    setupSSE();

    // Event Listeners
    if (addBtn) {
        addBtn.addEventListener('click', addItem);
    }

    if (itemInput) {
        itemInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addItem();
            }
        });
    }

    if (deleteCompletedBtn) {
        deleteCompletedBtn.addEventListener('click', deleteCompletedItems);
    }

    if (sortAzBtn) {
        sortAzBtn.addEventListener('click', () => {
            currentSortDirection = 'asc';
            applySort();
            renderItems();
        });
    }

    if (sortZaBtn) {
        sortZaBtn.addEventListener('click', () => {
            currentSortDirection = 'desc';
            applySort();
            renderItems();
        });
    }

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = '/profile.html';
        });
    }

    if (favoriteToggleBtn) {
        favoriteToggleBtn.addEventListener('click', toggleFavorite);
    }

    shoppingList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const listItem = target.closest('.list-item');
        if (!listItem) return;

        const itemId = listItem.getAttribute('data-id');
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
            case 'open':
                localStorage.setItem('currentListId', itemId);
                // Save the display name (which is in the text content)
                const textSpan = listItem.querySelector('.item-text');
                if (textSpan) {
                    localStorage.setItem('currentListName', textSpan.textContent);
                }
                window.location.href = '/';
                break;
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });
});
