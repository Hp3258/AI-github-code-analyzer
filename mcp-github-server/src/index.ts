import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Octokit } from '@octokit/rest'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const tools = [
  {
    name: 'get_repo_info',
    description: 'Get basic information about a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner username' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'get_file_tree',
    description: 'Get the complete file tree of a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        branch: { type: 'string', description: 'Branch name, defaults to main' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'get_commits',
    description: 'Get recent commits for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        limit: { type: 'number', description: 'Number of commits to fetch, max 30' }
      },
      required: ['owner', 'repo']
    }
  }
]

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'mcp-github-server',
    version: '1.0.0',
    tools
  })
})

app.post('/tools/call', async (req: Request, res: Response) => {
  console.log('=== Request received ===')
  console.log('Body:', JSON.stringify(req.body))

  const { name, arguments: args } = req.body

  try {
    let result: string

    if (name === 'get_repo_info') {
      console.log('Calling GitHub API...')
      const { data } = await octokit.rest.repos.get({
        owner: args.owner,
        repo: args.repo
      })

      result = JSON.stringify({
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        defaultBranch: data.default_branch,
        size: data.size,
        visibility: data.visibility
      })

    } else if (name === 'get_file_tree') {
      const branch = args.branch || 'main'

      const { data } = await octokit.rest.git.getTree({
        owner: args.owner,
        repo: args.repo,
        tree_sha: branch,
        recursive: '1'
      })

      const codeExtensions = [
        '.ts', '.tsx', '.js', '.jsx', '.py', '.java',
        '.go', '.rs', '.cpp', '.c', '.cs', '.php',
        '.rb', '.swift', '.kt', '.vue', '.json', '.md'
      ]

      const files = data.tree
        .filter(item =>
          item.type === 'blob' &&
          codeExtensions.some(ext => item.path?.endsWith(ext))
        )
        .map(item => ({
          path: item.path,
          size: item.size
        }))

      result = JSON.stringify({ files, totalFiles: files.length })

    } else if (name === 'get_commits') {
      const limit = Math.min(args.limit || 10, 30)

      const { data } = await octokit.rest.repos.listCommits({
        owner: args.owner,
        repo: args.repo,
        per_page: limit
      })

      const commits = data.map(commit => ({
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author?.name,
        date: commit.commit.author?.date
      }))

      result = JSON.stringify({ commits })

    } else {
      return res.status(404).json({ error: `Unknown tool: ${name}` })
    }

    res.json({
      content: [{ type: 'text', text: result }]
    })

  } catch (err: any) {
    console.error('=== Tool error ===')
    console.error('Message:', err.message)
    console.error('Status:', err.status)
    res.status(500).json({
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`MCP GitHub Server running → http://localhost:${PORT}`)
})