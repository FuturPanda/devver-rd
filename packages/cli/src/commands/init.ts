import { Effect, Console, pipe } from "effect"
import { Config, ConfigError } from "../services/Config"
import { Git } from "../services/Git"
import { Http } from "../services/Http"
import type { DeploymentConfig } from "@devver/shared"

export const initCommand = Effect.gen(function* () {
  const config = yield* Config
  const git = yield* Git
  const http = yield* Http

  // Check if we're in a git repository
  const isGitRepo = yield* git.isGitRepository

  if (!isGitRepo) {
    yield* Console.error("❌ Not a git repository. Please run 'git init' first.")
    return yield* Effect.fail(new Error("Not a git repository"))
  }

  // Check if config already exists
  const configExists = yield* config.exists

  if (configExists) {
    yield* Console.error("❌ devver.config.json already exists")
    return yield* Effect.fail(new ConfigError("Config already exists", undefined))
  }

  // Get git remote URL
  const remoteUrl = yield* git.getRemoteUrl.pipe(
    Effect.catchAll(() => {
      return Effect.gen(function* () {
        yield* Console.error("❌ No git remote found. Please add a remote first:")
        yield* Console.error("   git remote add origin <url>")
        return yield* Effect.fail(new Error("No git remote"))
      })
    })
  )

  // Get project name from git remote or current directory
  const projectName = yield* pipe(
    Effect.sync(() => {
      if (remoteUrl) {
        // Extract repo name from git URL
        const match = remoteUrl.match(/\/([^\/]+?)(\.git)?$/)
        if (match) return match[1]
      }
      const cwd = process.cwd()
      return cwd.split("/").pop() || "my-app"
    })
  )

  // Get current branch
  const branch = yield* git.getCurrentBranch.pipe(
    Effect.catchAll(() => Effect.succeed("main"))
  )

  yield* Console.log("🚀 Initializing Devver configuration...")
  yield* Console.log(`   Project: ${projectName}`)
  yield* Console.log(`   Repository: ${remoteUrl}`)
  yield* Console.log(`   Branch: ${branch}`)
  yield* Console.log("")

  // Create base config
  yield* config.init
  
  // Update config with project name and repository URL
  const cfg = yield* config.load
  yield* config.save({ 
    ...cfg, 
    project: projectName as string,
    repository: remoteUrl as string
  } as DeploymentConfig)

  yield* Console.log("✅ Created devver.config.json")
  yield* Console.log("")

  // Reload config with repository and project name
  const finalConfig = yield* config.load

  // Now setup the project on the server via HTTP
  yield* Console.log("🔧 Setting up project on server...")
  yield* Console.log("")

  // Assume server is on localhost:3333 for now
  const serverUrl = "http://localhost:3333"
  
  const result = yield* http.setupProject(finalConfig, serverUrl).pipe(
    Effect.catchAll((error) => {
      return Effect.gen(function* () {
        yield* Console.error("❌ Failed to setup project on server")
        yield* Console.error(`   Error: ${error.message}`)
        yield* Console.log("")
        yield* Console.log("💡 Make sure the server is running:")
        yield* Console.log("   bun run server")
        return yield* Effect.fail(error)
      })
    })
  )

  if (result.success) {
    yield* Console.log("✅ Project setup complete!")
    yield* Console.log("")
    yield* Console.log(`📁 Project cloned to: ${result.path}`)
    yield* Console.log("")
    yield* Console.log("📝 Next steps:")
    yield* Console.log("   1. Run 'devver deploy' to deploy your first branch")
    yield* Console.log(`   2. Your app will be available at: https://${branch}.${finalConfig.project}.dev`)
  } else {
    yield* Console.error(`❌ Setup failed: ${result.message}`)
  }
})
