import { Router, Request, Response } from 'express'
import passport from 'passport'

export const authRouter = Router()

authRouter.get('/github', passport.authenticate('github'))

authRouter.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/?error=auth_failed`,
  }),
  (_req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`)
  }
)

authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const { accessToken, ...safeUser } = req.user as any
  res.json(safeUser)
})

authRouter.post('/logout', (req: Request, res: Response) => {
  req.logout(() => {
    res.json({ success: true })
  })
})