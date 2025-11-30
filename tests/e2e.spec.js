const { test, expect } = require('@playwright/test');

test.describe('Shopping List App E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Listen for console logs
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));

        console.log('Navigating to app...');
        await page.goto('http://localhost:3000');

        // Handle User Registration if redirected to profile
        if (page.url().includes('profile.html')) {
            console.log('Redirected to profile.html, registering user...');
            const uniqueId = Date.now();
            await page.fill('#username', `testuser_${uniqueId}`);
            await page.fill('#display-name', 'Test User');

            // Wait for navigation to complete after form submission
            await Promise.all([
                page.waitForNavigation({ timeout: 10000 }),
                page.click('button[type="submit"]')
            ]);

            // Verify we're back on the main page
            console.log(`After registration, URL: ${page.url()}`);
        }

        console.log('Navigation complete');

        // Clear list before each test to ensure clean state
        try {
            await page.waitForSelector('#item-input', { timeout: 5000 });
            await page.fill('#item-input', '/clear-cache');
            await page.keyboard.press('Enter');
            // Wait for toast or list to clear
            await page.waitForTimeout(500);
        } catch (e) {
            console.log('Failed to find #item-input or clear cache:', e);
        }
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
        await expect(item.locator('.item-author')).toHaveText('Test User');
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

        // Use force: true because the input is visually hidden
        const checkbox = page.locator('.checkbox-input');
        await checkbox.check({ force: true });

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
        await applesItem.locator('.checkbox-input').check({ force: true });

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

    test('should allow user to switch profile', async ({ page }) => {
        // Ensure we are logged in (handled by beforeEach)
        await expect(page.locator('#profile-btn')).toBeVisible();

        // Go to profile
        await page.click('#profile-btn');
        await expect(page).toHaveURL(/.*profile\.html/);

        // Switch user
        page.on('dialog', dialog => dialog.accept());
        await page.click('#switch-user-btn');

        // Should stay on profile page but fields cleared (or reloaded)
        // Since we reload, we expect to be on profile page with empty fields if local storage is cleared
        // But app.js redirects to profile if no user, so we are on profile page.
        await expect(page).toHaveURL(/.*profile\.html/);
        await expect(page.locator('#username')).toBeEmpty();
    });
});
