import { Context, Effect, Data, Layer } from "effect"
import type { DeploymentConfig, DeployRequest, DeploymentResult, BranchListResponse, DeploymentsListResponse } from "@devver/shared"

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
    readonly deployProject: (
      request: DeployRequest,
      config: DeploymentConfig,
      serverUrl: string
    ) => Effect.Effect<DeploymentResult, HttpError>
    readonly getBranches: (
      project: string,
      serverUrl: string
    ) => Effect.Effect<BranchListResponse, HttpError>
    readonly getDeployments: (
      project: string,
      serverUrl: string
    ) => Effect.Effect<DeploymentsListResponse, HttpError>
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
          // Try to get error details from response
          const errorResult = yield* Effect.tryPromise({
            try: () => response.json() as Promise<SetupResult>,
            catch: () => new HttpError({ message: `Server returned ${response.status}` })
          })
          
          // If we got a result object, use its message
          if (typeof errorResult === 'object' && 'message' in errorResult) {
            return yield* Effect.fail(
              new HttpError({
                message: errorResult.message || `Server returned ${response.status}`,
              })
            )
          }
          
          // Otherwise use the HttpError that was caught
          return yield* Effect.fail(errorResult)
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

    deployProject: (request: DeployRequest, config: DeploymentConfig, serverUrl: string) =>
      Effect.gen(function* () {
        yield* Effect.log(`📡 Sending deploy request to ${serverUrl}/api/deploy`)
        yield* Effect.log(`📦 Files: ${request.files.length}, Branch: ${request.branch}`)

        const body = JSON.stringify({ request, config })
        yield* Effect.log(`📊 Request body size: ${body.length} bytes`)

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(`${serverUrl}/api/deploy`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body,
            }),
          catch: (error) =>
            new HttpError({
              message: "Failed to connect to server",
              cause: error,
            }),
        })

        yield* Effect.log(`📡 Server responded with status: ${response.status}`)

        if (!response.ok) {
          // Try to get error details from response
          const errorText = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => new HttpError({ message: "Could not read error response" })
          })
          yield* Effect.log(`❌ Error response: ${errorText}`)
          
          return yield* Effect.fail(
            new HttpError({
              message: `Server returned ${response.status}: ${errorText}`,
            })
          )
        }

        const result = yield* Effect.tryPromise({
          try: () => response.json() as Promise<DeploymentResult>,
          catch: (error) =>
            new HttpError({
              message: "Failed to parse response",
              cause: error,
            }),
        })

        return result
      }),

    getBranches: (project: string, serverUrl: string) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(`${serverUrl}/api/branches/${project}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
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
          try: () => response.json() as Promise<BranchListResponse>,
          catch: (error) =>
            new HttpError({
              message: "Failed to parse response",
              cause: error,
            }),
        })

        return result
      }),

    getDeployments: (project: string, serverUrl: string) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(`${serverUrl}/api/deployments/${project}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
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
          try: () => response.json() as Promise<DeploymentsListResponse>,
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
