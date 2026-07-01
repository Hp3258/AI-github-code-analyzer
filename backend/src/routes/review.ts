import { Router, Request, Response } from 'express'
import { runReview } from '../agents/workflow'
import { prisma } from '../lib/prisma'

export const reviewRouter = Router()

reviewRouter.post('/start', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const { repoUrl } = req.body
  const user = req.user as any

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/) ||
                repoUrl.match(/^([^/]+)\/([^/]+)$/)

  if (!match) {
    return res.status(400).json({ error: 'Invalid GitHub repo URL' })
  }

  const owner = match[1]
  const repo = match[2].replace('.git', '')

  try {
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        githubUrl: repoUrl,
        owner,
        repoName: repo
      }
    })

    const review = await prisma.review.create({
      data: {
        repoId: repository.id,
        userId: user.id,
        status: 'running'
      }
    })

    runReview(owner, repo).then(async (result) => {
      await prisma.reviewIssue.createMany({
        data: [
          ...result.securityIssues.map((issue: any) => ({
            reviewId: review.id,
            filePath: issue.filePath,
            lineNumber: issue.lineNumber ?? null,
            severity: issue.severity,
            category: issue.category,
            title: issue.title,
            description: issue.description ?? null
          })),
          ...result.qualityIssues.map((issue: any) => ({
            reviewId: review.id,
            filePath: issue.filePath,
            lineNumber: issue.lineNumber ?? null,
            severity: issue.severity,
            category: issue.category,
            title: issue.title,
            description: issue.description ?? null
          }))
        ]
      })

      await prisma.review.update({
        where: { id: review.id },
        data: {
          status: 'completed',
          qualityScore: result.qualityScore,
          summary: result.summary,
          completedAt: new Date()
        }
      })

    }).catch(async (err) => {
      await prisma.review.update({
        where: { id: review.id },
        data: { status: 'failed', errorMessage: err.message }
      })
    })

    res.json({ reviewId: review.id, status: 'running' })

  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

reviewRouter.get('/:id', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: { issues: true, repository: true }
  })

  if (!review) {
    return res.status(404).json({ error: 'Review not found' })
  }

  res.json(review)
})

reviewRouter.get('/', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = req.user as any
  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    include: { repository: true },
    orderBy: { createdAt: 'desc' }
  })

  res.json(reviews)
})