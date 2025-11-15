import { Effect, Console } from "effect"
import { Command } from "@effect/platform"
import type { DeploymentConfig } from "@devver/shared"

export const setupProject = (config: DeploymentConfig) =>
  Effect.gen(function* () {
    yield* Console.log("🔧 Setup request received!")
    yield* Console.log("─".repeat(60))
    yield* Console.log(`📦 Project: ${config.project}`)
    yield* Console.log(`🔗 Repository: ${config.repository || "No repository"}`)
    yield* Console.log(`⚡ Runtime: ${config.runtime}`)
    yield* Console.log("─".repeat(60))
    yield* Console.log("")

    if (!config.repository) {
      yield* Console.error("❌ No repository URL provided")
      return { success: false, message: "No repository URL" }
    }

    const projectPath = `/tmp/devver-apps/${config.project}`

    yield* Console.log("📋 Cloning repository...")
    yield* Console.log(`   Source: ${config.repository}`)
    yield* Console.log(`   Target: ${projectPath}`)
    yield* Console.log("")

    // Create project directory
    yield* Console.log("1️⃣ Creating project directory...")
    const mkdirProc = Bun.spawn(["mkdir", "-p", projectPath], { 
      stdout: "inherit",
      stderr: "inherit" 
    })
    yield* Effect.promise(() => mkdirProc.exited)
    yield* Console.log("   ✅ Directory created")
    yield* Console.log("")

    // Clone repository
    yield* Console.log("2️⃣ Cloning repository...")
    const cloneProc = Bun.spawn(["git", "clone", config.repository!, projectPath], {
      stdout: "inherit",
      stderr: "inherit"
    })
    const cloneResult = yield* Effect.promise(() => cloneProc.exited).pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function* () {
          yield* Console.error(`   ❌ Clone failed: ${error}`)
          // Check if already exists
          const exists = yield* Effect.promise(() => 
            Bun.file(`${projectPath}/.git/config`).exists()
          )
          if (exists) {
            yield* Console.log("   📁 Repository already exists, skipping clone")
            return 0
          }
          return 1
        })
      })
    )

    if (cloneResult === 0) {
      yield* Console.log("   ✅ Repository cloned successfully")
    }
    yield* Console.log("")

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
    const installProc = Bun.spawn([installCmd, "install"], {
      cwd: projectPath,
      stdout: "inherit",
      stderr: "inherit"
    })
    yield* Effect.promise(() => installProc.exited)
    yield* Console.log("   ✅ Dependencies installed")
    yield* Console.log("")

    yield* Console.log("─".repeat(60))
    yield* Console.log("✅ Setup complete!")
    yield* Console.log(`📁 Project location: ${projectPath}`)
    yield* Console.log("─".repeat(60))
    yield* Console.log("")

    return {
      success: true,
      message: "Project setup successful",
      path: projectPath
    }
  })
