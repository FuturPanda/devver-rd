# Devver - Ultra-Fast Deployment System

Deploy your applications in **~10 seconds** using git diff + SCP instead of slow Docker rebuilds.

## 🎯 The Problem

Traditional Docker-based deployments are **too slow for testing**:
- Full Docker rebuild: **30-120+ seconds**
- Even cached builds: **15-30 seconds**
- Slows down development iteration

## 💡 The Solution

**Devver** uses a different approach:
1. **Git diff** to detect only changed files
2. **SCP** to transfer only those files to a long-running container
3. **Process restart** instead of container rebuild
4. **Smart dependency detection** - only reinstall when `package.json` changes

**Result: 2-5 second deployments for code-only changes!**

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│ DEVELOPER MACHINE                                       │
├─────────────────────────────────────────────────────────┤
│ CLI Tool (@devver/cli)                                  │
│  ├─ Detect git changes (git diff)                       │
│  ├─ Calculate file hashes                               │
│  ├─ Detect dependency changes (package.json, etc)       │
│  ├─ SCP changed files to container                      │
│  └─ Trigger deployment via SSH/API                      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ SCP + SSH
                          ▼
┌─────────────────────────────────────────────────────────┐
│ DEPLOYMENT CONTAINER (One per project)                  │
├─────────────────────────────────────────────────────────┤
│ /app/project-name/                                      │
│  ├─ .git/ (full repo)                                   │
│  ├─ worktrees/                                          │
│  │   ├─ main/        → PM2 process (port 3000)          │
│  │   ├─ feature-x/   → PM2 process (port 3001)          │
│  │   └─ dev/         → PM2 process (port 3002)          │
│  └─ deployment-manager/                                 │
│                                                          │
│ Nginx Reverse Proxy                                     │
│  ├─ main.project.dev       → :3000                      │
│  ├─ feature-x.project.dev  → :3001                      │
│  └─ dev.project.dev        → :3002                      │
└─────────────────────────────────────────────────────────┘
```

## 📦 Packages

This is a **Bun workspace monorepo** with the following packages:

### `packages/cli` - Developer Tool
The command-line interface developers use to deploy applications.

**Features**:
- ✅ Git diff detection
- ✅ Smart dependency detection
- ✅ Configuration management
- ✅ File hashing
- 🚧 SCP file transfer (coming soon)
- 🚧 SSH deployment trigger (coming soon)

[📖 CLI Documentation](./packages/cli/README.md)

### `packages/shared` - Common Types
Shared TypeScript types and utilities used by both CLI and deployment manager.

**Includes**:
- Deployment configuration schema
- Git changes type
- Deployment result type
- Runtime types

### `packages/server` - Deployment Manager (Coming Soon)
Container-side service that receives deployments and manages processes.

**Will include**:
- Git worktree management
- PM2 process lifecycle
- Nginx configuration
- Health checks
- REST API for CLI

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Initialize in Your Project

```bash
# Using the convenient script
bun run dvr init

# Or directly
bun run packages/cli/src/index.ts init
```

### 3. Configure Container

Edit `devver.config.json`:

```json
{
  "project": "my-app",
  "container": {
    "host": "deploy.example.com",
    "port": 22,
    "user": "deploy"
  },
  "runtime": "bun",
  "startCommand": "bun run src/main.ts"
}
```

### 4. Deploy!

```bash
# Using the convenient script
bun run dvr deploy

# Deploy specific branch
bun run dvr deploy --branch=feature-x

# Check status
bun run dvr:status
```

### 📝 Available Scripts

From the root of the monorepo:

```bash
bun run dvr          # Show help
bun run dvr init     # Initialize config
bun run dvr deploy   # Deploy current branch
bun run dvr status   # Show deployment status

# Shortcuts
bun run dvr:init     # Same as "bun run dvr init"
bun run dvr:deploy   # Same as "bun run dvr deploy"
bun run dvr:status   # Same as "bun run dvr status"
```

## ⚡ Performance Targets

| Scenario | Time | How We Achieve It |
|----------|------|-------------------|
| **Code-only changes** | **2-5 seconds** | Git diff + SCP + process restart |
| **With dependency changes** | 15-25 seconds | Smart caching + parallel install |
| **First-time deployment** | 20-40 seconds | One-time worktree setup + install |

**vs Docker rebuilds: 30-120+ seconds** 🐌

## 🛠️ Technology Stack

- **Bun** - Fast JavaScript runtime and package manager
- **Effect** - Type-safe functional programming library
- **TypeScript** - Type safety
- **Git Worktrees** - Multiple branches simultaneously
- **PM2** - Process management (in container)
- **Nginx** - Reverse proxy (in container)

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
│   │   │   ├── commands/       # init, deploy, status
│   │   │   ├── services/       # Git, Config, FileHash
│   │   │   └── index.ts        # CLI entry point
│   │   └── package.json
│   │
│   ├── shared/                 # Common types
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   └── config.ts
│   │   └── package.json
│   │
│   └── server/                 # Deployment manager (TBD)
│       └── package.json
│
├── package.json                # Root workspace config
├── bun.lock
└── README.md
```

## 📚 Documentation

- [CLI Documentation](./packages/cli/README.md)
- [Shared Types](./packages/shared/src/types.ts)
- [Architecture Plan](./docs/ARCHITECTURE.md) _(coming soon)_

## 🚧 Roadmap

### Phase 1: Core Foundation ✅ (COMPLETE)
- [x] Setup monorepo structure
- [x] Build basic CLI (init, deploy, status commands)
- [x] Implement git diff detection
- [x] Create shared types package
- [x] File hashing service

### Phase 2: Deployment Implementation 🚧 (IN PROGRESS)
- [ ] SCP file transfer
- [ ] SSH command execution
- [ ] Deployment manager API
- [ ] Container Docker image

### Phase 3: Git Worktree Integration
- [ ] Worktree creation/management
- [ ] PM2 process management
- [ ] Port allocation system
- [ ] Nginx configuration

### Phase 4: Smart Optimizations
- [ ] Dependency change detection
- [ ] File hashing and caching
- [ ] Parallel operations
- [ ] Health checks and auto-restart

### Phase 5: Production Ready
- [ ] Comprehensive testing
- [ ] CLI error handling
- [ ] Logging and monitoring
- [ ] Security hardening
- [ ] Documentation

## 💡 Key Innovations

1. **Git Worktrees**: Multiple branches deployed simultaneously without switching
2. **Smart Diff**: Only transfer files that actually changed
3. **Dependency Detection**: Skip reinstall when `package.json` unchanged
4. **Process Management**: Restart processes (1s) instead of containers (5-15s)
5. **Shared .git**: All worktrees share the same git database (space efficient)

## 🤝 Contributing

This is a private project for master-esgi/devver.

## 📄 License

Private - Not for public distribution

---

**Built with ❤️ using Bun and Effect**
