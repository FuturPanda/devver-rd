import { Context, Effect, pipe, Data, Layer } from "effect"
import { BunCommandExecutor } from "@effect/platform-bun"
import { Command } from "@effect/platform"
import type { DeploymentConfig } from "@devver/shared"

export class SshError extends Data.TaggedError("SshError")<{
  message: string
  cause?: unknown
}> {}

export interface SshResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class Ssh extends Context.Tag("Ssh")<
  Ssh,
  {
    readonly execute: (
      command: string,
      config: DeploymentConfig
    ) => Effect.Effect<SshResult, SshError>
    
    readonly executeMultiple: (
      commands: string[],
      config: DeploymentConfig
    ) => Effect.Effect<SshResult, SshError>
  }
>() {}

export const SshLive = Layer.effect(
  Ssh,
  Effect.gen(function* () {
    return {
      execute: (command: string, config: DeploymentConfig) =>
        Effect.gen(function* () {
          const sshTarget = `${config.container.user}@${config.container.host}`
          const sshPort = config.container.port.toString()

          // Build SSH command
          const sshCommand = [
            "ssh",
            "-p",
            sshPort,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=10",
            sshTarget,
            command,
          ]

          // Execute SSH command
          const result = yield* pipe(
            Command.make(sshCommand[0], ...sshCommand.slice(1)),
            Command.string,
            Effect.map((stdout) => ({
              stdout: String(stdout),
              stderr: "",
              exitCode: 0,
            })),
            Effect.catchAll((error) =>
              Effect.fail(
                new SshError({
                  message: `SSH command failed: ${command}`,
                  cause: error,
                })
              )
            )
          )

          return result
        }),

      executeMultiple: (commands: string[], config: DeploymentConfig) =>
        Effect.gen(function* () {
          const sshTarget = `${config.container.user}@${config.container.host}`
          const sshPort = config.container.port.toString()

          // Log the commands being sent
          yield* Effect.log("📡 SSH Connection Details:")
          yield* Effect.log(`   Target: ${sshTarget}`)
          yield* Effect.log(`   Port: ${sshPort}`)
          yield* Effect.log("")
          yield* Effect.log("📋 Commands to execute:")
          for (const cmd of commands) {
            yield* Effect.log(`   ${cmd}`)
          }
          yield* Effect.log("")

          // Combine commands with && for sequential execution
          const combinedCommand = commands.join(" && ")

          // Build SSH command
          const sshCommand = [
            "ssh",
            "-p",
            sshPort,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=10",
            sshTarget,
            combinedCommand,
          ]

          yield* Effect.log("🔧 Full SSH command:")
          yield* Effect.log(`   ${sshCommand.join(" ")}`)
          yield* Effect.log("")

          // Execute SSH command
          const result = yield* pipe(
            Command.make(sshCommand[0], ...sshCommand.slice(1)),
            Command.string,
            Effect.map((stdout) => ({
              stdout: String(stdout),
              stderr: "",
              exitCode: 0,
            })),
            Effect.catchAll((error) =>
              Effect.fail(
                new SshError({
                  message: `SSH commands failed`,
                  cause: error,
                })
              )
            )
          )

          yield* Effect.log("✅ SSH command completed")
          yield* Effect.log("")

          return result
        }),
    }
  })
).pipe(Layer.provide(BunCommandExecutor.layer))
