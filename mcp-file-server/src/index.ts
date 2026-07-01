import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Octokit } from '@octokit/rest'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const tools = [
  {
    name: 'get_file_contents',
    description: 'Get the contents of a single file from a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string', description: 'File path e.g. src/index.ts' },
        branch: { type: 'string', description: 'Branch name, defaults to main' }
      },
      required: ['owner', 'repo', 'path']
    }
  },
  {
    name: 'get_multiple_files',
    description: 'Get contents of multiple files at once',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        paths: { type: 'array', items: { type: 'string' } },
        branch: { type: 'string' }
      },
      required: ['owner', 'repo', 'paths']
    }
  }
]

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'mcp-file-server', version: '1.0.0', tools })
})

app.post('/tools/call', async (req: Request, res: Response) => {
  console.log('Request:', JSON.stringify(req.body))
  const { name, arguments: args } = req.body

  try {
    let result: string

    if (name === 'get_file_contents') {
      const { data } = await octokit.rest.repos.getContent({
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        ref: args.branch || 'main'
      })

      if ('content' in data && data.type === 'file') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        result = JSON.stringify({
          path: args.path,
          content,
          size: data.size,
          encoding: 'utf-8'
        })
      } else {
        result = JSON.stringify({ error: 'Path is not a file' })
      }

    } else if (name === 'get_multiple_files') {
      const paths: string[] = args.paths
      const limitedPaths = paths.slice(0, 10)

      const fileResults = await Promise.allSettled(
        limitedPaths.map(async (filePath) => {
          const { data } = await octokit.rest.repos.getContent({
            owner: args.owner,
            repo: args.repo,
            path: filePath,
            ref: args.branch || 'main'
          })

          if ('content' in data && data.type === 'file') {
            return {
              path: filePath,
              content: Buffer.from(data.content, 'base64').toString('utf-8'),
              size: data.size
            }
          }
          return { path: filePath, content: '', size: 0 }
        })
      )

      const files = fileResults
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value)

      result = JSON.stringify({ files, totalFetched: files.length })

    } else {
      return res.status(404).json({ error: `Unknown tool: ${name}` })
    }

    res.json({ content: [{ type: 'text', text: result }] })

  } catch (err: any) {
    console.error('Error:', err.message)
    res.status(500).json({
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`MCP File Server running → http://localhost:${PORT}`)
})