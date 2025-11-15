import { Effect, Runtime } from "effect"
import { BunRuntime } from "@effect/platform-bun"
import { setupProject } from "./api/setup"

const runtime = Runtime.defaultRuntime

const program = Effect.gen(function* () {
  yield* Effect.log("🚀 Devver Server starting...")
  yield* Effect.log("📡 Server running on http://localhost:3333")
  yield* Effect.log("")
  yield* Effect.log("📋 Available endpoints:")
  yield* Effect.log("   GET  /health       - Health check")
  yield* Effect.log("   POST /api/setup    - Setup project (clone repo)")
  yield* Effect.log("")
  yield* Effect.log("✅ Server ready!")
  yield* Effect.log("")
})

// HTTP server
Bun.serve({
  port: 3333,
  async fetch(req) {
    const url = new URL(req.url)
    
    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      })
    }
    
    // Setup endpoint
    if (url.pathname === "/api/setup" && req.method === "POST") {
      try {
        console.log("📨 Received setup request")
        const config = await req.json()
        console.log("Config:", JSON.stringify(config, null, 2))
        
        // Run setup in Effect runtime
        const result = await Runtime.runPromise(runtime)(setupProject(config))
        
        console.log("Setup result:", result)
        
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
          status: result.success ? 200 : 500
        })
      } catch (error) {
        console.error("API error:", error)
        return new Response(JSON.stringify({
          success: false,
          message: String(error)
        }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        })
      }
    }
    
    return new Response("Devver Server - POST to /api/setup", { status: 404 })
  }
})

program.pipe(BunRuntime.runMain)
