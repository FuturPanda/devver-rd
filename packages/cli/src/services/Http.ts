import { Context, Effect, Data, Layer } from "effect"
import type { DeploymentConfig } from "@devver/shared"

export class HttpError extends Data.TaggedError("HttpError")<{
  message: string
  cause?: unknown
}> {}

export interface SetupResult {
  success: boolean
  message: string
  path?: string
}

export class Http extends Context.Tag("Http")<
  Http,
  {
    readonly setupProject: (
      config: DeploymentConfig,
      serverUrl: string
    ) => Effect.Effect<SetupResult, HttpError>
  }
>() {}

export const HttpLive = Layer.succeed(
  Http,
  {
    setupProject: (config: DeploymentConfig, serverUrl: string) =>
      Effect.gen(function* () {
        yield* Effect.log(`📡 Sending setup request to ${serverUrl}/api/setup`)
        yield* Effect.log("")

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(`${serverUrl}/api/setup`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(config),
            }),
          catch: (error) =>
            new HttpError({
              message: "Failed to connect to server",
              cause: error,
            }),
        })

        if (!response.ok) {
          return yield* Effect.fail(
            new HttpError({
              message: `Server returned ${response.status}`,
            })
          )
        }

        const result = yield* Effect.tryPromise({
          try: () => response.json() as Promise<SetupResult>,
          catch: (error) =>
            new HttpError({
              message: "Failed to parse response",
              cause: error,
            }),
        })

        return result
      }),
  }
)
