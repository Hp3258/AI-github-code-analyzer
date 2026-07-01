import * as dotenv from 'dotenv'
dotenv.config()

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ReviewStateType } from './state'

export async function reportAgent(state: ReviewStateType): Promise<Partial<ReviewStateType>> {
  console.log(`[Agent 4] Generating final report`)

  const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash',
  temperature: 0.3
})

  const totalIssues = state.securityIssues.length + state.qualityIssues.length
  const criticalCount = state.securityIssues.filter(i => i.severity === 'critical').length
  const highCount = [...state.securityIssues, ...state.qualityIssues].filter(i => i.severity === 'high').length

  let score = 100
  score -= criticalCount * 15
  score -= highCount * 8
  score -= (totalIssues - criticalCount - highCount) * 2
  score = Math.max(0, Math.min(100, score))

  const prompt = `You are a senior code reviewer. Given the following analysis results, write a concise, professional summary (3-4 sentences) of the codebase quality.

Repository: ${state.owner}/${state.repo}
Files analyzed: ${state.files.length}
Total issues found: ${totalIssues}
Critical security issues: ${criticalCount}
High severity issues: ${highCount}
Calculated quality score: ${score}/100

Security issues:
${state.securityIssues.slice(0, 10).map(i => `- [${i.severity}] ${i.title} (${i.filePath})`).join('\n') || 'None found'}

Quality issues:
${state.qualityIssues.slice(0, 10).map(i => `- [${i.severity}] ${i.title} (${i.filePath})`).join('\n') || 'None found'}

Write a summary that a developer would actually find useful. Be specific, not generic. Do not repeat the raw numbers — interpret them.`

  try {
    const response = await model.invoke(prompt)
    const summary = response.content as string

    console.log(`[Agent 4] Report generated. Score: ${score}`)

    return { qualityScore: score, summary }

  } catch (err: any) {
    console.error('[Agent 4] Gemini call failed:', err.message)
    return {
      qualityScore: score,
      summary: `Analysis complete. Found ${totalIssues} issues (${criticalCount} critical, ${highCount} high severity). AI summary generation failed: ${err.message}`,
      errors: [`Agent 4 (Report) Gemini call failed: ${err.message}`]
    }
  }
}