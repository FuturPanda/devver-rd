#!/usr/bin/env bun

/**
 * SSH Command Logger
 * 
 * Run a simple server that captures and logs SSH commands
 * sent by the CLI during init.
 */

console.log("🔍 SSH Command Logger")
console.log("=".repeat(60))
console.log("")
console.log("This will show you exactly what commands the CLI")
console.log("sends to the server during 'init'")
console.log("")
console.log("📝 Instructions:")
console.log("1. Run this script: bun run packages/server/src/ssh-logger.ts")
console.log("2. In another terminal, run: rm devver.config.json && bun run dvr init")
console.log("3. Watch the commands appear here!")
console.log("")
console.log("─".repeat(60))
console.log("")

// Monitor SSH commands by hooking into process spawn
const originalSpawn = Bun.spawn

// Override to log SSH commands
globalThis.Bun.spawn = function(cmd, options) {
  if (Array.isArray(cmd) && cmd[0] === 'ssh') {
    console.log("📡 SSH Command Detected!")
    console.log("─".repeat(60))
    console.log("Command:", cmd.join(" "))
    console.log("─".repeat(60))
    console.log("")
  }
  return originalSpawn.call(this, cmd, options)
}

console.log("✅ Logger active - run 'bun run dvr init' in another terminal")
console.log("")

// Keep the process alive
setInterval(() => {}, 1000)
