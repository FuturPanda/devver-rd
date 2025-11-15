import { Effect, Console } from "effect"
import { Config, ConfigError } from "../services/Config"
import { Git, GitError } from "../services/Git"

export const initCommand = Effect.gen(function* () {
  const config = yield* Config
  const git = yield* Git

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

  // Get project name from git remote or current directory
  const projectName = yield* pipe(
    git.getRemoteUrl.pipe(
      Effect.map((url) => {
        // Extract repo name from git URL
        const match = url.match(/\/([^\/]+?)(\.git)?$/)
        return match ? match[1] : "my-app"
      }),
      Effect.catchAll(() =>
        Effect.sync(() => {
          const cwd = process.cwd()
          return cwd.split("/").pop() || "my-app"
        })
      )
    )
  )

  // Get current branch
  const branch = yield* git.getCurrentBranch.pipe(
    Effect.catchAll(() => Effect.succeed("main"))
  )

  yield* Console.log("🚀 Initializing Devver configuration...")
  yield* Console.log(`   Project: ${projectName}`)
  yield* Console.log(`   Branch: ${branch}`)
  yield* Console.log("")

  // Create config with detected project name
  const newConfig = yield* config.init

  yield* Console.log("✅ Created devver.config.json")
  yield* Console.log("")
  yield* Console.log("📝 Next steps:")
  yield* Console.log("   1. Edit devver.config.json with your container details")
  yield* Console.log("   2. Run 'devver deploy' to deploy your application")
})

import { pipe } from "effect"
