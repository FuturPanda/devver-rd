#!/usr/bin/env bun

import { BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { deployCommand } from "./commands/deploy"
import { initCommand } from "./commands/init"
import { setupCommand } from "./commands/setup"
import { statusCommand } from "./commands/status"
import { ConfigLive } from "./services/Config"
import { FileHashLive } from "./services/FileHash"
import { GitLive } from "./services/Git"
import { HttpLive } from "./services/Http"

const ServicesLayer = Layer.mergeAll(
  GitLive,
  ConfigLive,
  FileHashLive,
  HttpLive
)

const program = Effect.gen(function* () {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case "init":
      yield* initCommand
      break

    case "setup":
      yield* setupCommand
      break

    case "deploy": {
      const branchFlag = args.find((arg) => arg.startsWith("--branch="))
      const branch = branchFlag ? branchFlag.split("=")[1] : undefined
      yield* deployCommand(branch)
      break
    }

    case "status":
      yield* statusCommand
      break

    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log("Devver - Ultra-fast deployment tool v0.1.0")
      console.log("")
      console.log("Usage: devver <command> [options]")
      console.log("")
      console.log("Commands:")
      console.log("  init           Initialize Devver configuration")
      console.log("  setup          Setup project on container (clone repo)")
      console.log("  deploy         Deploy the current branch")
      console.log("  deploy --branch=<name>  Deploy a specific branch")
      console.log("  status         Show deployment status")
      console.log("")
      console.log("Examples:")
      console.log("  devver init")
      console.log("  devver setup")
      console.log("  devver deploy")
      console.log("  devver deploy --branch=feature-x")
      console.log("  devver status")
      break

    default:
      console.error(`Unknown command: ${command}`)
      console.error("Run 'devver help' for usage information")
      yield* Effect.fail(new Error(`Unknown command: ${command}`))
  }
})

program.pipe(
  Effect.catchAll(() => Effect.void),
  Effect.provide(ServicesLayer),
  BunRuntime.runMain
)
// Test change
