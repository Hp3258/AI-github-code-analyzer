import { StateGraph, START, END } from '@langchain/langgraph'
import { ReviewState, ReviewStateType } from './state'
import { repoParserAgent } from './repoParser'
import { securityAgent } from './securityAgent'
import { qualityAgent } from './qualityAgent'
import { reportAgent } from './reportAgent'

// THE GRAPH STRUCTURE
//
//        START
//          ↓
//      repo_parser
//        ↙     ↘
//  security   quality      ← run in parallel
//        ↘     ↙
//      report_generator
//          ↓
//         END

const graph = new StateGraph(ReviewState)
  .addNode('repo_parser', repoParserAgent)
  .addNode('security_check', securityAgent)
  .addNode('quality_check', qualityAgent)
  .addNode('report_generator', reportAgent)

  // Edges define WHEN to move to the next node
  .addEdge(START, 'repo_parser')

  // Fan-out: repo_parser feeds BOTH security_check and quality_check
  .addEdge('repo_parser', 'security_check')
  .addEdge('repo_parser', 'quality_check')

  // Fan-in: report_generator only runs once BOTH parents have finished
  // LangGraph automatically waits for all incoming edges before running a node
  .addEdge('security_check', 'report_generator')
  .addEdge('quality_check', 'report_generator')

  .addEdge('report_generator', END)

export const reviewWorkflow = graph.compile()

// Helper function to run the full workflow
export async function runReview(owner: string, repo: string, branch = 'main') {
  const result = await reviewWorkflow.invoke({
    owner,
    repo,
    branch
  })

  return result
}