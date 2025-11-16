import { Effect, Console } from "effect"
import { Config } from "../services/Config"
import { Http } from "../services/Http"

export const statusCommand = Effect.gen(function* () {
  const config = yield* Config
  const http = yield* Http

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

  // Fetch actual deployment status from container
  const serverUrl = `http://${cfg.container.host}:${cfg.container.port}`
  
  const result = yield* http.getDeployments(cfg.project, serverUrl).pipe(
    Effect.catchAll((error) => {
      return Effect.gen(function* () {
        yield* Console.error(`❌ Failed to fetch deployments: ${error.message}`)
        yield* Console.error("   Make sure the Devver server is running")
        return yield* Effect.fail(error)
      })
    })
  )

  if (result.deployments.length === 0) {
    yield* Console.log("No active deployments found")
    yield* Console.log("Run 'devver deploy' to create your first deployment")
  } else {
    yield* Console.log("Active deployments:")
    yield* Console.log("")
    
    for (const deployment of result.deployments) {
      const statusEmoji = deployment.status === "online" ? "🟢" : deployment.status === "stopped" ? "🔴" : "⚠️"
      const pidInfo = deployment.pid ? ` (PID: ${deployment.pid})` : ""
      
      yield* Console.log(`  ${statusEmoji} ${deployment.branch} (${deployment.commitShort})`)
      yield* Console.log(`     URL: ${deployment.url}`)
      yield* Console.log(`     Port: ${deployment.port}`)
      yield* Console.log(`     Status: ${deployment.status}${pidInfo}`)
      yield* Console.log(`     Last deployed: ${deployment.lastDeployedAt}`)
      yield* Console.log("")
    }
  }
})
