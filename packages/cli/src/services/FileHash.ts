import { Context, Effect, pipe, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"

export class FileHashError {
  readonly _tag = "FileHashError"
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class FileHash extends Context.Tag("FileHash")<
  FileHash,
  {
    readonly hashFile: (filePath: string) => Effect.Effect<string, FileHashError>
    readonly hashFiles: (
      filePaths: string[]
    ) => Effect.Effect<Record<string, string>, FileHashError>
  }
>() {}

export const FileHashLive = Layer.effect(
  FileHash,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return {
      hashFile: (filePath: string) =>
        pipe(
          fs.readFile(filePath),
          Effect.map((data) => {
            // Use Bun's built-in hasher
            const hasher = new Bun.CryptoHasher("sha256")
            hasher.update(data)
            return hasher.digest("hex")
          }),
          Effect.catchAll((error) =>
            Effect.fail(new FileHashError(`Failed to hash file: ${filePath}`, error))
          )
        ),

      hashFiles: (filePaths: string[]) =>
        Effect.gen(function* () {
          const hashes: Record<string, string> = {}

          for (const filePath of filePaths) {
            const data = yield* fs.readFile(filePath).pipe(
              Effect.catchAll((error) =>
                Effect.fail(
                  new FileHashError(`Failed to read file: ${filePath}`, error)
                )
              )
            )

            const hasher = new Bun.CryptoHasher("sha256")
            hasher.update(data)
            hashes[filePath] = hasher.digest("hex")
          }

          return hashes
        }),
    }
  })
).pipe(Layer.provide(BunFileSystem.layer))
