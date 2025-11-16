import { Effect, Console } from "effect"
import { Command } from "@effect/platform"
import type { DeploymentConfig } from "@devver/shared"

export const setupProject = (config: DeploymentConfig) =>
  Effect.gen(function* () {
    yield* Console.log("")
    yield* Console.log("═".repeat(60))
    yield* Console.log("🔧 POST /api/setup - SETUP PROJECT REQUEST")
    yield* Console.log("═".repeat(60))
    yield* Console.log(`📦 Project: ${config.project}`)
    yield* Console.log(`🔗 Repository: ${config.repository || "No repository"}`)
    yield* Console.log(`⚡ Runtime: ${config.runtime}`)
    yield* Console.log(`🚀 Start Command: ${config.startCommand}`)
    if (config.buildCommand) {
      yield* Console.log(`🔨 Build Command: ${config.buildCommand}`)
    }
    yield* Console.log("═".repeat(60))
    yield* Console.log("")

    if (!config.repository) {
      yield* Console.error("❌ ERROR: No repository URL provided in config")
      yield* Console.log("")
      return { success: false, message: "No repository URL" }
    }

    const projectPath = `/tmp/devver-apps/${config.project}`

    yield* Console.log("📋 Starting repository clone process...")
    yield* Console.log(`   Source: ${config.repository}`)
    yield* Console.log(`   Target: ${projectPath}`)
    yield* Console.log("")

    // Check if repository already exists
    yield* Console.log("1️⃣ Checking if repository exists...")
    const alreadyExists = yield* Effect.promise(() => 
      Bun.file(`${projectPath}/.git/config`).exists()
    )
    
    if (alreadyExists) {
      yield* Console.log("   📁 Repository already exists, pulling latest changes...")
      const pullProc = Bun.spawn(["git", "pull"], {
        cwd: projectPath,
        stdout: "pipe",
        stderr: "pipe"
      })
      const pullExit = yield* Effect.promise(() => pullProc.exited)
      if (pullExit === 0) {
        yield* Console.log("   ✅ Repository updated")
      } else {
        const stderr = yield* Effect.promise(async () => 
          await new Response(pullProc.stderr).text()
        )
        yield* Console.error(`   ⚠️  Pull failed: ${stderr}`)
        yield* Console.log("   Continuing with existing repository...")
      }
    } else {
      // Check if directory exists and is not empty
      const dirExists = yield* Effect.promise(async () => {
        try {
          const stat = await Bun.file(projectPath).stat()
          return stat.isDirectory()
        } catch {
          return false
        }
      })

      if (dirExists) {
        yield* Console.log("   📁 Directory exists but is not a git repository, removing...")
        const rmProc = Bun.spawn(["rm", "-rf", projectPath], {
          stdout: "inherit",
          stderr: "inherit"
        })
        yield* Effect.promise(() => rmProc.exited)
        yield* Console.log("   ✅ Directory removed")
      }

      yield* Console.log("2️⃣ Cloning repository...")
      yield* Console.log(`   Running: git clone ${config.repository} ${projectPath}`)
      
      const cloneProc = Bun.spawn(["git", "clone", config.repository!, projectPath], {
        stdout: "pipe",
        stderr: "pipe"
      })
      const cloneResult = yield* Effect.promise(() => cloneProc.exited)
      
      if (cloneResult === 0) {
        yield* Console.log("   ✅ Repository cloned successfully")
      } else {
        const stderr = yield* Effect.promise(async () => 
          await new Response(cloneProc.stderr).text()
        )
        yield* Console.error(`   ❌ Clone failed with exit code ${cloneResult}`)
        yield* Console.error(`   Git error: ${stderr}`)
        yield* Console.log("")
        return { success: false, message: `Clone failed: ${stderr}` }
      }
    }
    yield* Console.log("")

    // List cloned files
    yield* Console.log("   📂 Listing cloned files...")
    const lsProc = Bun.spawn(["ls", "-la", projectPath], {
      stdout: "pipe",
      stderr: "inherit"
    })
    const lsOutput = yield* Effect.promise(async () => {
      const text = await new Response(lsProc.stdout).text()
      return text
    })
    yield* Console.log(lsOutput)

    // Configure git
    yield* Console.log("3️⃣ Configuring git...")
    const gitConfigProc = Bun.spawn(["git", "config", "core.bare", "false"], {
      cwd: projectPath,
      stdout: "inherit",
      stderr: "inherit"
    })
    yield* Effect.promise(() => gitConfigProc.exited)
    yield* Console.log("   ✅ Git configured")
    yield* Console.log("")

    // Create worktrees directory
    yield* Console.log("4️⃣ Creating worktrees directory...")
    const mkdirWorktreesProc = Bun.spawn(["mkdir", "-p", `${projectPath}/worktrees`], {
      stdout: "inherit",
      stderr: "inherit"
    })
    yield* Effect.promise(() => mkdirWorktreesProc.exited)
    yield* Console.log("   ✅ Worktrees directory created")
    yield* Console.log("")

    // Install dependencies
    yield* Console.log("5️⃣ Installing dependencies...")
    const installCmd = config.runtime === "bun" ? "bun" : "npm"
    yield* Console.log(`   Running: ${installCmd} install`)
    const installProc = Bun.spawn([installCmd, "install"], {
      cwd: projectPath,
      stdout: "inherit",
      stderr: "inherit"
    })
    const installExit = yield* Effect.promise(() => installProc.exited)
    if (installExit === 0) {
      yield* Console.log("   ✅ Dependencies installed")
    } else {
      yield* Console.error(`   ⚠️  Install exited with code ${installExit}`)
    }
    yield* Console.log("")

    yield* Console.log("═".repeat(60))
    yield* Console.log("✅ SETUP COMPLETE!")
    yield* Console.log(`📁 Project location: ${projectPath}`)
    yield* Console.log("═".repeat(60))
    yield* Console.log("")

    return {
      success: true,
      message: "Project setup successful",
      path: projectPath
    }
  })
