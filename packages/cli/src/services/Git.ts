import { Context, Effect, pipe, Data, Layer } from "effect"
import { BunCommandExecutor, BunFileSystem } from "@effect/platform-bun"
import { Command } from "@effect/platform"
import type { GitChanges } from "@devver/shared"

export class GitError extends Data.TaggedError("GitError")<{
  message: string
  cause?: unknown
}> {}

export class Git extends Context.Tag("Git")<
  Git,
  {
    readonly getCurrentBranch: Effect.Effect<string, GitError>
    readonly getChangedFiles: (
      baseBranch?: string
    ) => Effect.Effect<GitChanges, GitError>
    readonly isGitRepository: Effect.Effect<boolean>
    readonly getRemoteUrl: Effect.Effect<string, GitError>
  }
>() {}

const execGitCommand = (args: readonly string[]) =>
  pipe(
    Command.make("git", ...args),
    Command.string
  )

export const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    return {
      getCurrentBranch: pipe(
        execGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]),
        Effect.map((output) => String(output).trim()),
        Effect.mapError((error) => new GitError({ message: "Failed to get current branch", cause: error }))
      ),

      getChangedFiles: (baseBranch = "origin/main") =>
        Effect.gen(function* () {
          const branch = yield* pipe(
            execGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]),
            Effect.map((s) => String(s).trim())
          )

          // Get changed files
          const changedOutput = yield* pipe(
            execGitCommand(["diff", "--name-only", baseBranch]),
            Effect.map((s) => String(s).trim()),
            Effect.orElse(() => Effect.succeed(""))
          )

          // Get added files
          const addedOutput = yield* pipe(
            execGitCommand(["diff", "--name-only", "--diff-filter=A", baseBranch]),
            Effect.map((s) => String(s).trim()),
            Effect.orElse(() => Effect.succeed(""))
          )

          // Get deleted files
          const deletedOutput = yield* pipe(
            execGitCommand(["diff", "--name-only", "--diff-filter=D", baseBranch]),
            Effect.map((s) => String(s).trim()),
            Effect.orElse(() => Effect.succeed(""))
          )

          const changedFiles = changedOutput
            ? changedOutput.split("\n").filter(Boolean)
            : []
          const addedFiles = addedOutput
            ? addedOutput.split("\n").filter(Boolean)
            : []
          const deletedFiles = deletedOutput
            ? deletedOutput.split("\n").filter(Boolean)
            : []

          const hasPackageJsonChanges = changedFiles.some((f) =>
            f.includes("package.json")
          )
          const hasLockFileChanges = changedFiles.some(
            (f) =>
              f.includes("bun.lock") ||
              f.includes("package-lock.json") ||
              f.includes("yarn.lock") ||
              f.includes("pnpm-lock.yaml")
          )

          return {
            branch,
            changedFiles,
            deletedFiles,
            addedFiles,
            hasPackageJsonChanges,
            hasLockFileChanges,
          } satisfies GitChanges
        }).pipe(
          Effect.mapError((error) => new GitError({ message: "Failed to get changed files", cause: error }))
        ),

      isGitRepository: pipe(
        execGitCommand(["rev-parse", "--is-inside-work-tree"]),
        Effect.map(() => true),
        Effect.catchAll(() => Effect.succeed(false))
      ),

      getRemoteUrl: pipe(
        execGitCommand(["config", "--get", "remote.origin.url"]),
        Effect.map((output) => String(output).trim()),
        Effect.mapError((error) => new GitError({ message: "Failed to get remote URL", cause: error }))
      ),
    }
  })
).pipe(
  Layer.provide(BunCommandExecutor.layer),
  Layer.provide(BunFileSystem.layer)
)
