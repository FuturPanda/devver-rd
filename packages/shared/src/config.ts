import type { DeploymentConfig } from "./types"

export const DefaultConfig: DeploymentConfig = {
  project: "my-app",
  container: {
    host: "localhost",
    port: 22,
    user: "deploy",
  },
  runtime: "bun",
  startCommand: "bun run src/main.ts",
  ignore: [
    "node_modules/**",
    ".git/**",
    "*.log",
    "dist/**",
    ".env*",
    "*.test.ts",
    "coverage/**",
  ],
  env: {
    NODE_ENV: "development",
  },
}

export const CONFIG_FILE_NAME = "devver.config.json"
