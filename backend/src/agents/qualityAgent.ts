import { ReviewStateType, QualityIssue } from './state'
import { callMCPTool } from '../lib/mcpClient'

// AGENT 3's JOB:
// Mostly rule-based — call mcp-code-server's analyze_complexity
// Convert complexity metrics into quality "issues" with severity

export async function qualityAgent(state: ReviewStateType): Promise<Partial<ReviewStateType>> {
  console.log(`[Agent 3] Running quality analysis on ${state.files.length} files`)

  const allIssues: QualityIssue[] = []
  const errors: string[] = []

  for (const file of state.files) {
    try {
      const fileData = await callMCPTool<{ content: string }>(
        process.env.MCP_FILE_URL!,
        'get_file_contents',
        { owner: state.owner, repo: state.repo, path: file.path, branch: state.branch || 'main' }
      )

      const complexity = await callMCPTool<{
        cyclomaticComplexity: number
        complexityRating: string
        avgLinesPerFunction: number
        totalLines: number
        functionCount: number
      }>(
        process.env.MCP_CODE_URL!,
        'analyze_complexity',
        { content: fileData.content, path: file.path }
      )

      // Convert raw metrics into actionable issues
      // This is the translation layer — turning numbers into advice

      if (complexity.complexityRating === 'high') {
        allIssues.push({
          severity: 'high',
          category: 'complexity',
          title: 'High cyclomatic complexity',
          description: `This file has a complexity score of ${complexity.cyclomaticComplexity}. Consider breaking it into smaller functions.`,
          filePath: file.path
        })
      }

      if (complexity.avgLinesPerFunction > 50) {
        allIssues.push({
          severity: 'medium',
          category: 'maintainability',
          title: 'Long functions detected',
          description: `Average ${complexity.avgLinesPerFunction} lines per function. Functions over 50 lines are harder to test and understand.`,
          filePath: file.path
        })
      }

      if (complexity.totalLines > 300) {
        allIssues.push({
          severity: 'low',
          category: 'maintainability',
          title: 'Large file',
          description: `This file has ${complexity.totalLines} lines. Consider splitting into multiple modules.`,
          filePath: file.path
        })
      }

    } catch (err: any) {
      console.error(`[Agent 3] Failed on ${file.path}:`, err.message)
      errors.push(`Quality check failed on ${file.path}: ${err.message}`)
    }
  }

  console.log(`[Agent 3] Found ${allIssues.length} quality issues`)

  return {
    qualityIssues: allIssues,
    errors
  }
}