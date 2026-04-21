
export type AppConfig = {
  port: number
  dbUrl: string
  logLevel: "debug" | "info" | "warn" | "error"
  maxConnections: number
}
