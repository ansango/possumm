// spec: specs/user-management.plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create User Functionality', () => {
	test('Create user with valid data', async ({ page }) => {
		// Navigate to http://localhost:4173/users
		await page.goto('http://localhost:4173/users');

		// Wait for the users table to load
		await page.getByText('Loading users...').first().waitFor({ state: 'hidden' });

		// Click the 'Add User' button
		await page.getByRole('button', { name: 'Add User' }).click();

		// Verify the 'Create User' dialog opens
		await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible();

		// Fill in Name field with 'Ana García'
		await page.getByRole('textbox', { name: 'Name' }).fill('Ana García');

		// Fill in Email field with 'ana.garcia@example.com'
		await page.getByRole('textbox', { name: 'Email' }).fill('ana.garcia@example.com');

		// Click 'Create User' button
		await page.getByRole('button', { name: 'Create User' }).click();

		// Verify new user appears in the table with correct name
		await expect(page.getByText('Ana García')).toBeVisible();

		// Verify new user appears in the table with correct email
		await expect(page.getByText('ana.garcia@example.com')).toBeVisible();

		// Verify new user row shows creation date (today's date)
		await expect(page.getByText('Dec 15, 2025')).toBeVisible();
	});
});
