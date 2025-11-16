# Devver - Ultra-Fast Deployment System

Deploy multiple branches of your application in **~5 seconds** using intelligent diff-based deployments with content-addressable storage.

## 🎯 The Problem

Traditional Docker-based deployments are **too slow for testing**:
- Full Docker rebuild: **30-120+ seconds**
- Even cached builds: **15-30 seconds**
- Slows down development iteration
- No easy way to test multiple branches simultaneously

## 💡 The Solution

**Devver** uses a revolutionary approach:
1. **Smart git diff** - Find closest deployed branch, calculate minimal changes
2. **Content-addressable storage (CAS)** - Store files once by hash, share between branches
3. **HTTP API deployment** - Send only changed files with hashes
4. **PM2 process management** - Each branch gets its own process
5. **Dynamic nginx routing** - Automatic subdomain per branch

**Result: 2-10 second deployments with automatic file deduplication!**

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│ DEVELOPER MACHINE                                       │
├─────────────────────────────────────────────────────────┤
│ CLI Tool (@devver/cli)                                  │
│  ├─ Fetch deployed branches from server                │
│  ├─ Find closest common ancestor (git merge-base)      │
│  ├─ Calculate diff against closest branch              │
│  ├─ Hash changed files (SHA256)                        │
│  └─ Send files via HTTP API (base64 + hash)            │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP POST /api/deploy
                          ▼
┌─────────────────────────────────────────────────────────┐
│ DEPLOYMENT SERVER (@devver/server)                      │
├─────────────────────────────────────────────────────────┤
│ SQLite Database (Content-Addressable Storage)          │
│  ├─ files: hash → content (deduplicated)               │
│  ├─ branches: branch → commit → port                   │
│  └─ branch_files: tracks which files per branch        │
│                                                          │
│ File System Layout                                      │
│  ├─ /data/projects/myproject/                          │
│  │   ├─ main/         → PM2 "myproject-main" (port 4123)│
│  │   ├─ feature-x/    → PM2 "myproject-feature-x" (5678)│
│  │   └─ dev/          → PM2 "myproject-dev" (port 7890)│
│                                                          │
│ Nginx Reverse Proxy (Dynamic Config)                   │
│  ├─ main.myproject.dev       → localhost:4123          │
│  ├─ feature-x.myproject.dev  → localhost:5678          │
│  └─ dev.myproject.dev        → localhost:7890          │
└─────────────────────────────────────────────────────────┘
```

## 📦 Packages

This is a **Bun workspace monorepo** with three main packages:

### `packages/cli` - Developer Tool ✅
The command-line interface developers use to deploy applications.

**Features**:
- ✅ Git diff detection with merge-base optimization
- ✅ Smart closest-branch algorithm
- ✅ Configuration management
- ✅ File hashing (SHA256)
- ✅ HTTP deployment API client
- ✅ Branch listing and status

**Key Services**:
- `Git.ts` - Git operations (merge-base, diff, commit hash)
- `Http.ts` - HTTP client for server API
- `FileHash.ts` - SHA256 hashing
- `Config.ts` - Configuration management

[📖 CLI Documentation](./packages/cli/README.md)

### `packages/server` - Deployment Server ✅
Container-side service that receives deployments and manages processes.

**Features**:
- ✅ Content-addressable storage (SQLite)
- ✅ PM2 process lifecycle management
- ✅ Dynamic nginx configuration
- ✅ File deduplication by hash
- ✅ Branch tracking with commit history
- ✅ REST API for deployments

**Key Services**:
- `Database.ts` - SQLite CAS with file/branch/deployment tables
- `PM2.ts` - Process management (start/stop/restart)
- API endpoints: `/api/deploy`, `/api/branches`, `/api/setup`

**Database Schema**:
- `files` - Content-addressable storage (hash → content)
- `branches` - Branch metadata (project, branch, commit, port)
- `branch_files` - Many-to-many: which files belong to which branch
- `deployments` - Deployment history with timestamps

### `packages/shared` - Common Types ✅
Shared TypeScript types and utilities used by both CLI and server.

**Includes**:
- `DeploymentConfig` - Project configuration schema
- `GitChanges` - Git diff results
- `DeploymentResult` - Server response types
- Runtime types (bun, node, deno)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Start the Server (Docker)

```bash
# Build and start the server container
docker-compose up -d

# Server will be available at http://localhost:3000
# Nginx proxy at http://localhost (port 80)
```

### 3. Initialize in Your Project

```bash
# Using the convenient script
bun run dvr init

# Or directly
bun run packages/cli/src/index.ts init
```

### 4. Configure Deployment

Edit `devver.config.json`:

**For Bun/Node.js apps:**
```json
{
  "project": "my-app",
  "server": {
    "url": "http://localhost:3000"
  },
  "runtime": "bun",
  "startCommand": "bun run src/main.ts",
  "installCommand": "bun install"
}
```

**For NestJS apps:**
```json
{
  "project": "my-nestjs-app",
  "server": {
    "url": "http://localhost:3000"
  },
  "runtime": "node",
  "buildCommand": "npm run build",
  "startCommand": "npm run start:prod",
  "installCommand": "npm install"
}
```

**For TypeScript apps:**
```json
{
  "project": "my-ts-app",
  "server": {
    "url": "http://localhost:3000"
  },
  "runtime": "node",
  "buildCommand": "npm run build",
  "startCommand": "node dist/index.js",
  "installCommand": "npm install"
}
```

**Configuration options:**
- `project` - Project name (used in URLs and process names)
- `server.url` - Devver server URL
- `runtime` - Runtime environment: `"bun"`, `"node"`, `"python"`, `"go"`, `"static"`
- `buildCommand` - (Optional) Command to build your app (e.g., TypeScript compilation)
- `startCommand` - Command to start your app
- `installCommand` - (Optional) Custom install command

### 5. Setup Project on Server (First Time Only)

```bash
bun run dvr setup --repo=<git-repo-url>
```

This clones your repository to the server for future deployments.

### 6. Deploy!

```bash
# Deploy current branch
bun run dvr deploy

# Deploy specific branch
bun run dvr deploy --branch=feature-x

# Check deployment status
bun run dvr status
```

Your app will be available at `http://<branch>.<project>.localhost` (or your configured domain).

### 📝 Available Scripts

From the root of the monorepo:

```bash
bun run dvr          # Show help
bun run dvr init     # Initialize config
bun run dvr setup    # Setup project on server (first time)
bun run dvr deploy   # Deploy current branch
bun run dvr status   # Show deployment status

# Shortcuts
bun run dvr:init     # Same as "bun run dvr init"
bun run dvr:deploy   # Same as "bun run dvr deploy"
bun run dvr:status   # Same as "bun run dvr status"

# Server commands
bun run server       # Start server locally
bun run server:dev   # Start server with hot reload
```

## ⚡ Performance & How It Works

### Performance Targets

| Scenario | Time | How We Achieve It |
|----------|------|-------------------|
| **First deployment** | **10-20 seconds** | Full file upload + dependency install + PM2 start |
| **Subsequent deployments** | **2-5 seconds** | Only changed files + file deduplication + process restart |
| **Multiple branches** | **2-5 seconds** | Shared files via CAS (no duplication) |

**vs Docker rebuilds: 30-120+ seconds** 🐌

### How Deployments Work

#### 1. First Deployment (No branches on server yet)
```bash
dvr setup --repo=https://github.com/user/project.git
dvr deploy
```

**What happens:**
1. CLI: "What branches exist on server?" → Server: "None"
2. CLI: Sends ALL files from current commit (with SHA256 hashes)
3. Server: Saves files to database (hash → content)
4. Server: Creates branch directory `/data/projects/myproject/main/`
5. Server: Writes files to branch directory
6. Server: Runs `bun install` (or npm/yarn)
7. Server: Allocates port (e.g., 4123) via MD5(project-branch) % 10000 + 4000
8. Server: Starts PM2 process: `pm2 start --name myproject-main`
9. Server: Generates nginx config: `main.myproject.dev → localhost:4123`
10. Server: Reloads nginx

**Result:** `http://main.myproject.localhost` is live!

#### 2. Subsequent Deployments (Other branches)
```bash
git checkout feature-auth
dvr deploy
```

**What happens:**
1. CLI: "What branches exist?" → Server: ["main@abc123"]
2. CLI: Finds common ancestor: `git merge-base HEAD abc123` → `xyz789`
3. CLI: Gets diff: `git diff xyz789..HEAD` → ["src/auth.ts", "package.json"]
4. CLI: Hashes changed files, sends only those 2 files
5. Server: Checks if hashes exist in database (deduplication!)
   - `src/auth.ts` is new → saves to DB
   - `package.json` hash already exists → skips save (reuses)
6. Server: Creates `/data/projects/myproject/feature-auth/`
7. Server: Writes files (some from DB, some new)
8. Server: Detects `package.json` changed → runs `bun install`
9. Server: Allocates port 5678
10. Server: Starts PM2: `pm2 start --name myproject-feature-auth`
11. Server: Generates nginx: `feature-auth.myproject.dev → localhost:5678`

**Result:** `http://feature-auth.myproject.localhost` is live!

#### 3. Code-Only Changes (Fastest)
```bash
# Edit src/auth.ts
dvr deploy
```

**What happens:**
1. CLI: Finds closest branch (feature-auth@def456)
2. CLI: Diff shows only `src/auth.ts` changed
3. CLI: Sends 1 file with new hash
4. Server: Saves new hash to DB
5. Server: Updates `/data/projects/myproject/feature-auth/src/auth.ts`
6. Server: No dependency changes → skips install
7. Server: `pm2 restart myproject-feature-auth`

**Total time: ~2-3 seconds!**

### Key Optimizations

1. **Content-Addressable Storage (CAS)**
   - Files stored once by SHA256 hash
   - Same file across branches = stored once
   - Example: `package-lock.json` (large) shared between all branches

2. **Smart Diff Algorithm**
   - Finds closest deployed branch via `git merge-base`
   - Only sends files that differ from that branch
   - First deployment: sends all files
   - Subsequent: typically 1-10 files

3. **Dependency Detection**
   - Tracks if `package.json`, `bun.lockb`, `package-lock.json` changed
   - Only runs `bun install` if dependencies changed
   - Saves 5-15 seconds per deployment

4. **Process Restart vs Container Rebuild**
   - PM2 hot restart: ~500ms
   - Docker rebuild: 30-120 seconds
   - 60-240x faster!

5. **Build Step Support**
   - Optional `buildCommand` for TypeScript/NestJS apps
   - Runs automatically when configured
   - Build failures prevent deployment (safe!)

## 🎯 Framework Support

Devver works with any framework that can run in a container. Here are some common examples:

### NestJS

**Your NestJS app needs to:**
1. Read PORT from environment variable: `process.env.PORT`
2. Have a build script in package.json

**Example main.ts:**
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
```

**devver.config.json:**
```json
{
  "project": "my-nestjs-app",
  "server": { "url": "http://your-server:3000" },
  "runtime": "node",
  "buildCommand": "npm run build",
  "startCommand": "npm run start:prod"
}
```

### Express.js

```json
{
  "project": "my-express-app",
  "runtime": "node",
  "startCommand": "node src/index.js"
}
```

### Bun Server

```json
{
  "project": "my-bun-app",
  "runtime": "bun",
  "startCommand": "bun run src/index.ts"
}
```

### Next.js

```json
{
  "project": "my-nextjs-app",
  "runtime": "node",
  "buildCommand": "npm run build",
  "startCommand": "npm run start"
}
```

**Important:** All frameworks must:
- Accept PORT from environment variable (`process.env.PORT`)
- Not hardcode port numbers in the code
- Use production-ready start commands

## 🛠️ Technology Stack

- **Bun** - Fast JavaScript runtime and package manager
- **Effect-TS v3** - Type-safe functional programming with Effect.gen()
- **TypeScript** - Strict type safety with @effect/schema
- **SQLite** (bun:sqlite) - Content-addressable file storage
- **PM2** - Process management in container
- **Nginx** - Dynamic reverse proxy with subdomain routing
- **Docker** - Container deployment

### Effect-TS Architecture

All business logic uses Effect-TS for:
- **Error handling**: Custom error types with `_tag` field
- **Dependency injection**: Context.Tag + Layer pattern
- **Service composition**: Layer.mergeAll() for combining services
- **Type safety**: Runtime validation with @effect/schema

Example service pattern:
```typescript
class ConfigService extends Context.Tag("ConfigService")<ConfigService, {
  readonly load: Effect.Effect<DeploymentConfig, ConfigError>
}>() {}

const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    // Implementation
    return { load: /* ... */ }
  })
)
```

## 🧪 Development

### Workspace Commands

```bash
# Install all dependencies
bun install

# Run CLI
cd packages/cli
bun run src/index.ts <command>

# Type check all packages
bun run typecheck
```

### Project Structure

```
devver/
├── packages/
│   ├── cli/                    # Developer-facing CLI
│   │   ├── src/
│   │   │   ├── commands/       # init, deploy, status, setup
│   │   │   │   ├── deploy.ts   # Smart diff + HTTP upload
│   │   │   │   ├── init.ts     # Config creation
│   │   │   │   ├── setup.ts    # First-time repo clone
│   │   │   │   └── status.ts   # Deployment status
│   │   │   ├── services/
│   │   │   │   ├── Config.ts   # Effect service for config
│   │   │   │   ├── Git.ts      # merge-base, diff, hashing
│   │   │   │   ├── Http.ts     # API client
│   │   │   │   ├── FileHash.ts # SHA256 hashing
│   │   │   │   └── Ssh.ts      # SSH operations
│   │   │   └── index.ts        # CLI entry point
│   │   └── package.json
│   │
│   ├── server/                 # Deployment server
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── deploy.ts   # POST /api/deploy
│   │   │   │   ├── branches.ts # GET /api/branches
│   │   │   │   └── setup.ts    # POST /api/setup
│   │   │   ├── services/
│   │   │   │   ├── Database.ts # SQLite CAS
│   │   │   │   └── PM2.ts      # Process management
│   │   │   ├── index.ts        # Bun.serve()
│   │   │   └── main.ts         # Entry point
│   │   ├── Dockerfile          # PM2 + Nginx + Node.js
│   │   ├── nginx.conf          # Base nginx config
│   │   └── package.json
│   │
│   └── shared/                 # Common types
│       ├── src/
│       │   ├── types.ts        # DeploymentConfig, etc.
│       │   ├── config.ts       # Config schemas
│       │   └── index.ts
│       └── package.json
│
├── docker-compose.yml          # Server deployment
├── devver.config.json          # Project config (gitignored in real projects)
├── package.json                # Root workspace config
├── bun.lock
├── AGENTS.md                   # Developer guidelines
└── README.md
```

## 📚 Documentation

- [CLI Documentation](./packages/cli/README.md)
- [Server Documentation](./packages/server/README.md)
- [Shared Types](./packages/shared/src/types.ts)
- [Agent Guidelines](./AGENTS.md) - Code style and conventions

## 🚧 Roadmap

### Phase 1: Core Foundation ✅ (COMPLETE)
- [x] Setup monorepo structure
- [x] Build CLI (init, deploy, status, setup commands)
- [x] Implement git diff detection with merge-base
- [x] Create shared types package
- [x] File hashing service (SHA256)
- [x] HTTP API client

### Phase 2: Deployment Server ✅ (COMPLETE)
- [x] Content-addressable storage (SQLite)
- [x] Database schema (files, branches, branch_files, deployments)
- [x] PM2 service integration
- [x] Dynamic port allocation
- [x] Deployment API (POST /api/deploy)
- [x] Branch listing API (GET /api/branches)
- [x] Setup API (POST /api/setup)

### Phase 3: Nginx & Routing ✅ (COMPLETE)
- [x] Dynamic nginx configuration generation
- [x] Subdomain routing (branch.project.dev)
- [x] Nginx reload automation
- [x] Docker container with nginx + PM2

### Phase 4: Smart Optimizations ✅ (COMPLETE)
- [x] File deduplication via CAS
- [x] Closest branch detection algorithm
- [x] Dependency change detection
- [x] Minimal file transfer (diff-based)
- [x] Database tracking of deployments

### Phase 5: Production Ready 🚧 (IN PROGRESS)
- [ ] Comprehensive testing (unit + integration)
- [ ] CLI error handling improvements
- [ ] Server error handling improvements
- [ ] Logging and monitoring (structured logs)
- [ ] Security hardening (auth, HTTPS)
- [ ] Rate limiting
- [ ] Deployment rollback feature
- [ ] Health checks and auto-restart
- [ ] CLI progress indicators
- [ ] Deployment history UI

## 💡 Key Innovations

1. **Content-Addressable Storage**: Files stored once by SHA256 hash, shared between branches
   - Same `package.json` across 10 branches = stored once
   - Database deduplication happens automatically
   - Reduces storage by 80-95% for multi-branch projects

2. **Smart Closest-Branch Algorithm**: Uses git merge-base to find optimal diff
   - Compares current commit against all deployed branches
   - Finds closest common ancestor
   - Minimizes file transfer (typically 1-5 files, not entire repo)

3. **Dependency Detection**: Only reinstall when lock files change
   - Tracks `package.json`, `bun.lockb`, `package-lock.json`, `yarn.lock`
   - Skips `bun install` when unchanged
   - Saves 5-15 seconds per deployment

4. **Process Management**: PM2 hot restart instead of container rebuild
   - Restart process: ~500ms
   - Rebuild container: 30-120 seconds
   - 60-240x faster!

5. **Dynamic Routing**: Nginx configs generated per deployment
   - Each branch gets unique subdomain: `feature.project.dev`
   - Port allocation via deterministic hash: MD5(project-branch) % 10000 + 4000
   - Same branch always gets same port (stateless server)

6. **No Git on Server**: Files transferred via HTTP, not git clone
   - Server doesn't need git credentials
   - Faster than git operations
   - Works with monorepos and large repos

## 🔍 Example Deployment Flow

```bash
# Initial setup (one time)
$ dvr init
Created devver.config.json

$ dvr setup --repo=https://github.com/myuser/myapp.git
✓ Repository cloned to server

# First deployment
$ git checkout main
$ dvr deploy
→ Finding deployed branches...
→ No branches deployed yet, sending all files
→ Uploading 47 files (2.3 MB)...
→ Installing dependencies...
→ Starting PM2 process on port 4123...
→ Configuring nginx...
✓ Deployed to http://main.myapp.localhost

# Feature branch (fast!)
$ git checkout -b feature-auth
$ # ... make changes to src/auth.ts ...
$ dvr deploy
→ Finding deployed branches... found 1: main@abc123
→ Closest branch: main@abc123 (common ancestor: abc123)
→ Changed files: 1 (src/auth.ts)
→ Uploading 1 file (4.2 KB)...
→ No dependency changes, skipping install
→ Starting PM2 process on port 5678...
→ Configuring nginx...
✓ Deployed to http://feature-auth.myapp.localhost in 2.3s

# Code update (super fast!)
$ # ... edit src/auth.ts ...
$ dvr deploy
→ Finding deployed branches... found 2
→ Closest branch: feature-auth@def456 (common ancestor: def456)
→ Changed files: 1 (src/auth.ts)
→ Uploading 1 file (4.5 KB)...
→ No dependency changes, skipping install
→ Restarting PM2 process...
✓ Deployed to http://feature-auth.myapp.localhost in 1.8s
```

## 🤝 Contributing

This is a private project for master-esgi/devver.

### Development Workflow

```bash
# Install dependencies
bun install

# Run CLI locally
cd packages/cli
bun run src/index.ts deploy

# Run server locally (without Docker)
cd packages/server
bun run src/main.ts

# Type check all packages
bun run typecheck

# Run server with hot reload
cd packages/server
bun run --watch src/main.ts
```

### Code Style (see AGENTS.md)
- Use Bun APIs exclusively (no Node.js equivalents)
- All logic uses Effect-TS v3 with `Effect.gen()`
- Strict TypeScript with `@effect/schema`
- Services defined as `Context.Tag` with `Layer.effect` pattern
- Custom errors with `_tag` field, use `Effect.catchAll()`

## 🐛 Troubleshooting

### CLI Issues

**"Config file not found"**
- Run `dvr init` to create `devver.config.json`

**"Git repository not found"**
- Ensure you're in a git repository
- Run `git init` if needed

**"No branches to diff against"**
- First deployment sends all files (expected)
- Subsequent deploys will be faster

### Server Issues

**"Port already in use"**
- Check PM2 processes: `pm2 list`
- Stop conflicting process: `pm2 stop <name>`

**"Nginx config failed"**
- Check nginx syntax: `nginx -t`
- View nginx logs: `docker logs devver-server`

**"Database locked"**
- SQLite is single-writer
- Restart server: `docker restart devver-server`

### Docker Issues

**"Cannot connect to server"**
- Ensure container is running: `docker ps`
- Check logs: `docker logs devver-server`
- Restart: `docker-compose restart`

**"Bun crash: unsupported uv function: uv_version_string"**
- This is a known Bun ARM64 issue with native modules
- Fixed in Dockerfile by removing `msgpackr-extract` after install
- If you still see this, rebuild: `docker-compose up --build`

**"Server keeps restarting"**
- Check logs for errors: `docker logs -f devver-server`
- Verify ports 80 and 3333 are available
- Try: `docker-compose down && docker-compose up --build`

## 📄 License

Private - Not for public distribution

---

**Built with ❤️ using Bun, Effect-TS, and PM2**
