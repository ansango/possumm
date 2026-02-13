# Possumm Server

Backend service for music downloads from Bandcamp and YouTube Music using yt-dlp.

## Quick Start

Install dependencies:

```sh
bun install
```

Configure environment (optional):

```sh
cp .env.template .env
# Edit .env with your settings
```

Run development server:

```sh
bun run dev
```

Server runs at http://localhost:3000

API documentation available at http://localhost:3000/docs

## Configuration

The application creates required directories automatically:

- `./data/temp` - Temporary downloads directory
- `./data/downloads` - Final downloads destination

See [.env.template](.env.template) for all available configuration options.

## Documentation

Comprehensive documentation available in [docs/](docs/):

- Architecture and DDD layers
- Domain models and workflows
- Infrastructure components
- API reference

## Features

- ✅ Download queue with background processing
- ✅ Real-time SSE events
- ✅ Automatic metadata extraction
- ✅ Cached repositories with TTL
- ✅ Automatic cleanup of orphaned files
- ✅ Stalled download detection
