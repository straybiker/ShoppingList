// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Shopping List App E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        // Clear list before each test to ensure clean state
        await page.fill('#item-input', '/clear-cache');
        await page.click('#add-btn');
    });

    test('should open application with correct elements', async ({ page }) => {
        await expect(page).toHaveTitle(/Shopping List/);
        await expect(page.locator('h1')).toHaveText('Shopping List');
        await expect(page.locator('.subtitle')).toHaveText('Stay organized, buy smart.');
        await expect(page.locator('#item-input')).toBeVisible();

        // Check for icon usage (manifest link)
        const manifest = page.locator('link[rel="manifest"]');
        await expect(manifest).toHaveCount(1);
    });

    test('should add items to the list', async ({ page }) => {
        await page.fill('#item-input', 'Milk');
        await page.click('#add-btn');

        const item = page.locator('.list-item', { hasText: 'Milk' });
        await expect(item).toBeVisible();
        await expect(item.locator('.item-text')).toHaveText('Milk');
    });

    test('should remove items from the list', async ({ page }) => {
        // Add item first
        await page.fill('#item-input', 'Bread');
        await page.click('#add-btn');

        // Delete item
        await page.click('button[data-action="delete"]');

        await expect(page.locator('.list-item', { hasText: 'Bread' })).not.toBeVisible();
    });

    test('should select items (check and strikethrough)', async ({ page }) => {
        await page.fill('#item-input', 'Eggs');
        await page.click('#add-btn');

        const checkbox = page.locator('.checkbox-input');
        await checkbox.check();

        const listItem = page.locator('.list-item');
        await expect(listItem).toHaveClass(/completed/);

        // Verify visual strikethrough (usually handled by CSS on .completed .item-text)
        const itemText = listItem.locator('.item-text');
        await expect(itemText).toHaveCSS('text-decoration-line', 'line-through');
    });

    test('should clear selected items only', async ({ page }) => {
        // Add two items
        await page.fill('#item-input', 'Apples');
        await page.click('#add-btn');
        await page.fill('#item-input', 'Bananas');
        await page.click('#add-btn');

        // Select Apples
        const applesItem = page.locator('.list-item', { hasText: 'Apples' });
        await applesItem.locator('.checkbox-input').check();

        // Click Delete Completed
        await page.click('#delete-completed-btn');

        // Verify Apples gone, Bananas remain
        await expect(page.locator('.list-item', { hasText: 'Apples' })).not.toBeVisible();
        await expect(page.locator('.list-item', { hasText: 'Bananas' })).toBeVisible();
    });

    test('should increment and decrement item quantity', async ({ page }) => {
        await page.fill('#item-input', 'Oranges');
        await page.click('#add-btn');

        const item = page.locator('.list-item', { hasText: 'Oranges' });
        const qtyDisplay = item.locator('.qty-display');

        // Initial quantity should be 1
        await expect(qtyDisplay).toHaveText('1');

        // Increment
        await item.locator('button[data-action="increment"]').click();
        await expect(qtyDisplay).toHaveText('2');

        // Decrement
        await item.locator('button[data-action="decrement"]').click();
        await expect(qtyDisplay).toHaveText('1');

        // Decrement again (should stay at 1, assuming logic prevents 0)
        await item.locator('button[data-action="decrement"]').click();
        await expect(qtyDisplay).toHaveText('1');
    });

    test('should increment quantity when adding duplicate item', async ({ page }) => {
        // Add first time
        await page.fill('#item-input', 'Pasta');
        await page.click('#add-btn');

        const item = page.locator('.list-item', { hasText: 'Pasta' });
        await expect(item.locator('.qty-display')).toHaveText('1');

        // Add same item again (case-insensitive check usually)
        await page.fill('#item-input', 'pasta');
        await page.click('#add-btn');

        // Should still be one item, but quantity 2
        await expect(page.locator('.list-item', { hasText: 'Pasta' })).toHaveCount(1);
        await expect(item.locator('.qty-display')).toHaveText('2');
    });

    test('should remove all items and show empty message', async ({ page }) => {
        // Add item
        await page.fill('#item-input', 'Cheese');
        await page.click('#add-btn');

        // Clear list via command (simulating "remove all" if there was a button, or just deleting the last item)
        await page.click('button[data-action="delete"]');

        await expect(page.locator('#shopping-list')).toBeEmpty();
        await expect(page.locator('#empty-state')).not.toHaveClass(/hidden/);
        await expect(page.locator('#empty-state p')).toHaveText('Your list is empty.');
    });
});
