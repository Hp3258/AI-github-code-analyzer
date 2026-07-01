import { ReviewStateType } from './state'
import { callMCPTool } from '../lib/mcpClient'

// AGENT 1's JOB:
// Call mcp-github-server to get the file tree
// Filter to a reasonable number of files (avoid analyzing 10,000 files)
// Write the file list to state for Agent 2 and 3 to use

export async function repoParserAgent(state: ReviewStateType): Promise<Partial<ReviewStateType>> {
  console.log(`[Agent 1] Parsing repo: ${state.owner}/${state.repo}`)

  try {
    const result = await callMCPTool<{ files: { path: string; size: number }[]; totalFiles: number }>(
      process.env.MCP_GITHUB_URL!,
      'get_file_tree',
      {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch || 'main'
      }
    )

    console.log(`[Agent 1] Found ${result.totalFiles} code files`)

    // Limit to first 20 files for now — keeps Gemini calls fast and cheap
    // In production you'd prioritize by file size, recency, or importance
    const limitedFiles = result.files.slice(0, 20)

    return {
      files: limitedFiles
    }

  } catch (err: any) {
    console.error('[Agent 1] Failed:', err.message)
    return {
      files: [],
      errors: [`Agent 1 (Repo Parser) failed: ${err.message}`]
    }
  }
}