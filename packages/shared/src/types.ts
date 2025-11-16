import { Schema } from "@effect/schema"

// Runtime types
export const Runtime = Schema.Literal("bun", "node", "python", "go", "static")
export type Runtime = typeof Runtime.Type

// Deployment configuration
export const DeploymentConfig = Schema.Struct({
  project: Schema.String,
  repository: Schema.optional(Schema.String), // Git repository URL
  container: Schema.Struct({
    host: Schema.String,
    port: Schema.Number,
    user: Schema.String,
  }),
  runtime: Runtime,
  buildCommand: Schema.optional(Schema.String), // e.g., "npm run build"
  startCommand: Schema.String,
  healthCheck: Schema.optional(
    Schema.Struct({
      path: Schema.String,
      timeout: Schema.Number,
    })
  ),
  ignore: Schema.Array(Schema.String),
  env: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type DeploymentConfig = typeof DeploymentConfig.Type

// Git change detection result
export const GitChanges = Schema.Struct({
  branch: Schema.String,
  changedFiles: Schema.Array(Schema.String),
  deletedFiles: Schema.Array(Schema.String),
  addedFiles: Schema.Array(Schema.String),
  hasPackageJsonChanges: Schema.Boolean,
  hasLockFileChanges: Schema.Boolean,
})
export type GitChanges = typeof GitChanges.Type

// Deployment result
export const DeploymentResult = Schema.Struct({
  success: Schema.Boolean,
  url: Schema.String,
  duration: Schema.Number,
  filesChanged: Schema.Number,
  dependenciesReinstalled: Schema.Boolean,
  message: Schema.optional(Schema.String),
})
export type DeploymentResult = typeof DeploymentResult.Type

// Deployment status
export const DeploymentStatus = Schema.Struct({
  branch: Schema.String,
  url: Schema.String,
  port: Schema.Number,
  status: Schema.Literal("running", "stopped", "error"),
  pid: Schema.optional(Schema.Number),
  lastDeployed: Schema.String,
})
export type DeploymentStatus = typeof DeploymentStatus.Type

// Branch info for tracking on server
export const BranchInfo = Schema.Struct({
  project: Schema.String,
  branch: Schema.String,
  commitHash: Schema.String,
  createdAt: Schema.String,
  lastDeployedAt: Schema.String,
})
export type BranchInfo = typeof BranchInfo.Type

// Deploy request
export const DeployRequest = Schema.Struct({
  project: Schema.String,
  branch: Schema.String,
  commitHash: Schema.String,
  baseCommitHash: Schema.optional(Schema.String), // Common ancestor for diff
  files: Schema.Array(Schema.Struct({
    path: Schema.String,
    hash: Schema.String,
    content: Schema.String, // base64 encoded
  })),
  deletedFiles: Schema.Array(Schema.String),
})
export type DeployRequest = typeof DeployRequest.Type

// Server branch list response
export const BranchListResponse = Schema.Struct({
  branches: Schema.Array(Schema.Struct({
    branch: Schema.String,
    commitHash: Schema.String,
    lastDeployedAt: Schema.String,
  })),
})
export type BranchListResponse = typeof BranchListResponse.Type

// Server deployments list response
export const DeploymentsListResponse = Schema.Struct({
  deployments: Schema.Array(Schema.Struct({
    project: Schema.String,
    branch: Schema.String,
    commitHash: Schema.String,
    commitShort: Schema.String,
    url: Schema.String,
    port: Schema.Number,
    status: Schema.Literal("online", "stopped", "error"),
    lastDeployedAt: Schema.String,
    pid: Schema.optional(Schema.Number),
  })),
})
export type DeploymentsListResponse = typeof DeploymentsListResponse.Type
