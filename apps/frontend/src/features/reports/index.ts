// Mizan Pro reports feature
// =========================
//
// Client-side PDF report rendering. Reports are React trees composed from
// `<ReportShell>` + `<ReportSection>` primitives, captured off-screen via
// html2canvas + jsPDF by `useReportRenderer`.
//
// All reports are gated on `entitlements.advancedReports` at the call site.

export { ReportShell, A4_WIDTH_PX, A4_HEIGHT_PX } from "./report-shell";
export type { ReportShellProps } from "./report-shell";
export { ReportSection } from "./report-section";
export type { ReportSectionProps } from "./report-section";
export { useReportRenderer } from "./use-report-renderer";
export type { RenderOptions, RenderResult } from "./use-report-renderer";
