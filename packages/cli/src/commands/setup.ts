import { Effect, Console } from "effect"
import { Config } from "../services/Config"
import { Git } from "../services/Git"

export const setupCommand = Effect.gen(function* () {
  const config = yield* Config
  const git = yield* Git

  yield* Console.log("🔧 Setting up project on container...")
  yield* Console.log("")

  // Load configuration
  const cfg = yield* config.load.pipe(
    Effect.catchAll(() => {
      return Effect.gen(function* () {
        yield* Console.error(
          "❌ Failed to load devver.config.json. Run 'devver init' first."
        )
        return yield* Effect.fail(new Error("Config not found"))
      })
    })
  )

  // Get git remote URL from config or git
  const remoteUrl = cfg.repository || (yield* git.getRemoteUrl.pipe(
    Effect.catchAll(() => {
      return Effect.gen(function* () {
        yield* Console.error(
          "❌ No git remote found. Please add a remote first:"
        )
        yield* Console.error("   git remote add origin <url>")
        yield* Console.error("   Or set 'repository' in devver.config.json")
        return yield* Effect.fail(new Error("No git remote"))
      })
    })
  ))

  // Get current branch
  const branch = yield* git.getCurrentBranch

  yield* Console.log(`📦 Project: ${cfg.project}`)
  yield* Console.log(`🔗 Remote: ${remoteUrl}`)
  yield* Console.log(`🌿 Branch: ${branch}`)
  yield* Console.log(`🖥️  Container: ${cfg.container.user}@${cfg.container.host}:${cfg.container.port}`)
  yield* Console.log("")

  // TODO: SSH to container and run setup commands
  yield* Console.log("📋 Setup steps that will be executed:")
  yield* Console.log("")
  yield* Console.log("   1. Check SSH connection to container")
  yield* Console.log("   2. Create project directory on container")
  yield* Console.log(`   3. Clone repository: ${remoteUrl}`)
  yield* Console.log("   4. Configure git worktree structure")
  yield* Console.log("   5. Install base dependencies")
  yield* Console.log("")
  
  yield* Console.log("🚧 SSH/SCP not yet implemented")
  yield* Console.log("")
  yield* Console.log("Manual setup commands for now:")
  yield* Console.log("")
  yield* Console.log(`   ssh ${cfg.container.user}@${cfg.container.host} << 'EOF'`)
  yield* Console.log(`   mkdir -p /app/${cfg.project}`)
  yield* Console.log(`   cd /app/${cfg.project}`)
  yield* Console.log(`   git clone ${remoteUrl} .`)
  yield* Console.log(`   git config core.bare false`)
  yield* Console.log(`   mkdir -p worktrees`)
  yield* Console.log(`   ${cfg.runtime === "bun" ? "bun install" : "npm install"}`)
  yield* Console.log(`   EOF`)
  yield* Console.log("")

  yield* Console.log("✅ Setup plan ready!")
  yield* Console.log("")
  yield* Console.log("📝 Next steps:")
  yield* Console.log("   1. Run the manual setup commands above (SSH not implemented yet)")
  yield* Console.log("   2. Or wait for Phase 2 (SSH service) to automate this")
  yield* Console.log("   3. Then run 'devver deploy' to deploy your first branch")
})
