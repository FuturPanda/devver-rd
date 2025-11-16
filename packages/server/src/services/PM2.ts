import { Context, Effect, Layer, Data } from "effect"

export class PM2Error extends Data.TaggedError("PM2Error")<{
  message: string
  cause?: unknown
}> {}

export interface PM2ProcessInfo {
  name: string
  pid?: number
  status: "online" | "stopped" | "error"
  port: number
}

export class PM2 extends Context.Tag("PM2")<
  PM2,
  {
    readonly startProcess: (
      name: string,
      cwd: string,
      script: string,
      port: number,
      env?: Record<string, string>
    ) => Effect.Effect<void, PM2Error>
    readonly stopProcess: (name: string) => Effect.Effect<void, PM2Error>
    readonly restartProcess: (name: string) => Effect.Effect<void, PM2Error>
    readonly getProcessInfo: (name: string) => Effect.Effect<PM2ProcessInfo | null, PM2Error>
    readonly deleteProcess: (name: string) => Effect.Effect<void, PM2Error>
  }
>() {}

export const PM2Live = Layer.effect(
  PM2,
  Effect.gen(function* () {
    return {
      startProcess: (name: string, cwd: string, script: string, port: number, env?: Record<string, string>) =>
        Effect.gen(function* () {
          // Check if process already exists
          const checkProc = Bun.spawn(["pm2", "describe", name], {
            stdout: "pipe",
            stderr: "pipe",
          })
          const exitCode = yield* Effect.promise(() => checkProc.exited)

          // Parse the script command (e.g., "npm run start:prod" -> ["npm", "run", "start:prod"])
          const scriptParts = script.trim().split(/\s+/)
          if (scriptParts.length === 0 || !scriptParts[0]) {
            return yield* Effect.fail(
              new PM2Error({ message: `Invalid start command: "${script}"` })
            )
          }
          const command = scriptParts[0]
          const args = scriptParts.slice(1)

          // Environment variables for the process
          const processEnv = {
            ...(process.env as Record<string, string>),
            ...(env || {}),
            PORT: String(port),
            NODE_ENV: "production",
          }

          if (exitCode === 0) {
            // Process exists, delete it first to ensure script command is updated
            yield* Effect.log(`Process ${name} exists, deleting and recreating...`)
            const deleteProc = Bun.spawn(["pm2", "delete", name], {
              stdout: "inherit",
              stderr: "inherit",
            })
            yield* Effect.promise(() => deleteProc.exited)
          }

          // Start new process (or recreate after deletion)
          yield* Effect.log(`Starting process ${name}...`)
          const startProc = Bun.spawn(
            [
              "pm2",
              "start",
              command,
              "--name",
              name,
              "--cwd",
              cwd,
              ...(args.length > 0 ? ["--", ...args] : []),
            ],
            {
              env: processEnv,
              stdout: "inherit",
              stderr: "inherit",
            }
          )
          const startResult = yield* Effect.promise(() => startProc.exited)
          if (startResult !== 0) {
            return yield* Effect.fail(
              new PM2Error({ message: `Failed to start process ${name}` })
            )
          }

          // Save PM2 process list
          const saveProc = Bun.spawn(["pm2", "save"], {
            stdout: "inherit",
            stderr: "inherit",
          })
          yield* Effect.promise(() => saveProc.exited)
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new PM2Error({ message: "Failed to start process", cause: error }))
          )
        ),

      stopProcess: (name: string) =>
        Effect.gen(function* () {
          const proc = Bun.spawn(["pm2", "stop", name], {
            stdout: "inherit",
            stderr: "inherit",
          })
          const exitCode = yield* Effect.promise(() => proc.exited)
          if (exitCode !== 0) {
            return yield* Effect.fail(new PM2Error({ message: `Failed to stop process ${name}` }))
          }
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new PM2Error({ message: "Failed to stop process", cause: error }))
          )
        ),

      restartProcess: (name: string) =>
        Effect.gen(function* () {
          const proc = Bun.spawn(["pm2", "restart", name], {
            stdout: "inherit",
            stderr: "inherit",
          })
          const exitCode = yield* Effect.promise(() => proc.exited)
          if (exitCode !== 0) {
            return yield* Effect.fail(
              new PM2Error({ message: `Failed to restart process ${name}` })
            )
          }
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new PM2Error({ message: "Failed to restart process", cause: error }))
          )
        ),

      getProcessInfo: (name: string) =>
        Effect.gen(function* () {
          const proc = Bun.spawn(["pm2", "jlist"], {
            stdout: "pipe",
            stderr: "pipe",
          })
          const output = yield* Effect.promise(async () => {
            const text = await new Response(proc.stdout).text()
            return text
          })
          const exitCode = yield* Effect.promise(() => proc.exited)

          if (exitCode !== 0) {
            return null
          }

          try {
            const processes = JSON.parse(output)
            const found = processes.find((p: any) => p.name === name)
            if (!found) return null

            return {
              name: found.name,
              pid: found.pid,
              status: found.pm2_env?.status === "online" ? "online" : "stopped",
              port: found.pm2_env?.PORT || 0,
            } as PM2ProcessInfo
          } catch {
            return null
          }
        }).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        ),

      deleteProcess: (name: string) =>
        Effect.gen(function* () {
          const proc = Bun.spawn(["pm2", "delete", name], {
            stdout: "inherit",
            stderr: "inherit",
          })
          yield* Effect.promise(() => proc.exited)
          // Don't fail if process doesn't exist
        }).pipe(
          Effect.catchAll(() => Effect.void)
        ),
    }
  })
)
