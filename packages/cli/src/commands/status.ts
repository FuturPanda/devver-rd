import { Effect, Console } from "effect"
import { Config } from "../services/Config"

export const statusCommand = Effect.gen(function* () {
  const config = yield* Config

  yield* Console.log("📊 Deployment Status")
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

  yield* Console.log(`Project: ${cfg.project}`)
  yield* Console.log(`Container: ${cfg.container.host}:${cfg.container.port}`)
  yield* Console.log(`Runtime: ${cfg.runtime}`)
  yield* Console.log("")

  // TODO: Fetch actual deployment status from container
  yield* Console.log("🚧 Status fetching not yet implemented")
  yield* Console.log("")
  yield* Console.log("Active deployments will be shown here:")
  yield* Console.log("  • main → https://main.my-app.dev (running)")
  yield* Console.log("  • feature-x → https://feature-x.my-app.dev (running)")
})
