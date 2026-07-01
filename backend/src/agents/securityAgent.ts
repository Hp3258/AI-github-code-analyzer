import { ReviewStateType, SecurityIssue } from './state'
import { callMCPTool } from '../lib/mcpClient'

// AGENT 2's JOB (as you designed):
// 80% rule-based — call mcp-code-server's check_security_patterns
// 20% LLM — for now we'll add the Gemini call in a later pass
// Today: get the rule-based detection working end to end

export async function securityAgent(state: ReviewStateType): Promise<Partial<ReviewStateType>> {
  console.log(`[Agent 2] Running security analysis on ${state.files.length} files`)

  const allIssues: SecurityIssue[] = []
  const errors: string[] = []

  // Process files one at a time to avoid overwhelming the MCP servers
  // In production you might batch these, but sequential is safer to start
  for (const file of state.files) {
    try {
      // Step 1: fetch the file content
      const fileData = await callMCPTool<{ content: string; path: string }>(
        process.env.MCP_FILE_URL!,
        'get_file_contents',
        { owner: state.owner, repo: state.repo, path: file.path, branch: state.branch || 'main' }
      )

      // Step 2: run rule-based security checks on that content
      const securityResult = await callMCPTool<{ issues: any[] }>(
        process.env.MCP_CODE_URL!,
        'check_security_patterns',
        { content: fileData.content, path: file.path }
      )

      const issuesWithPath = securityResult.issues.map(issue => ({
        ...issue,
        filePath: file.path
      }))

      allIssues.push(...issuesWithPath)

    } catch (err: any) {
      console.error(`[Agent 2] Failed on ${file.path}:`, err.message)
      errors.push(`Security check failed on ${file.path}: ${err.message}`)
    }
  }

  console.log(`[Agent 2] Found ${allIssues.length} security issues`)

  return {
    securityIssues: allIssues,
    errors
  }
}