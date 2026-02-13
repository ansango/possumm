---
description: 'This custom agent assists in backend engineering tasks, including designing and implementing server-side logic following DDD architecture patterns.'
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
   - For Hono server patterns: Call `list-sections` → `get-documentation`
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
- ❌ Framework-specific code (Hono, etc.)
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

#### Usage in Hono:

```typescript
// src/router/download/handlers.ts

import { AppRouteHandler, AppRouteHook } from "@/types";
import { EnqueueDownloadRoute, GetDownloadStatusRoute } from "./routes";

export function createDownloadHandlers(useCases: DownloadUseCases) {
  /**
   * Handler for enqueueing a new download.
   * POST /api/downloads
   */
  const enqueue: AppRouteHandler<EnqueueDownloadRoute> = async (c) => {
    try {
      const body = c.req.valid("json");
      const result = await useCases.enqueueDownload.execute(body.url);
      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  /**
   * Handler for retrieving download status.
   * GET /api/downloads/:id
   */
  const getStatus: AppRouteHandler<GetDownloadStatusRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const result = await useCases.getDownloadStatus.execute(id);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 404);
    }
  };

  return { enqueue, getStatus };
}
```

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
- ✅ After creating route handlers in `src/router/`
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
```

---

## Hono + Zod OpenAPI Integration

Connect your DDD layers to Hono routes with automatic OpenAPI documentation.

### 1. Define Routes with Zod Schemas

```typescript
// src/router/download/routes.ts

import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

// Define schemas
const EnqueueDownloadSchema = z.object({
  url: z.string().url(),
});

const EnqueueDownloadResponseSchema = z.object({
  downloadId: z.number(),
  url: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
});

const ErrorSchema = z.object({
  error: z.string(),
});

// Create route definitions
export const enqueueDownloadRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Downloads"],
  summary: "Enqueue a new download",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EnqueueDownloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: EnqueueDownloadResponseSchema,
        },
      },
      description: "Download enqueued successfully",
    },
    400: {
      description: "Invalid URL or unsupported platform",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type EnqueueDownloadRoute = typeof enqueueDownloadRoute;
```

### 2. Create Handlers with Use Case Injection

```typescript
// src/router/download/handlers.ts

import { AppRouteHandler } from "@/types";
import { EnqueueDownloadRoute } from "./routes";
import { EnqueueDownload } from "@/core/application/download/use-cases/EnqueueDownload";

interface DownloadUseCases {
  enqueueDownload: EnqueueDownload;
  // ... other use cases
}

export function createDownloadHandlers(useCases: DownloadUseCases) {
  const enqueue: AppRouteHandler<EnqueueDownloadRoute> = async (c) => {
    try {
      const body = c.req.valid("json");
      const result = await useCases.enqueueDownload.execute(body.url);
      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  return { enqueue };
}

// Optional: validation hook
export const downloadValidationHook: AppRouteHook = (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request parameters" }, 400);
  }
};
```

### 3. Wire Everything Together

```typescript
// src/router/download/index.ts

import * as downloadHandlers from "./handlers";
import * as downloadRoutes from "./routes";
import { createRouter } from "@/server";
import { dependencies } from "@/core/config/app-setup";

// Create handlers with injected use cases
const handlers = downloadHandlers.createDownloadHandlers({
  enqueueDownload: dependencies.useCases.enqueueDownload,
  // ... other use cases
});

// Create router with OpenAPI routes
const router = createRouter()
  .basePath("/api/downloads")
  .openapi(
    downloadRoutes.enqueueDownloadRoute,
    handlers.enqueue,
    downloadHandlers.downloadValidationHook
  );
  // ... register other routes

export default router;
```

### Benefits:

- ✅ **Type-safe**: Full TypeScript inference from Zod schemas
- ✅ **Auto-documentation**: OpenAPI spec generated automatically
- ✅ **Validation**: Request/response validation with Zod
- ✅ **DDD-compliant**: Clean separation with use case injection
- ✅ **Testable**: Easy to mock use cases for testing

---

## Testing Guidelines

This project uses **Vitest** for unit testing. Follow these patterns for testing DDD layers.

### Unit Testing Use Cases

Test use cases in isolation by mocking repository dependencies:

```typescript
// src/core/application/user/CreateUserUseCase.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from './CreateUserUseCase';
import type { UserRepository } from '../../domain/user/UserRepository';

describe('CreateUserUseCase', () => {
  let mockRepository: UserRepository;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    mockRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new CreateUserUseCase(mockRepository);
  });

  it('should create user successfully', async () => {
    // Arrange
    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockRepository.save).mockResolvedValue(undefined);

    // Act
    const result = await useCase.execute({
      email: 'test@example.com',
      name: 'Test User',
    });

    // Assert
    expect(result.email).toBe('test@example.com');
    expect(result.name).toBe('Test User');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('should throw error if user already exists', async () => {
    // Arrange
    const existingUser = { /* mock user */ };
    vi.mocked(mockRepository.findByEmail).mockResolvedValue(existingUser as any);

    // Act & Assert
    await expect(
      useCase.execute({ email: 'test@example.com', name: 'Test' })
    ).rejects.toThrow('User with this email already exists');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
```

### Testing Domain Entities

Test entity behavior and invariants:

```typescript
// src/core/domain/user/Email.spec.ts

import { describe, it, expect } from 'vitest';
import { Email } from './Email';

describe('Email Value Object', () => {
  it('should create valid email', () => {
    const email = Email.create('test@example.com');
    expect(email.toString()).toBe('test@example.com');
  });

  it('should throw error for invalid email', () => {
    expect(() => Email.create('invalid-email')).toThrow('Invalid email');
  });

  it('should compare emails correctly', () => {
    const email1 = Email.create('test@example.com');
    const email2 = Email.create('test@example.com');
    const email3 = Email.create('other@example.com');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });
});
```

### Running Tests

```bash
# Run all tests
bun run test:unit

# Run specific test file
bun run test:unit -- path/to/test.spec.ts

# Run with coverage
bun run test:unit -- --coverage

# Watch mode
bun run test:unit -- --watch
```

### Testing Best Practices

- ✅ **Domain layer**: Test business logic and invariants
- ✅ **Application layer**: Mock repositories, test use case orchestration
- ✅ **Infrastructure layer**: Integration tests (optional, test DB queries)
- ✅ **Follow AAA pattern**: Arrange → Act → Assert
- ✅ **One assertion per test**: Keep tests focused and clear
- ✅ **Descriptive names**: `should [expected behavior] when [condition]`

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
- [ ] Exports use cases for consumption

### Hono Integration

- [ ] Routes defined with `createRoute` and Zod schemas
- [ ] Handlers created via factory function with use case injection
- [ ] Router wired with `.openapi()` method
- [ ] Proper error handling with typed responses
- [ ] Validation hooks implemented where needed
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
