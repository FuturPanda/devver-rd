#!/usr/bin/env bun

/**
 * Mock SSH Server for Testing
 * 
 * Simulates SSH commands for development/testing.
 * Run this to see what the CLI would send to a real server.
 */

import { spawn } from "bun"

const PORT = 2222
const HOST = "localhost"

console.log("🔧 Mock SSH Server")
console.log("==================")
console.log(`📡 Listening for SSH commands on ${HOST}:${PORT}`)
console.log("")
console.log("💡 To test, update devver.config.json:")
console.log('   "container": {')
console.log(`     "host": "${HOST}",`)
console.log(`     "port": ${PORT},`)
console.log('     "user": "deploy"')
console.log("   }")
console.log("")
console.log("📋 Waiting for commands...")
console.log("")

// Simple HTTP server that acts like SSH
Bun.serve({
  port: 3334,
  async fetch(req) {
    const url = new URL(req.url)
    
    if (url.pathname === "/ssh" && req.method === "POST") {
      const body = await req.json()
      const { commands } = body
      
      console.log("📨 Received SSH command:")
      console.log("─".repeat(60))
      console.log(commands)
      console.log("─".repeat(60))
      console.log("")
      
      // Simulate command execution
      if (commands.includes("git clone")) {
        console.log("✅ Simulating: git clone...")
        console.log("   Repository would be cloned to /app/project")
        console.log("")
      }
      
      if (commands.includes("bun install") || commands.includes("npm install")) {
        console.log("✅ Simulating: installing dependencies...")
        console.log("   Dependencies would be installed")
        console.log("")
      }
      
      return new Response(JSON.stringify({
        stdout: "Commands executed successfully (simulated)",
        stderr: "",
        exitCode: 0
      }), {
        headers: { "Content-Type": "application/json" }
      })
    }
    
    return new Response("Mock SSH Server - POST to /ssh", { status: 404 })
  }
})

console.log("🌐 HTTP endpoint for testing: http://localhost:3334/ssh")
console.log("")
console.log("Press Ctrl+C to stop")
