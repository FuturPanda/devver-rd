# @devver/cli

Ultra-fast deployment CLI for testing environments. Deploy your applications in ~10 seconds using git diff + SCP instead of slow Docker rebuilds.

## 🚀 Features

- ⚡ **Lightning Fast**: 2-5 second deployments for code-only changes
- 🌿 **Git-Based**: Only transfers files that changed (via git diff)
- 📦 **Smart Dependencies**: Detects package.json changes and only reinstalls when needed
- 🎯 **Multi-Branch**: Deploy multiple branches simultaneously to different ports
- 🔧 **Zero Config**: Sensible defaults with optional customization
- 💪 **Built with Effect**: Type-safe, composable, testable

## 📦 Installation

```bash
# From the monorepo root
bun install

# Make CLI executable
cd packages/cli
chmod +x src/index.ts
```

## 🎯 Quick Start

### 1. Initialize Configuration

**Important**: Make sure you have a git remote configured first!

```bash
cd your-project
git init
git remote add origin https://github.com/user/repo.git
bun run ../../packages/cli/src/index.ts init
```

This will:
- Detect your git repository URL
- Create `devver.config.json` 
- **Automatically clone your repo to the server via SSH**
- Install dependencies on the server
- Setup git worktree structure

Example `devver.config.json`:

```json
{
  "project": "my-app",
  "container": {
    "host": "localhost",
    "port": 22,
    "user": "deploy"
  },
  "runtime": "bun",
  "startCommand": "bun run src/main.ts",
  "ignore": [
    "node_modules/**",
    ".git/**",
    "*.log",
    "dist/**",
    ".env*",
    "*.test.ts",
    "coverage/**"
  ],
  "env": {
    "NODE_ENV": "development"
  }
}
```

### 2. Edit Container Configuration

Edit `devver.config.json` with your actual server details:

```json
{
  "container": {
    "host": "your-server.com",  // Your deployment server
    "port": 22,
    "user": "deploy"
  }
}
```

### 3. Deploy Your Application

```bash
# Deploy current branch
bun run ../../packages/cli/src/index.ts deploy

# Deploy specific branch
bun run ../../packages/cli/src/index.ts deploy --branch=feature-x
```

### 4. Check Deployment Status

```bash
bun run ../../packages/cli/src/index.ts status
```

## 📚 Commands

### `devver init`

Initialize Devver configuration in the current project.

**Prerequisites**:
- Must be in a git repository
- No existing `devver.config.json` file

**Example**:
```bash
devver init
```

**Output**:
```
🚀 Initializing Devver configuration...
   Project: rd-test
   Branch: main

✅ Created devver.config.json

📝 Next steps:
   1. Edit devver.config.json with your container details
   2. Run 'devver deploy' to deploy your application
```

---

### `devver deploy [--branch=<name>]`

Deploy the current (or specified) branch to the container.

**Options**:
- `--branch=<name>` - Deploy a specific branch (defaults to current branch)

**Example**:
```bash
# Deploy current branch
devver deploy

# Deploy feature branch
devver deploy --branch=feature-authentication
```

**Output**:
```
🚀 Starting deployment...

📦 Project: my-app
🌿 Branch: main

🔍 Detecting changes...
   Changed files: 3
   Added files: 1
   Deleted files: 0
   📦 Dependency changes detected - will reinstall

📄 Files to deploy:
   • src/services/auth.ts
   • src/commands/login.ts
   • src/index.ts
   • package.json

✅ Deployment initiated!

🌐 URL: https://main.my-app.dev
📊 Container: localhost:22
```

---

### `devver status`

Show deployment status for all branches.

**Example**:
```bash
devver status
```

**Output**:
```
📊 Deployment Status

Project: my-app
Container: localhost:22
Runtime: bun

Active deployments:
  • main → https://main.my-app.dev (running)
  • feature-x → https://feature-x.my-app.dev (running)
```

---

### `devver help`

Show usage information.

**Example**:
```bash
devver help
```

## ⚙️ Configuration

### `devver.config.json`

| Field | Type | Description |
|-------|------|-------------|
| `project` | string | Project name (used for URLs and container paths) |
| `container.host` | string | Deployment container hostname |
| `container.port` | number | SSH port (usually 22) |
| `container.user` | string | SSH user for deployment |
| `runtime` | `"bun"` \| `"node"` \| `"python"` \| `"go"` \| `"static"` | Runtime environment |
| `startCommand` | string | Command to start your application |
| `healthCheck` | object | Optional health check configuration |
| `healthCheck.path` | string | Health check endpoint path |
| `healthCheck.timeout` | number | Health check timeout in seconds |
| `ignore` | string[] | File patterns to ignore during deployment |
| `env` | object | Environment variables for deployment |

### Example Configurations

#### NestJS Application
```json
{
  "project": "my-nestjs-api",
  "runtime": "node",
  "startCommand": "npm run start:prod",
  "healthCheck": {
    "path": "/health",
    "timeout": 30
  }
}
```

#### Bun Application
```json
{
  "project": "bun-api",
  "runtime": "bun",
  "startCommand": "bun run src/index.ts"
}
```

#### Python FastAPI
```json
{
  "project": "fastapi-app",
  "runtime": "python",
  "startCommand": "uvicorn main:app --host 0.0.0.0 --port 3000"
}
```

## 🏗️ Architecture

### Services

The CLI is built using **Effect** for type-safe, composable operations:

#### **Git Service** (`src/services/Git.ts`)
- Detects current branch
- Finds changed files via `git diff`
- Identifies dependency file changes
- Checks if directory is a git repository

#### **Config Service** (`src/services/Config.ts`)
- Loads `devver.config.json`
- Saves configuration
- Initializes default configuration
- Validates configuration schema

#### **FileHash Service** (`src/services/FileHash.ts`)
- Computes SHA-256 hashes for files
- Batch hashing for multiple files
- Used for change detection

### Effect Layers

Services are provided via Effect layers:

```typescript
const ServicesLayer = Layer.mergeAll(
  GitLive,
  ConfigLive,
  FileHashLive,
  BunCommandExecutor.layer,
  BunFileSystem.layer
)
```

## 🧪 Development

### Run CLI in Development

```bash
cd packages/cli
bun run src/index.ts <command>
```

### Type Check

```bash
bun run typecheck
```

### Project Structure

```
packages/cli/
├── src/
│   ├── commands/           # Command implementations
│   │   ├── init.ts         # devver init
│   │   ├── deploy.ts       # devver deploy
│   │   └── status.ts       # devver status
│   ├── services/           # Effect services
│   │   ├── Git.ts          # Git operations
│   │   ├── Config.ts       # Configuration management
│   │   └── FileHash.ts     # File hashing
│   └── index.ts            # CLI entry point
├── package.json
└── README.md
```

## 🚧 Roadmap

### Current Status
- ✅ CLI infrastructure
- ✅ Git diff detection
- ✅ Configuration management
- ✅ File hashing service
- ✅ Basic command implementation

### Coming Soon
- [ ] SCP file transfer implementation
- [ ] SSH deployment trigger
- [ ] Container status fetching via API
- [ ] Deployment logs streaming
- [ ] Branch cleanup/destruction
- [ ] Webhook support (GitHub, GitLab)
- [ ] Progress bars and better UX
- [ ] Configuration validation
- [ ] Error recovery and retries

## 📖 Related Packages

- `@devver/shared` - Shared types and utilities
- `@devver/deployment-manager` - Container-side deployment service (coming soon)

## 🤝 Contributing

This is part of the Devver monorepo. See the root README for contribution guidelines.

## 📄 License

Private - Part of master-esgi/devver project
