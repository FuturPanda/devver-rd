import { Effect, Console } from "effect"
import { Db } from "../services/Database"
import { PM2 } from "../services/PM2"
import * as crypto from "crypto"

export interface DeploymentInfo {
  project: string
  branch: string
  commitHash: string
  commitShort: string
  url: string
  port: number
  status: "online" | "stopped" | "error"
  lastDeployedAt: string
  pid?: number
}

export const getDeployments = (project: string) =>
  Effect.gen(function* () {
    const db = yield* Db
    const pm2 = yield* PM2

    yield* Console.log("────────────────────────────────────────────────────────────")
    yield* Console.log(`📋 GET /api/deployments/${project}`)
    yield* Console.log("────────────────────────────────────────────────────────────")

    // Get all branches for this project
    const branches = yield* db.getBranches(project)

    yield* Console.log(`   Found ${branches.length} deployment(s)`)

    // Get process info for each deployment
    const deployments: DeploymentInfo[] = []

    for (const branch of branches) {
      const commitShort = branch.commit_hash.substring(0, 8)
      
      // Calculate port (same logic as in deploy.ts)
      const portHash = crypto.createHash("md5")
        .update(`${project}-${branch.commit_hash}`)
        .digest("hex")
      const port = 4000 + (parseInt(portHash.substring(0, 4), 16) % 10000)

      // Get process status
      const processName = `${project}-${commitShort}`
      const processInfo = yield* pm2.getProcessInfo(processName)

      const status = processInfo?.status || "stopped"

      deployments.push({
        project,
        branch: branch.branch,
        commitHash: branch.commit_hash,
        commitShort,
        url: `http://${project}-${commitShort}.localhost`,
        port,
        status,
        lastDeployedAt: branch.last_deployed_at,
        pid: processInfo?.pid
      })
    }

    yield* Console.log(`✅ Returning ${deployments.length} deployment(s)`)
    yield* Console.log("")

    return { deployments }
  })
