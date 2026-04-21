
export type ReportConfig = {
  title: string
  columns: string[]
  showTotals: boolean
  dateFormat: string
}

export type ReportRow = {
  label: string
  values: number[]
}

export type ReportData = {
  rows: ReportRow[]
  generatedAt: string
}
