import { Context, Effect, pipe, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"
import { DeploymentConfig, DefaultConfig, CONFIG_FILE_NAME } from "@devver/shared"

export class ConfigError {
  readonly _tag = "ConfigError"
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class Config extends Context.Tag("Config")<
  Config,
  {
    readonly load: Effect.Effect<DeploymentConfig, ConfigError>
    readonly save: (config: DeploymentConfig) => Effect.Effect<void, ConfigError>
    readonly exists: Effect.Effect<boolean, never>
    readonly init: Effect.Effect<DeploymentConfig, ConfigError>
  }
>() {}

export const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const cwd = process.cwd()
    const configPath = `${cwd}/${CONFIG_FILE_NAME}`

    return {
      load: pipe(
        fs.readFileString(configPath),
        Effect.flatMap((content) =>
          Effect.try({
            try: () => JSON.parse(content),
            catch: (error) => new ConfigError("Failed to parse config file", error),
          })
        ),
        Effect.catchAll((error) =>
          Effect.fail(
            new ConfigError(`Failed to load config from ${configPath}`, error)
          )
        )
      ),

      save: (config: DeploymentConfig) =>
        pipe(
          Effect.sync(() => JSON.stringify(config, null, 2)),
          Effect.flatMap((content) => fs.writeFileString(configPath, content)),
          Effect.catchAll((error) =>
            Effect.fail(new ConfigError("Failed to save config", error))
          ),
          Effect.asVoid
        ),

      exists: pipe(
        fs.exists(configPath),
        Effect.catchAll(() => Effect.succeed(false))
      ),

      init: Effect.gen(function* () {
        const alreadyExists = yield* fs.exists(configPath).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )

        if (alreadyExists) {
          return yield* Effect.fail(
            new ConfigError(`${CONFIG_FILE_NAME} already exists`)
          )
        }

        const content = JSON.stringify(DefaultConfig, null, 2)
        yield* fs.writeFileString(configPath, content).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new ConfigError("Failed to create config file", error))
          )
        )

        return DefaultConfig
      }),
    }
  })
).pipe(Layer.provide(BunFileSystem.layer))
