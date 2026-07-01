import { Annotation } from '@langchain/langgraph'

// THE STATE SCHEMA
// Every field needs a "reducer" — a function that decides
// HOW to merge a new value into the existing state.
//
// Most fields use the default: just replace the old value.
// Arrays sometimes need to be APPENDED instead of replaced —
// that's what the reducer function controls.

export interface FileInfo {
  path: string
  size: number
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  filePath: string
  lineNumber?: number
}

export interface QualityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  filePath: string
  lineNumber?: number
}

export const ReviewState = Annotation.Root({
  // Input — set once at the start, never changes
  owner: Annotation<string>,
  repo: Annotation<string>,
  branch: Annotation<string>,

  // Agent 1 output
  files: Annotation<FileInfo[]>({
    reducer: (_old, newVal) => newVal,  // replace entirely
    default: () => []
  }),

  // Agent 2 output — security issues found
  securityIssues: Annotation<SecurityIssue[]>({
    reducer: (_old, newVal) => newVal,
    default: () => []
  }),

  // Agent 3 output — quality issues found
  qualityIssues: Annotation<QualityIssue[]>({
    reducer: (_old, newVal) => newVal,
    default: () => []
  }),

  // Agent 4 output — final synthesized report
  qualityScore: Annotation<number>({
    reducer: (_old, newVal) => newVal,
    default: () => 0
  }),
  summary: Annotation<string>({
    reducer: (_old, newVal) => newVal,
    default: () => ''
  }),

  // Tracking
  errors: Annotation<string[]>({
    reducer: (old, newVal) => [...old, ...newVal],  // APPEND, don't replace
    default: () => []
  })
})

export type ReviewStateType = typeof ReviewState.State