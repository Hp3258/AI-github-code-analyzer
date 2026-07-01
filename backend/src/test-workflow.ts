import * as dotenv from 'dotenv'
dotenv.config()

import { runReview } from './agents/workflow'

async function main() {
  console.log('Starting review workflow...\n')

  const result = await runReview('Hp3258', 'AI-github-code-analyzer', 'main')

  console.log('\n=== FINAL RESULT ===')
  console.log('Quality Score:', result.qualityScore)
  console.log('Summary:', result.summary)
  console.log('Security Issues:', result.securityIssues.length)
  console.log('Quality Issues:', result.qualityIssues.length)
  console.log('Errors:', result.errors)
}

main().catch(console.error)