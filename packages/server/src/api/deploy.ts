import { Effect, Console } from "effect"
import type { DeployRequest, DeploymentConfig } from "@devver/shared"
import { Db } from "../services/Database"
import { PM2 } from "../services/PM2"
import * as crypto from "crypto"
import * as path from "path"

const generateNginxConfig = (
  project: string,
  commitShort: string,
  port: number
) => {
  const subdomain = `${project}-${commitShort}`
  return `
server {
  listen 80;
  server_name ${subdomain}.localhost;

  location / {
    proxy_pass http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
`
}

const writeNginxConfig = (project: string, commitShort: string, port: number) =>
  Effect.gen(function* () {
    const config = generateNginxConfig(project, commitShort, port)
    const configPath = `/etc/nginx/sites-enabled/${project}-${commitShort}.conf`
    
    // Check if nginx sites-enabled directory exists (Linux only)
    const sitesEnabledExists = yield* Effect.tryPromise({
      try: async () => {
        const stat = await Bun.file("/etc/nginx/sites-enabled").stat()
        return stat.isDirectory()
      },
      catch: (error) => new Error(`Cannot access nginx directory: ${error}`)
    }).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (!sitesEnabledExists) {
      yield* Console.log("⚠️  Nginx sites-enabled directory not found, skipping nginx config")
      yield* Console.log("   (This is normal on macOS - access the app directly via port)")
      return false
    }
    
    yield* Console.log(`Writing nginx config to ${configPath}`)
    
    yield* Effect.promise(() =>
      Bun.write(configPath, config)
    )

    // Reload nginx
    yield* Console.log("Reloading nginx...")
    const proc = Bun.spawn(["nginx", "-s", "reload"], {
      stdout: "inherit",
      stderr: "inherit",
    })
    yield* Effect.promise(() => proc.exited)
    
    return true
  })

export const deployProject = (request: DeployRequest, config: DeploymentConfig) =>
  Effect.gen(function* () {
    const db = yield* Db
    const pm2 = yield* PM2

    yield* Console.log("")
    yield* Console.log("═".repeat(60))
    yield* Console.log("🚀 POST /api/deploy - DEPLOYMENT REQUEST RECEIVED")
    yield* Console.log("═".repeat(60))
    yield* Console.log(`📦 Project: ${request.project}`)
    yield* Console.log(`🌿 Branch: ${request.branch}`)
    yield* Console.log(`📝 Commit: ${request.commitHash}`)
    yield* Console.log(`📄 Files to deploy: ${request.files.length}`)
    yield* Console.log(`🗑️  Files to delete: ${request.deletedFiles.length}`)
    if (request.baseCommitHash) {
      yield* Console.log(`🔗 Base commit: ${request.baseCommitHash}`)
    }
    yield* Console.log("═".repeat(60))
    yield* Console.log("")

    // Log file list
    if (request.files.length > 0) {
      yield* Console.log("📋 Files to upload:")
      for (const file of request.files.slice(0, 10)) {
        yield* Console.log(`   - ${file.path} (${file.hash.substring(0, 8)})`)
      }
      if (request.files.length > 10) {
        yield* Console.log(`   ... and ${request.files.length - 10} more files`)
      }
      yield* Console.log("")
    }

    const projectPath = `/tmp/devver-apps/${request.project}`
    const commitShort = request.commitHash.substring(0, 8)
    const deploymentPath = `${projectPath}/deployments/${commitShort}`

    yield* Console.log(`📁 Project path: ${projectPath}`)
    yield* Console.log(`📁 Deployment path: ${deploymentPath}`)
    yield* Console.log(`📝 Commit: ${commitShort}`)
    yield* Console.log("")

    // Create deployment directory if it doesn't exist
    yield* Console.log("1️⃣ Creating deployment directory...")
    
    // Check if this is the first deployment or if we can reuse an existing one
    const existingDeployments = yield* Effect.gen(function* () {
      const deploymentsDir = `${projectPath}/deployments`
      
      // Check if deployments directory exists
      const dirExists = yield* Effect.tryPromise({
        try: async () => {
          const stat = await Bun.file(deploymentsDir).stat()
          return stat.isDirectory()
        },
        catch: () => false
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
      
      if (!dirExists) {
        return []
      }
      
      // List existing deployments
      return yield* Effect.tryPromise({
        try: async () => {
          const entries = await Array.fromAsync(
            new Bun.Glob("*").scan({ cwd: deploymentsDir, onlyFiles: false })
          )
          return entries.filter(e => e !== commitShort)
        },
        catch: () => [] as string[]
      }).pipe(Effect.catchAll(() => Effect.succeed([] as string[])))
    })
    
    if (existingDeployments.length > 0) {
      // Copy from most recent deployment to reuse unchanged files
      const sourceDeployment = existingDeployments[0]
      const sourcePath = `${projectPath}/deployments/${sourceDeployment}`
      
      yield* Console.log(`   📋 Found existing deployment: ${sourceDeployment}`)
      yield* Console.log(`   🔄 Copying from ${sourcePath} to speed up deployment...`)
      
      const cpProc = Bun.spawn(["cp", "-r", sourcePath, deploymentPath], {
        stdout: "pipe",
        stderr: "pipe",
      })
      yield* Effect.promise(() => cpProc.exited)
      yield* Console.log("   ✅ Base files copied from previous deployment")
    } else {
      // First deployment - copy everything from the main repo checkout
      yield* Console.log("   🆕 First deployment detected")
      yield* Console.log(`   🔄 Copying all files from ${projectPath}...`)
      
      // Create deployment directory
      const mkdirProc = Bun.spawn(["mkdir", "-p", deploymentPath], {
        stdout: "pipe",
        stderr: "pipe",
      })
      yield* Effect.promise(() => mkdirProc.exited)
      
      // Copy all files from project root, then clean up unwanted directories
      const cpProc = Bun.spawn(["cp", "-r", `${projectPath}/.`, deploymentPath], {
        stdout: "pipe",
        stderr: "pipe",
      })
      yield* Effect.promise(() => cpProc.exited)
      
      // Remove unwanted directories from the copy
      const rmDirsProc = Bun.spawn([
        "sh", "-c",
        `cd ${deploymentPath} && rm -rf .git node_modules deployments branches worktrees`
      ], {
        stdout: "pipe",
        stderr: "pipe",
      })
      yield* Effect.promise(() => rmDirsProc.exited)
      yield* Console.log("   ✅ All source files copied from repository")
    }
    
    yield* Console.log("")

    // Save files to content-addressable storage and deployment
    yield* Console.log("2️⃣ Saving files to storage...")
    const deploymentFiles: Array<{ path: string; hash: string }> = []
    
    let savedCount = 0
    let skippedCount = 0
    
    for (const file of request.files) {
      // Save to content-addressable storage
      const content = Buffer.from(file.content, "base64")
      const fileSize = content.length
      
      yield* Console.log(`   Processing: ${file.path} (${fileSize} bytes, hash: ${file.hash.substring(0, 8)})`)
      
      yield* db.saveFile(file.hash, content)
      savedCount++

      // Write file to branch directory
      const filePath = path.join(deploymentPath, file.path)
      const fileDir = path.dirname(filePath)
      
      // Create directory if needed
      const mkdirFileProc = Bun.spawn(["mkdir", "-p", fileDir], {
        stdout: "pipe",
        stderr: "pipe",
      })
      yield* Effect.promise(() => mkdirFileProc.exited)

      // Write file
      yield* Effect.promise(() => Bun.write(filePath, content))
      yield* Console.log(`   ✅ Written to: ${filePath}`)

      deploymentFiles.push({ path: file.path, hash: file.hash })
    }

    yield* Console.log(`   ✅ Saved ${savedCount} files to storage`)
    yield* Console.log("")

    // List files in branch directory
    yield* Console.log("   📂 Listing branch directory contents...")
    const lsBranchProc = Bun.spawn(["ls", "-lah", deploymentPath], {
      stdout: "pipe",
      stderr: "inherit"
    })
    const lsBranchOutput = yield* Effect.promise(async () => {
      const text = await new Response(lsBranchProc.stdout).text()
      return text
    })
    yield* Console.log(lsBranchOutput)
    yield* Console.log("")

    // Delete removed files
    if (request.deletedFiles.length > 0) {
      yield* Console.log("3️⃣ Deleting removed files...")
      for (const file of request.deletedFiles) {
        const filePath = path.join(deploymentPath, file)
        const rmProc = Bun.spawn(["rm", "-f", filePath], {
          stdout: "pipe",
          stderr: "pipe",
        })
        yield* Effect.promise(() => rmProc.exited)
      }
      yield* Console.log(`   ✅ Deleted ${request.deletedFiles.length} files`)
      yield* Console.log("")
    }

    // Save branch and deployment info to database
    yield* Console.log("4️⃣ Updating database...")
    yield* db.saveBranch(request.project, request.branch, request.commitHash)
    yield* db.saveDeploymentFiles(
      request.project,
      request.branch,
      request.commitHash,
      deploymentFiles
    )
    yield* Console.log("   ✅ Database updated")
    yield* Console.log("")

    // Install dependencies if package.json exists
    const hasPackageJson = request.files.some(f => f.path === "package.json")
    if (hasPackageJson) {
      yield* Console.log("5️⃣ Installing dependencies...")
      const installCmd = config.runtime === "bun" ? "bun" : "npm"
      const installProc = Bun.spawn([installCmd, "install"], {
        cwd: deploymentPath,
        stdout: "inherit",
        stderr: "inherit",
      })
      yield* Effect.promise(() => installProc.exited)
      yield* Console.log("   ✅ Dependencies installed")
      yield* Console.log("")
    }

    // Run build command if configured (for TypeScript/NestJS apps)
    if (config.buildCommand) {
      yield* Console.log("6️⃣ Building application...")
      const buildParts = config.buildCommand.trim().split(/\s+/)
      const buildProc = Bun.spawn(buildParts, {
        cwd: deploymentPath,
        stdout: "inherit",
        stderr: "inherit",
      })
      const buildResult = yield* Effect.promise(() => buildProc.exited)
      if (buildResult !== 0) {
        yield* Console.log("   ❌ Build failed!")
        return {
          success: false,
          url: "",
          duration: 0,
          filesChanged: request.files.length,
          dependenciesReinstalled: hasPackageJson,
          message: "Build failed",
        }
      }
      yield* Console.log("   ✅ Build completed")
      yield* Console.log("")
    }

    // Allocate port for this deployment (based on commit hash)
    const portHash = crypto.createHash("md5")
      .update(`${request.project}-${request.commitHash}`)
      .digest("hex")
    const port = 4000 + (parseInt(portHash.substring(0, 4), 16) % 10000)

    // Start process with PM2
    const stepNum = config.buildCommand ? "7️⃣" : "6️⃣"
    yield* Console.log(`${stepNum} Starting application with PM2...`)
    const processName = `${request.project}-${commitShort}`
    yield* Console.log(`   Process name: ${processName}`)
    yield* Console.log(`   Command: ${config.startCommand}`)
    yield* Console.log(`   Working directory: ${deploymentPath}`)
    yield* Console.log(`   Port: ${port}`)
    if (Object.keys(config.env).length > 0) {
      yield* Console.log(`   Environment variables: ${Object.keys(config.env).join(', ')}`)
    }
    
    yield* pm2.startProcess(processName, deploymentPath, config.startCommand, port, config.env).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.log(`   ❌ Failed to start process with PM2!`)
          yield* Console.log(`   Error: ${error.message}`)
          return yield* Effect.fail(error)
        })
      )
    )
    
    yield* Console.log(`   ✅ Process started on port ${port}`)
    
    // Wait a moment and check if process is still running
    yield* Effect.sleep("2 seconds")
    const processInfo = yield* pm2.getProcessInfo(processName)
    
    if (processInfo && processInfo.status !== "online") {
      yield* Console.log(`   ⚠️  Warning: Process status is ${processInfo.status}`)
      yield* Console.log(`   The application may have crashed. Check logs with: pm2 logs ${processName}`)
    } else if (!processInfo) {
      yield* Console.log(`   ⚠️  Warning: Could not verify process status`)
    } else {
      yield* Console.log(`   ✅ Process verified running (PID: ${processInfo.pid})`)
    }
    
    yield* Console.log("")

    // Configure nginx
    const nginxStepNum = config.buildCommand ? "8️⃣" : "7️⃣"
    yield* Console.log(`${nginxStepNum} Configuring nginx...`)
    const nginxConfigured = yield* writeNginxConfig(request.project, commitShort, port)
    yield* Console.log("   ✅ Nginx step completed")
    yield* Console.log("")

    // Use subdomain URL if nginx was configured, otherwise direct port
    const url = nginxConfigured
      ? `http://${request.project}-${commitShort}.localhost`
      : `http://localhost:${port}`

    yield* Console.log("═".repeat(60))
    yield* Console.log("✅ DEPLOYMENT COMPLETE!")
    yield* Console.log(`🌐 URL: ${url}`)
    yield* Console.log(`📝 Commit: ${request.commitHash}`)
    yield* Console.log(`📊 Port: ${port}`)
    yield* Console.log(`📁 Path: ${deploymentPath}`)
    yield* Console.log(`📦 Files deployed: ${request.files.length}`)
    yield* Console.log(`🔨 Dependencies reinstalled: ${hasPackageJson ? "Yes" : "No"}`)
    if (config.buildCommand) {
      yield* Console.log(`🏗️  Build ran: Yes`)
    }
    if (!nginxConfigured) {
      yield* Console.log(`⚠️  Running outside Docker - access app directly on port ${port}`)
    }
    yield* Console.log("═".repeat(60))
    yield* Console.log("")

    return {
      success: true,
      url,
      duration: 0,
      filesChanged: request.files.length,
      dependenciesReinstalled: hasPackageJson,
    }
  })
