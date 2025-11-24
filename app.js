document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const itemInput = document.getElementById('item-input');
    const addBtn = document.getElementById('add-btn');
    const shoppingList = document.getElementById('shopping-list');
    const emptyState = document.getElementById('empty-state');

    // State
    let items = JSON.parse(localStorage.getItem('shoppingListItems')) || [];

    // Initialize
    renderItems();

    // Event Listeners
    addBtn.addEventListener('click', addItem);
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
            completed: false
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

    function saveAndRender() {
        localStorage.setItem('shoppingListItems', JSON.stringify(items));
        renderItems();
    }

    function renderItems() {
        shoppingList.innerHTML = '';

        if (items.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');

            items.forEach(item => {
                const li = document.createElement('li');
                li.className = `list-item ${item.completed ? 'completed' : ''}`;
                li.setAttribute('data-id', item.id);

                li.innerHTML = `
                    <div class="item-content">
                        <div class="checkbox"></div>
                        <span class="item-text">${escapeHtml(item.text)}</span>
                    </div>
                    <button class="delete-btn" aria-label="Delete item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                    </button>
                `;

                // Event listeners for this item
                const contentDiv = li.querySelector('.item-content');
                contentDiv.addEventListener('click', () => toggleItem(item.id));

                const deleteBtn = li.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                });

                shoppingList.appendChild(li);
            });
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
