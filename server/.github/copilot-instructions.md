# Copilot Instructions

## Project Overview

SvelteKit application using **Svelte 5** with runes, **Tailwind CSS v4**, and **shadcn-ui-svelte** components. Backend follows **DDD architecture** in `src/core/`.

## Tech Stack

- **Runtime**: Bun (use `bun run` for all scripts)
- **Framework**: SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$effect`)
- **Styling**: Tailwind CSS v4 (CSS-based config in `src/routes/layout.css`, OKLCH colors)
- **Components**: shadcn-ui-svelte (56 components in `src/lib/components/ui/`)
- **Testing**: Vitest (browser + node) + Playwright E2E

## Key Commands

```bash
bun run dev          # Start dev server
bun run format       # Prettier + Tailwind class sorting
bun run lint         # Prettier check + ESLint
bun run check        # TypeScript + Svelte type checking
bun run test:unit    # Vitest tests
bun run test:e2e     # Playwright tests
```

## Architecture

### Frontend (`src/routes/`, `src/lib/components/`)

- Use Svelte 5 runes, NOT Svelte 4 syntax (`let count = $state(0)` not `let count = 0`)
- Style with Tailwind classes using semantic colors (`bg-primary`, `text-foreground`)
- Prefer shadcn-ui-svelte components from `$lib/components/ui/`

### Backend DDD (`src/core/`)

```
src/core/
├── domain/         # Entities, Value Objects, Repository interfaces (NO external deps)
├── application/    # Use Cases with single execute() method
├── infrastructure/ # Concrete implementations (DB, APIs)
└── config/         # Dependency container (object composition)
```

- Domain layer has zero external dependencies
- Use Cases receive dependencies via constructor injection
- SvelteKit routes consume use cases from `$core/config/container`

### SvelteKit Server Patterns

- API routes: `src/routes/api/**/+server.ts`
- Server load: `+page.server.ts`, `+layout.server.ts`
- Form actions: Use `fail()` for validation errors, `redirect()` for success

## Code Quality Workflow

1. Write code following Svelte 5 / DDD patterns
2. Validate with `svelte-autofixer` (MCP) for `.svelte` files
3. Validate with `lint-files` (MCP) for all code files
4. Run `bun run format` to apply formatting
5. Run `bun run lint && bun run check` before delivery

## Project-Specific Conventions

- **Tailwind v4**: No `tailwind.config.js` — theme in `src/routes/layout.css` with `@theme inline`
- **Path aliases**: `$lib` → `src/lib`, `@/core` → `src/core` (configured in `svelte.config.js`)
- **Prettier**: Uses tabs, single quotes, no trailing commas (see `.prettierrc`)
- **Components**: All UI in `src/lib/components/ui/`, utilities in `src/lib/utils.ts`

## Environment Variables

SvelteKit provides type-safe environment variable access:

```typescript
// Server-only (secrets, API keys) - NEVER exposed to client
import { DATABASE_URL, API_SECRET } from '$env/static/private';
import { env } from '$env/dynamic/private';

// Client-safe (must be prefixed with PUBLIC_)
import { PUBLIC_API_URL } from '$env/static/public';
import { env } from '$env/dynamic/public';
```

- **Static**: Replaced at build time, better performance
- **Dynamic**: Read at runtime, useful for different environments
- Define variables in `.env`, `.env.local`, `.env.[mode]`

## Testing

### Unit Testing (Vitest)

- Test files: `*.spec.ts`, `*.test.ts` (co-located with source code)
- Run specific tests: `bun run test:unit -- path/to/test.spec.ts`
- Coverage: `bun run test:unit -- --coverage`
- Test structure patterns:
  - **Unit**: Pure functions, utilities, domain models
  - **Component**: Svelte components with `@testing-library/svelte`
  - **Integration**: Use Cases, repositories with mocks

#### Test Structure

- Use `describe()` to group related tests
- `it()` should describe expected behavior
- Follow Arrange-Act-Assert pattern

#### Base Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionToTest } from '$lib/module';

describe('functionToTest', () => {
	beforeEach(() => {
		// Common setup
	});

	it('should [expected behavior] when [condition]', () => {
		// Arrange
		const input = {
			/* test data */
		};

		// Act
		const result = functionToTest(input);

		// Assert
		expect(result).toEqual(expected);
	});
});
```

#### MCP Vitest Tools

```typescript
// MUST call set_project_root first
mcp_vitest_set_project_root({ path: '/absolute/path/to/project' });

// Discover test files
mcp_vitest_list_tests({ path: './src/components' });

// Run tests with structured output
mcp_vitest_run_tests({
	target: './src/lib/utils.spec.ts',
	format: 'summary', // or "detailed" for failures
	showLogs: false // true to capture console output
});

// Analyze coverage gaps
mcp_vitest_analyze_coverage({
	target: './src/core/domain',
	format: 'detailed',
	exclude: ['**/*.test.*', '**/*.spec.*']
});
```

**Workflow**: Set project root → List tests → Run specific tests → Analyze coverage → Fix gaps

### E2E Testing (Playwright)

- Test files: `e2e/**/*.test.ts`
- Run all E2E: `bun run test:e2e`
- UI mode: `bun run test:e2e -- --ui`
- Debug mode: `bun run test:e2e -- --debug`

#### Test Structure

- One file per user flow
- Use Page Object Model for complex elements
- Tests should be independent and isolated

#### Base Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
	});

	test('should allow login with valid credentials', async ({ page }) => {
		// Interaction using accessible roles
		await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('password123');
		await page.getByRole('button', { name: 'Sign In' }).click();

		// Verification
		await expect(page).toHaveURL('/dashboard');
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});
});
```

#### MCP Playwright Tools

```typescript
// Browser lifecycle
mcp_playwright_browser_navigate({ url: 'http://localhost:5173' });
mcp_playwright_browser_snapshot({}); // Get accessibility tree (preferred over screenshot)
mcp_playwright_browser_take_screenshot({ fullPage: true });
mcp_playwright_browser_close({});

// Interactions
mcp_playwright_browser_click({ element: 'Login button', ref: "button[type='submit']" });
mcp_playwright_browser_type({
	element: 'Email input',
	ref: "input[type='email']",
	text: 'user@example.com'
});
mcp_playwright_browser_fill_form({
	fields: [
		{ name: 'Email', type: 'textbox', ref: "input[name='email']", value: 'test@test.com' },
		{ name: 'Password', type: 'textbox', ref: "input[name='password']", value: 'secret' }
	]
});

// Assertions & Debugging
mcp_playwright_browser_console_messages({ onlyErrors: true });
mcp_playwright_browser_network_requests({});
mcp_playwright_browser_evaluate({ function: '() => document.title' });
```

**Workflow**: Install browser → Navigate → Snapshot → Interact → Assert → Close

## Documentation

### JSDoc Comments

- Use `/** ... */` for functions, classes, methods
- Include `@param`, `@returns`, and `@throws` tags
- Add examples where helpful with `@example`

````typescript
/**
 * Calculates the sum of two numbers.
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 * @example
 * ```ts
 * const result = sum(2, 3); // 5
 * ```
 */
function sum(a: number, b: number): number {
	return a + b;
}
````

### Markdown Docs (Starlight)

- This is a Starlight (Astro) project;
- Use Markdown for all documentation files in `docs/src/content/docs/`
- You have an astro.config.mjs set up for docs generation, where you can add new docs pages as needed with sidebar configuration. Example:

```javascript
export default defineConfig({
	integrations: [
		starlight({
			title: 'My Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' }
					]
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' }
				}
			]
		})
	]
});
```

- Please use consistent heading levels, code blocks, and link syntax.
- You have to use frontmatter for each doc file with at least `title` and `description` fields.
- Minimal Sections to include:
  - ## Introduction
  - ## Installation
  - ## Usage
  - ## Architecture
  - ## API Reference

## MCP Tools Available

- `svelte/*`: Official Svelte docs (`list-sections`, `get-documentation`, `svelte-autofixer`)
- `shadcn-ui-svelte/*`: Component library (`list_components`, `get_component_demo`)
- `eslint/*`: Linting (`lint-files`)
- `vitest/*`: Unit testing (`set_project_root`, `list_tests`, `run_tests`, `analyze_coverage`)
- `playwright/*`: E2E testing (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`)

## Specialized Agents

See `.github/agents/` for detailed instructions:

- `Frontend.agent.md`: UI development with shadcn-ui and Tailwind
- `Backend.agent.md`: DDD architecture and server-side logic
