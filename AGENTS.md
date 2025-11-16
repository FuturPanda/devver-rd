# Agent Guidelines for Devver

## Build/Test/Lint Commands
- **Typecheck**: `bun run typecheck` (in cli/server packages) or `tsc --noEmit`
- **Run CLI**: `bun run dvr <command>` or `bun run packages/cli/src/index.ts <command>`
- **Run Server**: `bun run server` or `bun run server:dev` (with hot reload)
- **Test**: `bun test` (currently no tests exist - create with `import { test, expect } from "bun:test"`)

## Code Style
- **Runtime**: Use Bun APIs exclusively (`Bun.serve()`, `bun:sqlite`, `Bun.file`) not Node.js equivalents
- **Effect-TS**: All logic uses Effect-TS v3 with `Effect.gen()` for functional error handling
- **Types**: Strict TypeScript with `@effect/schema` for runtime validation (see shared/src/types.ts)
- **Imports**: Use workspace protocol (`@devver/shared`) and explicit `.ts` extensions
- **Services**: Define as Context.Tag with Layer.effect pattern (see Config.ts, Git.ts examples)
- **Error Handling**: Custom error classes with `_tag` field, use `Effect.catchAll()` not try/catch
- **Formatting**: 2-space indent, no semicolons enforced but present in codebase
- **Monorepo**: Workspace structure with packages/cli, packages/server, packages/shared
- **Naming**: PascalCase for services/types, camelCase for functions/variables
- **Console**: Use `Effect.log()` or `Console.log()` from Effect, not raw `console.log()`

## Architecture Notes
- Effect Services layer composition pattern: merge services with `Layer.mergeAll()`
- Git-based deployment: detect changes, hash files, SCP transfer, SSH execution
- Config stored in `devver.config.json` at project root, validated against DeploymentConfig schema
