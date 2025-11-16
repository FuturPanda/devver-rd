import { Effect, Console } from "effect"
import { Config } from "../services/Config"
import { Git } from "../services/Git"
import { Http } from "../services/Http"
import * as crypto from "crypto"
import type { DeployRequest } from "@devver/shared"

export const deployCommand = (branch?: string) =>
  Effect.gen(function* () {
    const startTime = Date.now()
    
    const config = yield* Config
    const git = yield* Git
    const http = yield* Http

    yield* Console.log("🚀 Starting deployment...")
    yield* Console.log("")

    // Load configuration
    const cfg = yield* config.load.pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function* () {
          yield* Console.error(
            "❌ Failed to load devver.config.json. Run 'devver init' first."
          )
          return yield* Effect.fail(error)
        })
      })
    )

    yield* Console.log(`📦 Project: ${cfg.project}`)

    // Get current branch if not specified
    const targetBranch = branch || (yield* git.getCurrentBranch)
    yield* Console.log(`🌿 Branch: ${targetBranch}`)
    
    // Get current commit hash
    const currentCommit = yield* git.getCurrentCommitHash
    yield* Console.log(`📝 Commit: ${currentCommit.substring(0, 8)}`)
    yield* Console.log("")

    // Get branches from server
    const serverUrl = "http://localhost:3333"
    yield* Console.log("🔍 Fetching deployed branches from server...")
    const branchList = yield* http.getBranches(cfg.project, serverUrl).pipe(
      Effect.catchAll(() => Effect.succeed({ branches: [] }))
    )

    yield* Console.log(`   Found ${branchList.branches.length} deployed branch(es)`)
    yield* Console.log("")

    // Find closest common ancestor
    let baseCommit: string | undefined
    let closestBranch: string | undefined

    if (branchList.branches.length > 0) {
      yield* Console.log("🔎 Finding closest common ancestor...")
      
      // First, try to find the same branch (fastest case)
      const sameBranchDeployment = branchList.branches.find(b => b.branch === targetBranch)
      if (sameBranchDeployment) {
        // Try to use merge-base, but if it fails (commit doesn't exist), use HEAD~1
        const mergeBase = yield* git.getMergeBase(currentCommit, sameBranchDeployment.commitHash).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        )
        
        if (mergeBase) {
          baseCommit = mergeBase
          closestBranch = sameBranchDeployment.branch
        } else {
          // Commit doesn't exist in git history (likely deployed from dirty working dir)
          // Use HEAD~1 to detect changes in the latest commit
          const parentProc = Bun.spawn(["git", "rev-parse", "HEAD~1"], {
            stdout: "pipe",
            stderr: "pipe",
          })
          const parentOutput = yield* Effect.promise(async () => {
            const text = await new Response(parentProc.stdout).text()
            return text.trim()
          })
          const exitCode = yield* Effect.promise(() => parentProc.exited)
          
          if (exitCode === 0 && parentOutput) {
            baseCommit = parentOutput
            closestBranch = targetBranch
            yield* Console.log(`   Previous deployment not in git history, using HEAD~1 (${parentOutput.substring(0, 8)}) as base`)
          }
        }
      } else {
        // Try other branches
        for (const remoteBranch of branchList.branches) {
          const mergeBase = yield* git.getMergeBase(currentCommit, remoteBranch.commitHash).pipe(
            Effect.catchAll(() => Effect.succeed(null))
          )
          
          if (mergeBase) {
            baseCommit = mergeBase
            closestBranch = remoteBranch.branch
            break
          }
        }
      }

      if (baseCommit && closestBranch && !baseCommit.includes("HEAD~1")) {
        yield* Console.log(`   Using ${closestBranch} (${baseCommit.substring(0, 8)}) as base`)
      } else if (!baseCommit) {
        yield* Console.log("   No common ancestor found, deploying all files")
      }
      yield* Console.log("")
    } else {
      yield* Console.log("📦 First deployment, deploying all files")
      yield* Console.log("")
    }

    // Get changed files
    yield* Console.log("🔍 Detecting changes...")
    const changes = baseCommit 
      ? yield* git.getChangedFilesFromCommit(baseCommit).pipe(
          Effect.catchAll(() => {
            return Effect.succeed({
              branch: targetBranch,
              changedFiles: [],
              deletedFiles: [],
              addedFiles: [],
              hasPackageJsonChanges: true,
              hasLockFileChanges: true,
            })
          })
        )
      : {
          branch: targetBranch,
          changedFiles: [],
          deletedFiles: [],
          addedFiles: [],
          hasPackageJsonChanges: true,
          hasLockFileChanges: true,
        }

    // If no base commit, deploy all files
    let filesToDeploy = [...new Set(changes.changedFiles.concat(changes.addedFiles))]
    
    if (!baseCommit || filesToDeploy.length === 0) {
      // Get all tracked files
      yield* Console.log("   Getting all tracked files...")
      const allFilesProc = Bun.spawn(["git", "ls-files"], {
        stdout: "pipe",
        stderr: "pipe",
      })
      const allFilesOutput = yield* Effect.promise(async () => {
        const text = await new Response(allFilesProc.stdout).text()
        return text.trim()
      })
      yield* Effect.promise(() => allFilesProc.exited)
      
      filesToDeploy = allFilesOutput.split("\n").filter(Boolean)
      yield* Console.log(`   Found ${filesToDeploy.length} files to deploy`)
    } else {
      yield* Console.log(`   Changed files: ${changes.changedFiles.length}`)
      yield* Console.log(`   Added files: ${changes.addedFiles.length}`)
      yield* Console.log(`   Deleted files: ${changes.deletedFiles.length}`)
    }

    if (changes.hasPackageJsonChanges || changes.hasLockFileChanges) {
      yield* Console.log("   📦 Dependency changes detected - will reinstall")
    }

    yield* Console.log("")

    // Show changed files
    if (filesToDeploy.length > 0) {
      yield* Console.log("📄 Files to deploy:")
      for (const file of filesToDeploy.slice(0, 10)) {
        yield* Console.log(`   • ${file}`)
      }
      if (filesToDeploy.length > 10) {
        yield* Console.log(`   ... and ${filesToDeploy.length - 10} more`)
      }
      yield* Console.log("")
    }

    // Read and hash files
    yield* Console.log("📦 Preparing files for transfer...")
    const deployFiles: Array<{ path: string; hash: string; content: string }> = []
    
    for (const filePath of filesToDeploy) {
      const content = yield* git.getFileContent(filePath).pipe(
        Effect.catchAll(() => {
          return Effect.gen(function* () {
            yield* Console.warn(`   ⚠️  Could not read ${filePath}, skipping`)
            return Buffer.from("")
          })
        })
      )
      
      if (content.length === 0) continue
      
      const hash = crypto.createHash("sha256").update(content).digest("hex")
      const base64Content = content.toString("base64")
      
      deployFiles.push({
        path: filePath,
        hash,
        content: base64Content,
      })
    }

    yield* Console.log(`   ✅ Prepared ${deployFiles.length} files`)
    yield* Console.log("")

    // Create deploy request
    const deployRequest: DeployRequest = {
      project: cfg.project,
      branch: targetBranch,
      commitHash: currentCommit,
      baseCommitHash: baseCommit,
      files: deployFiles,
      deletedFiles: changes.deletedFiles,
    }

    // Send to server
    yield* Console.log("🚀 Deploying to server...")
    yield* Console.log("")

    const deployStartTime = Date.now()

    const result = yield* http.deployProject(deployRequest, cfg, serverUrl).pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function* () {
          yield* Console.error("❌ Deployment failed")
          yield* Console.error(`   Error: ${error.message}`)
          return yield* Effect.fail(error)
        })
      })
    )

    if (result.success) {
      const endTime = Date.now()
      const totalDurationMs = endTime - startTime
      const serverDurationMs = endTime - deployStartTime
      const prepDurationMs = deployStartTime - startTime
      
      const totalSec = (totalDurationMs / 1000).toFixed(2)
      const serverSec = (serverDurationMs / 1000).toFixed(2)
      const prepSec = (prepDurationMs / 1000).toFixed(2)
      
      yield* Console.log("")
      yield* Console.log("✅ Deployment complete!")
      yield* Console.log("")
      yield* Console.log(`🌐 URL: ${result.url}`)
      yield* Console.log(`📊 Files changed: ${result.filesChanged}`)
      if (result.dependenciesReinstalled) {
        yield* Console.log(`📦 Dependencies reinstalled`)
      }
      yield* Console.log("")
      yield* Console.log(`⏱️  Total time: ${totalSec}s`)
      yield* Console.log(`   └─ Preparation: ${prepSec}s`)
      yield* Console.log(`   └─ Server deployment: ${serverSec}s`)
    } else {
      yield* Console.error(`❌ Deployment failed: ${result.message}`)
    }
  })
