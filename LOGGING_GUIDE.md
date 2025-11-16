# Devver Server Logging Guide

## ✅ Server Status

The server is running correctly and receiving requests! The 500 error you're seeing is from the deployment logic, not a connection issue.

## 📊 How to View Logs

### 1. View All Server Logs
```bash
docker logs devver-server
```

### 2. Follow Logs in Real-Time
```bash
docker logs -f devver-server
```

### 3. View Recent Logs (Last 5 Minutes)
```bash
docker logs devver-server --since 5m
```

### 4. View Last 100 Lines
```bash
docker logs devver-server --tail 100
```

## 🔍 What We Found

When I tested the deploy endpoint directly with curl, the server responded with:

```json
{
  "success": false,
  "message": "PM2Error: Failed to start process test-main"
}
```

This means:
- ✅ Server is receiving HTTP requests
- ✅ Deploy API endpoint is working
- ✅ File upload logic is working
- ❌ PM2 process start is failing

## 🐛 Common Issues

### Issue 1: Project Path Doesn't Exist

The deployment expects files at: `/tmp/devver-apps/[project-name]/branches/[branch-name]`

**Solution**: Make sure you run `dvr init` first to clone the repository.

### Issue 2: Missing `package.json`

If deploying a Node.js/NestJS app without dependencies installed, PM2 will fail to start.

**Solution**: The deployment flow should:
1. Clone repo (dvr init)
2. Upload files (dvr deploy)
3. Install dependencies
4. Build (if configured)
5. Start with PM2

### Issue 3: Start Command is Wrong

The start command in your config must be valid.

**Example for NestJS**:
```json
{
  "startCommand": "npm run start:prod"
}
```

## 🧪 Testing the Server

### Test Health Endpoint
```bash
curl http://localhost:3333/health
```

Should return: `{"status":"ok"}`

### Test Setup (First Time)
```bash
curl -X POST http://localhost:3333/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "project": "skeleton-nestjs",
    "repository": "https://github.com/youruser/skeleton_nestjs.git",
    "runtime": "node",
    "startCommand": "npm run start:prod",
    "buildCommand": "npm run build",
    "container": {"host": "localhost", "port": 3333, "user": "root"},
    "ignore": [],
    "env": {}
  }'
```

### Test Get Branches
```bash
curl http://localhost:3333/api/branches/skeleton-nestjs
```

## 📝 Next Steps

1. **Check if project was cloned**:
   ```bash
   docker exec devver-server ls -la /tmp/devver-apps
   ```

2. **Check if your project exists**:
   ```bash
   docker exec devver-server ls -la /tmp/devver-apps/skeleton-nestjs
   ```

3. **Check branch directories**:
   ```bash
   docker exec devver-server ls -la /tmp/devver-apps/skeleton-nestjs/branches
   ```

4. **Check PM2 status**:
   ```bash
   docker exec devver-server pm2 list
   ```

5. **Check PM2 logs**:
   ```bash
   docker exec devver-server pm2 logs
   ```

## 🔧 Full Deploy Flow

From your NestJS project directory:

```bash
# 1. Initialize (if not done)
cd /Users/user/Developer/skeleton_nestjs
bun run /Users/user/Developer/master-esgi/devver/rd-test/dvr init

# 2. Setup project on server (first time only)
bun run /Users/user/Developer/master-esgi/devver/rd-test/dvr setup

# 3. Deploy
bun run /Users/user/Developer/master-esgi/devver/rd-test/dvr deploy

# 4. Check status
bun run /Users/user/Developer/master-esgi/devver/rd-test/dvr status
```

## 🎯 Expected Server Logs

When deploy works correctly, you'll see:

```
═══════════════════════════════════════════════════════
🚀 POST /api/deploy - DEPLOYMENT REQUEST RECEIVED
═══════════════════════════════════════════════════════
📦 Project: skeleton-nestjs
🌿 Branch: main
📝 Commit: abc123def
📄 Files to deploy: 55
🗑️  Files to delete: 0
═══════════════════════════════════════════════════════

1️⃣ Creating branch directory...
   ✅ Directory created

2️⃣ Saving files to storage...
   Processing: src/main.ts (1234 bytes)
   ✅ Written to: /tmp/devver-apps/skeleton-nestjs/branches/main/src/main.ts
   ...
   ✅ Saved 55 files

5️⃣ Installing dependencies...
   Running: npm install
   ✅ Dependencies installed

6️⃣ Building application...
   Running: npm run build
   ✅ Build completed

7️⃣ Starting application with PM2...
   ✅ Process started on port 4123

8️⃣ Configuring nginx...
   ✅ Nginx configured

═══════════════════════════════════════════════════════
✅ DEPLOYMENT COMPLETE!
🌐 URL: http://main.skeleton-nestjs.dev
📊 Port: 4123
═══════════════════════════════════════════════════════
```
