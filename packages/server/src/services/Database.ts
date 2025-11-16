import { Context, Effect, Layer, Data } from "effect"
import { Database } from "bun:sqlite"

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string
  cause?: unknown
}> {}

export interface BranchRecord {
  id: number
  project: string
  branch: string
  commit_hash: string
  created_at: string
  last_deployed_at: string
}

export interface FileRecord {
  id: number
  hash: string
  content: Buffer
  created_at: string
}

export interface DeploymentFileRecord {
  id: number
  project: string
  branch: string
  commit_hash: string
  file_path: string
  file_hash: string
}

export class Db extends Context.Tag("Db")<
  Db,
  {
    readonly getBranches: (project: string) => Effect.Effect<BranchRecord[], DatabaseError>
    readonly getBranch: (project: string, branch: string) => Effect.Effect<BranchRecord | null, DatabaseError>
    readonly saveBranch: (
      project: string,
      branch: string,
      commitHash: string
    ) => Effect.Effect<void, DatabaseError>
    readonly saveFile: (hash: string, content: Buffer) => Effect.Effect<void, DatabaseError>
    readonly getFile: (hash: string) => Effect.Effect<Buffer | null, DatabaseError>
    readonly saveDeploymentFiles: (
      project: string,
      branch: string,
      commitHash: string,
      files: Array<{ path: string; hash: string }>
    ) => Effect.Effect<void, DatabaseError>
    readonly getDeploymentFiles: (
      project: string,
      branch: string
    ) => Effect.Effect<Array<{ path: string; hash: string }>, DatabaseError>
  }
>() {}

export const DbLive = Layer.effect(
  Db,
  Effect.gen(function* () {
    const db = new Database("/tmp/devver-apps/devver.db")

    // Initialize tables
    db.run(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        branch TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_deployed_at TEXT NOT NULL,
        UNIQUE(project, branch)
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        content BLOB NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS deployment_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        branch TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        UNIQUE(project, commit_hash, file_path)
      )
    `)

    return {
      getBranches: (project: string) =>
        Effect.try({
          try: () => {
            const query = db.query<BranchRecord, [string]>(
              "SELECT * FROM branches WHERE project = ? ORDER BY last_deployed_at DESC"
            )
            return query.all(project)
          },
          catch: (error) => new DatabaseError({ message: "Failed to get branches", cause: error }),
        }),

      getBranch: (project: string, branch: string) =>
        Effect.try({
          try: () => {
            const query = db.query<BranchRecord, [string, string]>(
              "SELECT * FROM branches WHERE project = ? AND branch = ?"
            )
            return query.get(project, branch) || null
          },
          catch: (error) => new DatabaseError({ message: "Failed to get branch", cause: error }),
        }),

      saveBranch: (project: string, branch: string, commitHash: string) =>
        Effect.try({
          try: () => {
            const now = new Date().toISOString()
            const query = db.query(
              `INSERT INTO branches (project, branch, commit_hash, created_at, last_deployed_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(project, branch) DO UPDATE SET
                 commit_hash = excluded.commit_hash,
                 last_deployed_at = excluded.last_deployed_at`
            )
            query.run(project, branch, commitHash, now, now)
          },
          catch: (error) => new DatabaseError({ message: "Failed to save branch", cause: error }),
        }),

      saveFile: (hash: string, content: Buffer) =>
        Effect.try({
          try: () => {
            const now = new Date().toISOString()
            const query = db.query(
              "INSERT OR IGNORE INTO files (hash, content, created_at) VALUES (?, ?, ?)"
            )
            query.run(hash, content, now)
          },
          catch: (error) => new DatabaseError({ message: "Failed to save file", cause: error }),
        }),

      getFile: (hash: string) =>
        Effect.try({
          try: () => {
            const query = db.query<FileRecord, [string]>(
              "SELECT * FROM files WHERE hash = ?"
            )
            const result = query.get(hash)
            return result ? result.content : null
          },
          catch: (error) => new DatabaseError({ message: "Failed to get file", cause: error }),
        }),

      saveDeploymentFiles: (
        project: string,
        branch: string,
        commitHash: string,
        files: Array<{ path: string; hash: string }>
      ) =>
        Effect.try({
          try: () => {
            // Use a transaction to ensure atomicity
            const transaction = db.transaction((project: string, branch: string, commitHash: string, files: Array<{ path: string; hash: string }>) => {
              // Delete old deployment files for this branch (in case of re-deployment)
              const deleteQuery = db.query(
                "DELETE FROM deployment_files WHERE project = ? AND branch = ?"
              )
              deleteQuery.run(project, branch)

              // Insert new deployment files
              const insertQuery = db.query(
                `INSERT INTO deployment_files (project, branch, commit_hash, file_path, file_hash)
                 VALUES (?, ?, ?, ?, ?)`
              )
              for (const file of files) {
                insertQuery.run(project, branch, commitHash, file.path, file.hash)
              }
            })
            
            transaction(project, branch, commitHash, files)
          },
          catch: (error) =>
            new DatabaseError({ message: "Failed to save deployment files", cause: error }),
        }),

      getDeploymentFiles: (project: string, branch: string) =>
        Effect.try({
          try: () => {
            const query = db.query<DeploymentFileRecord, [string, string]>(
              "SELECT file_path, file_hash FROM deployment_files WHERE project = ? AND branch = ?"
            )
            const results = query.all(project, branch)
            return results.map(r => ({ path: r.file_path, hash: r.file_hash }))
          },
          catch: (error) =>
            new DatabaseError({ message: "Failed to get deployment files", cause: error }),
        }),
    }
  })
)
