import { Effect, Console } from "effect"
import { Db } from "../services/Database"
import type { BranchListResponse } from "@devver/shared"

export const getBranches = (project: string) =>
  Effect.gen(function* () {
    const db = yield* Db

    yield* Console.log("─".repeat(60))
    yield* Console.log(`📋 GET /api/branches/${project}`)
    yield* Console.log("─".repeat(60))

    const branches = yield* db.getBranches(project)

    yield* Console.log(`✅ Found ${branches.length} branches:`)
    for (const b of branches) {
      yield* Console.log(`   - ${b.branch} @ ${b.commit_hash.substring(0, 8)}`)
    }
    yield* Console.log("")

    const response: BranchListResponse = {
      branches: branches.map((b) => ({
        branch: b.branch,
        commitHash: b.commit_hash,
        lastDeployedAt: b.last_deployed_at,
      })),
    }

    return response
  })
