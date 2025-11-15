import { Effect, Console, pipe } from "effect"
import { Config } from "../services/Config"
import { Git } from "../services/Git"
import { FileHash } from "../services/FileHash"

export const deployCommand = (branch?: string) =>
  Effect.gen(function* () {
    const config = yield* Config
    const git = yield* Git
    const fileHash = yield* FileHash

    yield* Console.log("🚀 Starting deployment...")
    yield* Console.log("")

    // Load configuration
    const cfg = yield* config.load.pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function* () {
          yield* Console.error(
            "❌ Failed to load devver.config.json. Run 'devver init' first."
          )
          return yield* Effect.fail(error)
        })
      })
    )

    yield* Console.log(`📦 Project: ${cfg.project}`)

    // Get current branch if not specified
    const targetBranch = branch || (yield* git.getCurrentBranch)
    yield* Console.log(`🌿 Branch: ${targetBranch}`)
    yield* Console.log("")

    // Detect changed files
    yield* Console.log("🔍 Detecting changes...")
    const changes = yield* git.getChangedFiles("origin/main").pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function* () {
          yield* Console.warn(
            "⚠️  Failed to detect changes from origin/main, deploying all files"
          )
          yield* Console.log("")
          return {
            branch: targetBranch,
            changedFiles: [],
            deletedFiles: [],
            addedFiles: [],
            hasPackageJsonChanges: true,
            hasLockFileChanges: true,
          }
        })
      })
    )

    yield* Console.log(
      `   Changed files: ${changes.changedFiles.length}`
    )
    yield* Console.log(
      `   Added files: ${changes.addedFiles.length}`
    )
    yield* Console.log(
      `   Deleted files: ${changes.deletedFiles.length}`
    )

    if (changes.hasPackageJsonChanges || changes.hasLockFileChanges) {
      yield* Console.log(
        "   📦 Dependency changes detected - will reinstall"
      )
    }

    yield* Console.log("")

    // Show changed files
    if (changes.changedFiles.length > 0) {
      yield* Console.log("📄 Files to deploy:")
      for (const file of changes.changedFiles.slice(0, 10)) {
        yield* Console.log(`   • ${file}`)
      }
      if (changes.changedFiles.length > 10) {
        yield* Console.log(
          `   ... and ${changes.changedFiles.length - 10} more`
        )
      }
      yield* Console.log("")
    }

    // TODO: Implement SCP file transfer
    yield* Console.log("🚧 SCP transfer not yet implemented")
    yield* Console.log("")

    // TODO: Implement SSH deployment trigger
    yield* Console.log("🚧 SSH deployment trigger not yet implemented")
    yield* Console.log("")

    yield* Console.log("✅ Deployment initiated!")
    yield* Console.log("")
    yield* Console.log(
      `🌐 URL: https://${targetBranch}.${cfg.project}.dev (will be available)`
    )
    yield* Console.log(`📊 Container: ${cfg.container.host}:${cfg.container.port}`)
  })
