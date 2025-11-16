import { Effect, Runtime, Layer } from "effect"
import { BunRuntime } from "@effect/platform-bun"
import { setupProject } from "./api/setup"
import { deployProject } from "./api/deploy"
import { getBranches } from "./api/branches"
import { getDeployments } from "./api/deployments"
import { DbLive } from "./services/Database"
import { PM2Live } from "./services/PM2"
import type { DeploymentConfig, DeployRequest } from "@devver/shared"

const runtime = Runtime.defaultRuntime

// Create main layer with all services
const MainLayer = Layer.mergeAll(DbLive, PM2Live)

const program = Effect.gen(function* () {
  yield* Effect.log("🚀 Devver Server starting...")
  yield* Effect.log("📡 Server running on http://localhost:3333")
  yield* Effect.log("")
  yield* Effect.log("📋 Available endpoints:")
  yield* Effect.log("   GET  /health                    - Health check")
  yield* Effect.log("   POST /api/setup                 - Setup project (clone repo)")
  yield* Effect.log("   POST /api/deploy                - Deploy branch")
  yield* Effect.log("   GET  /api/branches/:project     - List branches")
  yield* Effect.log("   GET  /api/deployments/:project  - List deployments")
  yield* Effect.log("")
  yield* Effect.log("✅ Server ready!")
  yield* Effect.log("")
})

// HTTP server
Bun.serve({
  hostname: "0.0.0.0",
  port: 3333,
  async fetch(req) {
    const url = new URL(req.url)
    const timestamp = new Date().toISOString()
    
    console.log(`\n[${timestamp}] ${req.method} ${url.pathname}`)
    
    // Health check
    if (url.pathname === "/health") {
      console.log("✅ Health check OK")
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      })
    }
    
    // Setup endpoint
    if (url.pathname === "/api/setup" && req.method === "POST") {
      try {
        console.log("📨 POST /api/setup - Parsing request body...")
        const config = await req.json() as DeploymentConfig
        console.log(`📦 Project: ${config.project}`)
        console.log(`🔗 Repository: ${config.repository || "none"}`)
        
        // Run setup in Effect runtime
        const result = await Runtime.runPromise(runtime)(setupProject(config))
        
        console.log(`✅ Setup ${result.success ? "succeeded" : "failed"}`)
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
          status: result.success ? 200 : 500
        })
      } catch (error) {
        console.error("❌ API error in /api/setup:", error)
        return new Response(JSON.stringify({
          success: false,
          message: String(error)
        }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        })
      }
    }

    // Deploy endpoint
    if (url.pathname === "/api/deploy" && req.method === "POST") {
      try {
        console.log("📨 POST /api/deploy - Parsing request body...")
        const rawBody = await req.text()
        console.log(`📊 Request body size: ${rawBody.length} bytes`)
        
        const body = JSON.parse(rawBody) as { request: DeployRequest; config: DeploymentConfig }
        console.log(`📦 Project: ${body.request.project}`)
        console.log(`🌿 Branch: ${body.request.branch}`)
        console.log(`📄 Files: ${body.request.files.length}`)
        
        // Run deploy in Effect runtime with services
        const program = deployProject(body.request, body.config).pipe(
          Effect.provide(MainLayer)
        )
        const result = await Runtime.runPromise(runtime)(program)
        
        console.log(`✅ Deploy ${result.success ? "succeeded" : "failed"}`)
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
          status: result.success ? 200 : 500
        })
      } catch (error) {
        console.error("❌ API error in /api/deploy:", error)
        console.error("Stack:", error instanceof Error ? error.stack : "no stack")
        return new Response(JSON.stringify({
          success: false,
          message: String(error)
        }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        })
      }
    }

    // List branches endpoint
    const branchesMatch = url.pathname.match(/^\/api\/branches\/(.+)$/)
    if (branchesMatch && branchesMatch[1] && req.method === "GET") {
      try {
        const project = branchesMatch[1]
        console.log(`📨 GET /api/branches/${project}`)
        
        // Run getBranches in Effect runtime with services
        const program = getBranches(project).pipe(
          Effect.provide(MainLayer)
        )
        const result = await Runtime.runPromise(runtime)(program)
        
        console.log(`✅ Returned ${result.branches.length} branches`)
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        })
      } catch (error) {
        console.error("❌ API error in /api/branches:", error)
        return new Response(JSON.stringify({
          branches: []
        }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        })
      }
    }

    // List deployments endpoint
    const deploymentsMatch = url.pathname.match(/^\/api\/deployments\/(.+)$/)
    if (deploymentsMatch && deploymentsMatch[1] && req.method === "GET") {
      try {
        const project = deploymentsMatch[1]
        console.log(`📨 GET /api/deployments/${project}`)
        
        // Run getDeployments in Effect runtime with services
        const program = getDeployments(project).pipe(
          Effect.provide(MainLayer)
        )
        const result = await Runtime.runPromise(runtime)(program)
        
        console.log(`✅ Returned ${result.deployments.length} deployments`)
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        })
      } catch (error) {
        console.error("❌ API error in /api/deployments:", error)
        return new Response(JSON.stringify({
          deployments: []
        }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        })
      }
    }
    
    console.log("❌ 404 Not Found")
    return new Response("Devver Server", { status: 404 })
  }
})

program.pipe(BunRuntime.runMain)
