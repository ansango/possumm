# yt-dlp Command Streaming (SSE)

## Overview

Este documento describe cómo usar el nuevo endpoint de streaming para ejecutar comandos yt-dlp con feedback en tiempo real usando Server-Sent Events (SSE).

## Endpoints

### REST (Original)
- **Endpoint**: `POST /api/sandbox/yt-dlp`
- **Tipo**: Request/Response tradicional
- **Uso**: Comandos rápidos donde no necesitas feedback en tiempo real

### SSE (Nuevo)
- **Endpoint**: `POST /api/sandbox/yt-dlp/stream`
- **Tipo**: Server-Sent Events (streaming)
- **Uso**: Comandos largos, descargas, extracción de metadata donde quieres progreso en tiempo real

## Comparación

### REST (Bloquea hasta completar)
```typescript
import { useExecuteYtDlpCommand } from '$lib/queries';

const command = useExecuteYtDlpCommand();
const result = await command.mutateAsync({ command: '--version' });

console.log('Result:', result);
// Output después de completar:
// {
//   stdout: "2024.01.01\n",
//   stderr: "",
//   exitCode: 0,
//   isJsonOutput: false
// }
```

### SSE (Streaming en tiempo real)
```typescript
import { useExecuteYtDlpCommandStream } from '$lib/queries';

const stream = useExecuteYtDlpCommandStream();

await stream.execute('--version');

// Eventos recibidos en tiempo real:
// { type: 'start', command: ['yt-dlp', '--js-runtime', 'bun', '--version'] }
// { type: 'stdout', data: '2024.01.01' }
// { type: 'complete', exitCode: 0 }
```

## Tipos de Eventos SSE

### 1. `start`
Indica que el comando comenzó a ejecutarse.

```typescript
{
  type: 'start',
  command: ['yt-dlp', '--js-runtime', 'bun', '--version']
}
```

### 2. `stdout`
Línea de salida estándar del comando.

```typescript
{
  type: 'stdout',
  data: '{"title":"Song Name","artist":"Artist",...}'
}
```

### 3. `stderr`
Línea de error estándar (warnings, info).

```typescript
{
  type: 'stderr',
  data: '[youtube] Extracting URL: https://...'
}
```

### 4. `progress`
Progreso de descarga parseado automáticamente.

```typescript
{
  type: 'progress',
  percent: 45.2,
  eta: '00:05'
}
```

### 5. `complete`
Comando completado exitosamente.

```typescript
{
  type: 'complete',
  exitCode: 0
}
```

### 6. `error`
Error fatal durante la ejecución.

```typescript
{
  type: 'error',
  message: 'Failed to spawn process'
}
```

## Ejemplos de Uso

### Ejemplo 1: Hook Svelte 5 con Runes

```svelte
<script lang="ts">
	import { useExecuteYtDlpCommandStream } from '$lib/queries';

	const command = useExecuteYtDlpCommandStream();

	async function extractMetadata() {
		await command.execute(
			'--skip-download --dump-json "https://music.youtube.com/watch?v=abc123"'
		);
	}
</script>

<div>
	<button onclick={extractMetadata} disabled={command.isExecuting}>
		{command.isExecuting ? 'Extrayendo...' : 'Extraer Metadata'}
	</button>

	<button onclick={() => command.abort()} disabled={!command.isExecuting}>
		Cancelar
	</button>

	<button onclick={() => command.clear()}>
		Limpiar
	</button>

	<!-- Mostrar eventos -->
	<div class="events">
		{#each command.events as event}
			<div class="event {event.type}">
				{#if event.type === 'start'}
					<span>▶️ Iniciando: {event.command.join(' ')}</span>
				{:else if event.type === 'stdout'}
					<span>📤 {event.data}</span>
				{:else if event.type === 'stderr'}
					<span>⚠️ {event.data}</span>
				{:else if event.type === 'progress'}
					<span>📊 Progreso: {event.percent}% (ETA: {event.eta})</span>
				{:else if event.type === 'complete'}
					<span>✅ Completado (código: {event.exitCode})</span>
				{:else if event.type === 'error'}
					<span>❌ Error: {event.message}</span>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Mostrar error -->
	{#if command.error}
		<div class="error">
			Error: {command.error.message}
		</div>
	{/if}
</div>
```

### Ejemplo 2: Función Standalone con AbortController

```typescript
import { executeYtDlpCommandStream } from '$lib/queries';

const controller = new AbortController();

// Cancelar después de 10 segundos
setTimeout(() => controller.abort(), 10000);

await executeYtDlpCommandStream(
	'--skip-download --dump-json "https://example.com/album"',
	{
		onEvent: (event) => {
			switch (event.type) {
				case 'start':
					console.log('🚀 Comenzando:', event.command);
					break;
				case 'stdout':
					const metadata = JSON.parse(event.data);
					console.log('📦 Metadata:', metadata.title);
					break;
				case 'progress':
					console.log(`📊 ${event.percent}% (ETA: ${event.eta})`);
					break;
				case 'complete':
					console.log('✅ Finalizado con código:', event.exitCode);
					break;
				case 'error':
					console.error('❌ Error:', event.message);
					break;
			}
		},
		onComplete: () => {
			console.log('🎉 Stream completado!');
		},
		onError: (error) => {
			console.error('💥 Error del stream:', error);
		},
		signal: controller.signal
	}
);
```

### Ejemplo 3: Monitorear Progreso de Descarga

```svelte
<script lang="ts">
	import { useExecuteYtDlpCommandStream } from '$lib/queries';

	const stream = useExecuteYtDlpCommandStream();

	let progress = $state(0);
	let eta = $state('');

	$effect(() => {
		const lastEvent = stream.events[stream.events.length - 1];
		if (lastEvent?.type === 'progress') {
			progress = lastEvent.percent || 0;
			eta = lastEvent.eta || '';
		}
	});

	async function download() {
		await stream.execute(
			'--format best "https://music.youtube.com/watch?v=abc123"'
		);
	}
</script>

<div>
	<button onclick={download} disabled={stream.isExecuting}>
		Descargar
	</button>

	{#if stream.isExecuting}
		<div class="progress-bar">
			<div class="progress-fill" style="width: {progress}%"></div>
		</div>
		<p>{progress.toFixed(1)}% - ETA: {eta}</p>
	{/if}
</div>
```

## Casos de Uso

### ✅ Usar SSE cuando:
- Necesitas feedback en tiempo real
- Comandos que tardan varios segundos/minutos
- Quieres mostrar progreso de descarga
- Necesitas cancelar operaciones largas
- Debugging interactivo de comandos

### ✅ Usar REST cuando:
- Comandos muy rápidos (`--version`, `--help`)
- No necesitas progreso en tiempo real
- Quieres una respuesta simple y directa
- El comando completa en < 1 segundo

## Arquitectura

### Backend (Hono)
```
POST /api/sandbox/yt-dlp/stream
  ↓
ExecuteYtDlpCommandStreamRoute (route definition)
  ↓
executeYtDlpStream (handler)
  ↓
ExecuteYtDlpCommandStream (use case)
  ↓
spawn('yt-dlp', ...) (Bun process)
  ↓
Stream stdout/stderr line-by-line via SSE
```

### Frontend (SvelteKit)
```
useExecuteYtDlpCommandStream() (Svelte 5 runes)
  ↓
executeYtDlpCommandStream() (vanilla function)
  ↓
fetch() with Accept: text/event-stream
  ↓
ReadableStream reader
  ↓
Parse SSE events → invoke callbacks
```

## Ventajas SSE vs WebSocket

- **Más simple**: SSE es unidireccional (servidor → cliente)
- **HTTP estándar**: Usa HTTP/1.1 o HTTP/2
- **Auto-reconexión**: Los navegadores reconectan automáticamente
- **Text-based**: Fácil de debuggear con DevTools
- **Compatible con REST**: Mismo patrón de autenticación/headers

## Notas de Implementación

### Server (Hono)
- Usa `streamSSE` de `hono/streaming`
- Procesa stdout/stderr línea por línea
- Parsea automáticamente progreso de yt-dlp
- Maneja errores y cierra stream correctamente

### Client (SvelteKit)
- Usa `fetch()` con `Accept: text/event-stream`
- Parsea formato SSE (`event: ...\ndata: ...`)
- Soporta `AbortController` para cancelar
- Estado reactivo con Svelte 5 runes

## Debugging

### Ver eventos SSE en Chrome DevTools
1. Network tab
2. Busca la request a `/api/sandbox/yt-dlp/stream`
3. EventStream tab muestra eventos en tiempo real

### Logs del servidor
```bash
cd server
bun run dev

# Verás logs como:
# [INFO] Extracting metadata from URL: https://...
# [INFO] Spawning yt-dlp process: yt-dlp --js-runtime bun ...
# [INFO] Process spawned with PID: 12345
```

## Testing

### Unit test (caso de uso)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ExecuteYtDlpCommandStream } from '@/core/application/sandbox/use-cases/ExecuteYtDlpCommandStream';

describe('ExecuteYtDlpCommandStream', () => {
	it('should stream events', async () => {
		const events: YtDlpStreamEvent[] = [];
		const useCase = new ExecuteYtDlpCommandStream(logger);

		await useCase.execute('--version', (event) => {
			events.push(event);
		});

		expect(events).toContainEqual({ type: 'start', command: expect.any(Array) });
		expect(events).toContainEqual({ type: 'complete', exitCode: 0 });
	});
});
```

### E2E test (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test('should stream yt-dlp command execution', async ({ page }) => {
	await page.goto('/sandbox');

	const events: string[] = [];

	// Listen to SSE events
	page.on('console', (msg) => {
		if (msg.text().includes('Event:')) {
			events.push(msg.text());
		}
	});

	await page.click('button:has-text("Run Command")');

	// Wait for complete event
	await expect.poll(() => events.length).toBeGreaterThan(0);
	expect(events.some((e) => e.includes('complete'))).toBe(true);
});
```

## Referencias

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Hono Streaming](https://hono.dev/docs/helpers/streaming)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
