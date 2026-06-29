import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// This server does pure static analysis — no external API calls
// Everything here is rule-based logic running in memory

const tools = [
  {
    name: 'detect_language',
    description: 'Detect programming language from file path and content',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'analyze_complexity',
    description: 'Analyze code complexity metrics',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'File content to analyze' },
        path: { type: 'string' }
      },
      required: ['content', 'path']
    }
  },
  {
    name: 'check_security_patterns',
    description: 'Check for common security vulnerabilities using pattern matching',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        path: { type: 'string' }
      },
      required: ['content', 'path']
    }
  }
]

// ── LANGUAGE DETECTION ──────────────────────────────────────────
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript',
    js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', java: 'Java',
    go: 'Go', rs: 'Rust',
    cpp: 'C++', c: 'C',
    cs: 'C#', php: 'PHP',
    rb: 'Ruby', swift: 'Swift',
    kt: 'Kotlin', vue: 'Vue',
    md: 'Markdown', json: 'JSON'
  }
  return map[ext || ''] || 'Unknown'
}

// ── COMPLEXITY ANALYSIS ──────────────────────────────────────────
// Cyclomatic complexity = number of decision points + 1
// Decision points: if, else if, for, while, switch case, &&, ||, ?, catch
// Higher = harder to test and maintain
// 1-10: simple, 11-20: moderate, 21+: complex

function analyzeComplexity(content: string, path: string) {
  const lines = content.split('\n')
  const totalLines = lines.length
  const emptyLines = lines.filter(l => l.trim() === '').length
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*')).length
  const codeLines = totalLines - emptyLines - commentLines

  // Count decision points for cyclomatic complexity
  const decisionPatterns = [
    /\bif\b/g, /\belse if\b/g, /\bfor\b/g,
    /\bwhile\b/g, /\bcase\b/g, /\bcatch\b/g,
    /&&/g, /\|\|/g, /\?/g
  ]

  let complexityScore = 1
  decisionPatterns.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) complexityScore += matches.length
  })

  // Find long functions (rough detection)
  const functionMatches = content.match(/function\s+\w+|=>\s*{|async\s+\w+/g)
  const functionCount = functionMatches?.length || 0

  // Average lines per function
  const avgLinesPerFunction = functionCount > 0
    ? Math.round(codeLines / functionCount)
    : codeLines

  return {
    totalLines,
    codeLines,
    emptyLines,
    commentLines,
    cyclomaticComplexity: complexityScore,
    functionCount,
    avgLinesPerFunction,
    language: detectLanguage(path),
    complexityRating:
      complexityScore <= 10 ? 'low' :
      complexityScore <= 20 ? 'moderate' : 'high'
  }
}

// ── SECURITY PATTERN CHECKS ──────────────────────────────────────
// Rule-based detection — catches ~80% of common issues without LLM
// The remaining 20% gets passed to Gemini in Agent 2

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  lineNumber?: number
}

function checkSecurityPatterns(content: string, path: string): SecurityIssue[] {
  const issues: SecurityIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()

    // Hardcoded secrets
    if (/password\s*=\s*['"][^'"]{3,}['"]/i.test(trimmed) ||
        /secret\s*=\s*['"][^'"]{3,}['"]/i.test(trimmed) ||
        /api_key\s*=\s*['"][^'"]{3,}['"]/i.test(trimmed)) {
      issues.push({
        severity: 'critical',
        category: 'security',
        title: 'Hardcoded secret detected',
        description: 'Credentials should never be hardcoded. Use environment variables.',
        lineNumber: lineNum
      })
    }

    // SQL injection risk
    if (/query\s*\(.*\+.*\)/i.test(trimmed) ||
        /execute\s*\(.*\$\{/i.test(trimmed)) {
      issues.push({
        severity: 'high',
        category: 'security',
        title: 'Possible SQL injection',
        description: 'String concatenation in SQL queries is dangerous. Use parameterized queries.',
        lineNumber: lineNum
      })
    }

    // eval() usage
    if (/\beval\s*\(/.test(trimmed)) {
      issues.push({
        severity: 'critical',
        category: 'security',
        title: 'eval() usage detected',
        description: 'eval() executes arbitrary code and is a major security risk.',
        lineNumber: lineNum
      })
    }

    // console.log in production code (not test files)
    if (/console\.log\(/.test(trimmed) && !path.includes('test') && !path.includes('spec')) {
      issues.push({
        severity: 'low',
        category: 'quality',
        title: 'console.log in production code',
        description: 'Remove console.log statements before deploying to production.',
        lineNumber: lineNum
      })
    }

    // TODO comments
    if (/\/\/\s*TODO/i.test(trimmed)) {
      issues.push({
        severity: 'low',
        category: 'quality',
        title: 'TODO comment found',
        description: 'Unresolved TODO comment indicates incomplete implementation.',
        lineNumber: lineNum
      })
    }

    // Dangerously set innerHTML
    if (/dangerouslySetInnerHTML/.test(trimmed)) {
      issues.push({
        severity: 'high',
        category: 'security',
        title: 'dangerouslySetInnerHTML usage',
        description: 'This can lead to XSS attacks if content is not sanitized.',
        lineNumber: lineNum
      })
    }
  })

  return issues
}

// ── ROUTES ───────────────────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'mcp-code-server', version: '1.0.0', tools })
})

app.post('/tools/call', async (req: Request, res: Response) => {
  console.log('Request:', req.body.name)
  const { name, arguments: args } = req.body

  try {
    let result: string

    if (name === 'detect_language') {
      const language = detectLanguage(args.path)
      result = JSON.stringify({ language, path: args.path })

    } else if (name === 'analyze_complexity') {
      const analysis = analyzeComplexity(args.content, args.path)
      result = JSON.stringify(analysis)

    } else if (name === 'check_security_patterns') {
      const issues = checkSecurityPatterns(args.content, args.path)
      result = JSON.stringify({
        issues,
        totalIssues: issues.length,
        criticalCount: issues.filter(i => i.severity === 'critical').length,
        highCount: issues.filter(i => i.severity === 'high').length
      })

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

const PORT = process.env.PORT || 3003
app.listen(PORT, () => {
  console.log(`MCP Code Server running → http://localhost:${PORT}`)
})