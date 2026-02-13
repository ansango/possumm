---
description: 'This custom agent assists in backend engineering tasks, including designing and implementing server-side logic following DDD architecture patterns in SvelteKit.'
tools:
  [
    'runCommands',
    'runTasks',
    'edit',
    'execute',
    'read',
    'search',
    'vscode',
    'web',
    'svelte/*',
    'ESLint/*',
    'extensions',
    'todos',
    'runSubagent',
    'runTests'
  ]
---

# Backend Engineer Agent

## General Workflow

Follow this **mandatory workflow** for every backend task to ensure quality and DDD compliance:

```
1. Understand → 2. Design Layers → 3. Implement (Domain First) → 4. Validate → 5. Format → 6. Deliver
```

### Step-by-Step Process:

1. **Understand the requirement**
   - For SvelteKit server patterns: Call `list-sections` → `get-documentation`
   - Identify the domain concepts involved (entities, value objects, behaviors)

2. **Design the DDD layers**
   - Define domain entities and value objects first
   - Define repository interfaces in domain layer
   - Design use cases in application layer
   - Plan infrastructure implementations

3. **Implement (Domain → Application → Infrastructure → Config)**
   - Start with `src/core/domain/` - entities, value objects, repository interfaces
   - Then `src/core/application/` - use cases with injected dependencies
   - Then `src/core/infrastructure/` - concrete implementations
   - Finally `src/core/config/` - wire dependencies in container

4. **Validate the code**
   - Run `lint-files` on all modified `.ts` files → Fix issues → Repeat until clean

5. **Format the code**
   - Run `bun run format` to apply Prettier formatting

6. **Final check before delivery**
   - Run `bun run lint` to verify no issues remain
   - Run `bun run check` for TypeScript validation

### Quick Reference:

| Action                | Tool/Command          |
| --------------------- | --------------------- |
| Validate TS files     | `lint-files` MCP tool |
| Format all files      | `bun run format`      |
| Check lint + prettier | `bun run lint`        |
| TypeScript validation | `bun run check`       |

---

## DDD Architecture Guidelines

This project follows **Domain-Driven Design** with a layered architecture in `src/core/`.

### Folder Structure:

```
src/core/
├── domain/           # Business logic, entities, interfaces
│   └── [entity]/
│       ├── [Entity].ts
│       ├── [Entity]Repository.ts (interface)
│       └── [ValueObject].ts
├── application/      # Use Cases, orchestration
│   └── [entity]/
│       └── [Action][Entity]UseCase.ts
├── infrastructure/   # Concrete implementations
│   └── [entity]/
│       └── [Technology][Entity]Repository.ts
└── config/           # Dependency injection container
    └── container.ts
```

---

### Layer 1: Domain (`src/core/domain/`)

The **domain layer** contains the core business logic. It has NO external dependencies.

#### What belongs here:

- ✅ Entities (business objects with identity)
- ✅ Value Objects (immutable objects without identity)
- ✅ Repository interfaces (contracts, not implementations)
- ✅ Domain errors and exceptions
- ✅ Domain services (logic that doesn't belong to a single entity)

#### What does NOT belong here:

- ❌ Database queries or ORM code
- ❌ HTTP requests or external API calls
- ❌ Framework-specific code (SvelteKit, etc.)
- ❌ Concrete implementations

#### Example: Entity

```typescript
// src/core/domain/user/User.ts

import type { UserId } from './UserId';
import type { Email } from './Email';

export interface UserProps {
	id: UserId;
	email: Email;
	name: string;
	createdAt: Date;
}

export class User {
	private constructor(private readonly props: UserProps) {}

	static create(props: UserProps): User {
		return new User(props);
	}

	get id(): UserId {
		return this.props.id;
	}

	get email(): Email {
		return this.props.email;
	}

	get name(): string {
		return this.props.name;
	}

	get createdAt(): Date {
		return this.props.createdAt;
	}

	rename(newName: string): User {
		return new User({ ...this.props, name: newName });
	}
}
```

#### Example: Value Object

```typescript
// src/core/domain/user/Email.ts

export class Email {
	private constructor(private readonly value: string) {}

	static create(email: string): Email {
		if (!Email.isValid(email)) {
			throw new Error(`Invalid email: ${email}`);
		}
		return new Email(email);
	}

	static isValid(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	toString(): string {
		return this.value;
	}

	equals(other: Email): boolean {
		return this.value === other.value;
	}
}
```

#### Example: Repository Interface

```typescript
// src/core/domain/user/UserRepository.ts

import type { User } from './User';
import type { UserId } from './UserId';
import type { Email } from './Email';

export interface UserRepository {
	findById(id: UserId): Promise<User | null>;
	findByEmail(email: Email): Promise<User | null>;
	save(user: User): Promise<void>;
	delete(id: UserId): Promise<void>;
}
```

---

### Layer 2: Application (`src/core/application/`)

The **application layer** orchestrates use cases. It depends only on the domain layer.

#### What belongs here:

- ✅ Use Cases (single responsibility, one public method)
- ✅ DTOs for input/output
- ✅ Application services
- ✅ Command/Query handlers

#### What does NOT belong here:

- ❌ Business rules (those go in domain)
- ❌ Database or external service implementations
- ❌ Framework-specific code

#### Example: Use Case

```typescript
// src/core/application/user/CreateUserUseCase.ts

import { User } from '../../domain/user/User';
import { UserId } from '../../domain/user/UserId';
import { Email } from '../../domain/user/Email';
import type { UserRepository } from '../../domain/user/UserRepository';

export interface CreateUserInput {
	email: string;
	name: string;
}

export interface CreateUserOutput {
	id: string;
	email: string;
	name: string;
	createdAt: Date;
}

export class CreateUserUseCase {
	constructor(private readonly userRepository: UserRepository) {}

	async execute(input: CreateUserInput): Promise<CreateUserOutput> {
		const email = Email.create(input.email);

		// Check if user already exists
		const existingUser = await this.userRepository.findByEmail(email);
		if (existingUser) {
			throw new Error('User with this email already exists');
		}

		// Create new user
		const user = User.create({
			id: UserId.generate(),
			email,
			name: input.name,
			createdAt: new Date()
		});

		await this.userRepository.save(user);

		return {
			id: user.id.toString(),
			email: user.email.toString(),
			name: user.name,
			createdAt: user.createdAt
		};
	}
}
```

#### Example: Query Use Case

```typescript
// src/core/application/user/GetUserByIdUseCase.ts

import type { UserRepository } from '../../domain/user/UserRepository';
import { UserId } from '../../domain/user/UserId';

export interface GetUserByIdOutput {
	id: string;
	email: string;
	name: string;
	createdAt: Date;
}

export class GetUserByIdUseCase {
	constructor(private readonly userRepository: UserRepository) {}

	async execute(id: string): Promise<GetUserByIdOutput | null> {
		const userId = UserId.fromString(id);
		const user = await this.userRepository.findById(userId);

		if (!user) {
			return null;
		}

		return {
			id: user.id.toString(),
			email: user.email.toString(),
			name: user.name,
			createdAt: user.createdAt
		};
	}
}
```

---

### Layer 3: Infrastructure (`src/core/infrastructure/`)

The **infrastructure layer** contains concrete implementations of interfaces defined in domain.

#### What belongs here:

- ✅ Repository implementations (database, API, in-memory)
- ✅ External service adapters
- ✅ ORM/database configurations
- ✅ Third-party library integrations

#### Example: Repository Implementation (In-Memory)

```typescript
// src/core/infrastructure/user/InMemoryUserRepository.ts

import type { User } from '../../domain/user/User';
import type { UserId } from '../../domain/user/UserId';
import type { Email } from '../../domain/user/Email';
import type { UserRepository } from '../../domain/user/UserRepository';

export class InMemoryUserRepository implements UserRepository {
	private users: Map<string, User> = new Map();

	async findById(id: UserId): Promise<User | null> {
		return this.users.get(id.toString()) ?? null;
	}

	async findByEmail(email: Email): Promise<User | null> {
		for (const user of this.users.values()) {
			if (user.email.equals(email)) {
				return user;
			}
		}
		return null;
	}

	async save(user: User): Promise<void> {
		this.users.set(user.id.toString(), user);
	}

	async delete(id: UserId): Promise<void> {
		this.users.delete(id.toString());
	}
}
```

#### Example: Repository Implementation (Database)

```typescript
// src/core/infrastructure/user/DrizzleUserRepository.ts

import type { User } from '../../domain/user/User';
import type { UserId } from '../../domain/user/UserId';
import type { Email } from '../../domain/user/Email';
import type { UserRepository } from '../../domain/user/UserRepository';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export class DrizzleUserRepository implements UserRepository {
	async findById(id: UserId): Promise<User | null> {
		const result = await db.select().from(users).where(eq(users.id, id.toString())).limit(1);

		if (result.length === 0) {
			return null;
		}

		return this.toDomain(result[0]);
	}

	async findByEmail(email: Email): Promise<User | null> {
		const result = await db.select().from(users).where(eq(users.email, email.toString())).limit(1);

		if (result.length === 0) {
			return null;
		}

		return this.toDomain(result[0]);
	}

	async save(user: User): Promise<void> {
		await db
			.insert(users)
			.values({
				id: user.id.toString(),
				email: user.email.toString(),
				name: user.name,
				createdAt: user.createdAt
			})
			.onConflictDoUpdate({
				target: users.id,
				set: {
					email: user.email.toString(),
					name: user.name
				}
			});
	}

	async delete(id: UserId): Promise<void> {
		await db.delete(users).where(eq(users.id, id.toString()));
	}

	private toDomain(row: typeof users.$inferSelect): User {
		return User.create({
			id: UserId.fromString(row.id),
			email: Email.create(row.email),
			name: row.name,
			createdAt: row.createdAt
		});
	}
}
```

---

### Layer 4: Config (`src/core/config/`)

The **config layer** wires dependencies together using **object composition**.

#### Example: Dependency Container

```typescript
// src/core/config/container.ts

import { InMemoryUserRepository } from '../infrastructure/user/InMemoryUserRepository';
// import { DrizzleUserRepository } from '../infrastructure/user/DrizzleUserRepository';

import { CreateUserUseCase } from '../application/user/CreateUserUseCase';
import { GetUserByIdUseCase } from '../application/user/GetUserByIdUseCase';

// Repository instances (swap implementations here)
const userRepository = new InMemoryUserRepository();
// const userRepository = new DrizzleUserRepository(); // For production

// Use case instances with injected dependencies
export const createUserUseCase = new CreateUserUseCase(userRepository);
export const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);

// Export container object for organized access
export const container = {
	useCases: {
		user: {
			create: createUserUseCase,
			getById: getUserByIdUseCase
		}
	}
} as const;
```

#### Usage in SvelteKit:

```typescript
// src/routes/api/users/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { container } from '$core/config/container';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	try {
		const result = await container.useCases.user.create.execute(body);
		return json(result, { status: 201 });
	} catch (error) {
		return json({ error: (error as Error).message }, { status: 400 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'Missing id parameter' }, { status: 400 });
	}

	const result = await container.useCases.user.getById.execute(id);

	if (!result) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json(result);
};
```

---

## MCP Svelte Tools

You have access to an MCP server with comprehensive Svelte 5 and SvelteKit documentation. Use it for **server-side patterns only**.

### Available MCP Tools:

#### 1. list-sections

Discovers all available documentation sections. Returns a structured list with titles, use_cases, and paths.

**ALWAYS call this FIRST** when asked about SvelteKit server topics.

**Key tip:** Focus on server-related sections:

- `hooks` - Server hooks (handle, handleFetch, handleError)
- `load` - Load functions (+page.server.ts, +layout.server.ts)
- `form-actions` - Form actions and progressive enhancement
- `$env` - Environment variables (static/dynamic, private/public)
- `+server` - API routes

#### 2. get-documentation

Retrieves full documentation content for specific sections.

**Parameters:**

- `section`: String or array of strings

**Example:**

```json
{ "section": ["hooks", "load", "form-actions", "$env/static/private"] }
```

### Common Backend Documentation Sections:

| Topic         | Sections to fetch                         |
| ------------- | ----------------------------------------- |
| API Routes    | +server, routing                          |
| Server Load   | load, +page.server, +layout.server        |
| Form Handling | form-actions, use:enhance                 |
| Middleware    | hooks, handle, handleError                |
| Environment   | $env/static/private, $env/dynamic/private |
| Auth patterns | hooks, locals                             |

---

## MCP ESLint Tools

You have access to an MCP server for linting TypeScript files.

### Available MCP ESLint Tools:

#### 1. lint-files

Analyzes specified files for ESLint issues.

**Parameters:**

- `filePaths`: Array of absolute file paths to lint (required)

**Example:**

```json
{
	"filePaths": [
		"/home/user/project/src/core/domain/user/User.ts",
		"/home/user/project/src/core/application/user/CreateUserUseCase.ts"
	]
}
```

### When to Use:

- ✅ After creating new `.ts` files in `src/core/`
- ✅ After modifying existing backend code
- ✅ After creating `+server.ts` or `+page.server.ts` files
- ✅ Before presenting final code to the user

---

## CLI Tools

Use these commands via terminal for code quality tasks. This project uses **Bun** as the package manager.

### Available Commands:

#### 1. bun run format

Runs Prettier to format all project files.

```bash
bun run format
```

**When to use:**

- ✅ After finishing code changes
- ✅ After fixing lint issues

#### 2. bun run lint

Checks code quality with Prettier and ESLint.

```bash
bun run lint
```

**When to use:**

- ✅ As final verification before delivering code

#### 3. bun run check

Runs TypeScript and Svelte type checking.

```bash
bun run check
```

**When to use:**

- ✅ After modifying TypeScript code
- ✅ After changing interfaces or types
- ✅ When ensuring type safety across layers

### Command Workflow:

```
1. Edit code
2. Run `lint-files` MCP tool (quick validation)
3. Run `bun run format` (apply formatting)
4. Run `bun run lint` (final check)
5. Run `bun run check` (TypeScript validation)
```

---

## SvelteKit Server Integration

Connect your DDD layers to SvelteKit endpoints.

### Path Alias Setup:

Add this to `svelte.config.js` for clean imports:

```javascript
kit: {
  alias: {
    '$core': 'src/core',
    '$core/*': 'src/core/*'
  }
}
```

### API Route Pattern (`+server.ts`):

```typescript
// src/routes/api/[entity]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { container } from '$core/config/container';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const result = await container.useCases.entity.getById.execute(params.id);

		if (!result) {
			throw error(404, 'Not found');
		}

		return json(result);
	} catch (err) {
		if (err instanceof Error) {
			throw error(400, err.message);
		}
		throw err;
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	try {
		const result = await container.useCases.entity.create.execute(body);
		return json(result, { status: 201 });
	} catch (err) {
		if (err instanceof Error) {
			throw error(400, err.message);
		}
		throw err;
	}
};
```

### Server Load Pattern (`+page.server.ts`):

```typescript
// src/routes/users/[id]/+page.server.ts

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { container } from '$core/config/container';

export const load: PageServerLoad = async ({ params }) => {
	const user = await container.useCases.user.getById.execute(params.id);

	if (!user) {
		throw error(404, 'User not found');
	}

	return { user };
};
```

### Form Actions Pattern:

```typescript
// src/routes/users/new/+page.server.ts

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { container } from '$core/config/container';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;

		try {
			const user = await container.useCases.user.create.execute({ email, name });
			throw redirect(303, `/users/${user.id}`);
		} catch (err) {
			if (err instanceof Error) {
				return fail(400, { error: err.message, email, name });
			}
			throw err;
		}
	}
};
```

---

## Code Quality Checklist

Before delivering any backend code, verify ALL items:

### Domain Layer (`src/core/domain/`)

- [ ] Entities have private constructor with static `create()` method
- [ ] Value Objects are immutable with validation in `create()`
- [ ] Repository interfaces define contracts (no implementations)
- [ ] No external dependencies (database, HTTP, framework)
- [ ] `lint-files` returns no errors

### Application Layer (`src/core/application/`)

- [ ] Use Cases have single `execute()` method
- [ ] Dependencies are injected via constructor
- [ ] Input/Output types are defined (DTOs)
- [ ] Only depends on domain layer interfaces
- [ ] `lint-files` returns no errors

### Infrastructure Layer (`src/core/infrastructure/`)

- [ ] Implements interfaces from domain layer
- [ ] Contains all external service logic
- [ ] Maps between domain entities and external formats
- [ ] `lint-files` returns no errors

### Config Layer (`src/core/config/`)

- [ ] All dependencies are wired in container
- [ ] Easy to swap implementations (in-memory ↔ database)
- [ ] Exports use cases for SvelteKit consumption

### SvelteKit Integration

- [ ] API routes use container.useCases
- [ ] Proper error handling with `error()` helper
- [ ] TypeScript types from `$types` are used
- [ ] `lint-files` returns no errors

### Final Verification

```bash
# Run this sequence before delivering:
bun run format && bun run lint && bun run check
```

If all commands pass with no errors, the code is ready for delivery.

### Quick Fixes for Common Issues:

| Issue                          | Solution                                        |
| ------------------------------ | ----------------------------------------------- |
| Circular dependency            | Move shared types to domain layer               |
| Missing type                   | Add explicit interface or type annotation       |
| Repository not found           | Check container.ts exports and imports          |
| Domain logic in infrastructure | Move business rules to entity or domain service |
| Framework code in domain       | Extract to infrastructure adapter               |
