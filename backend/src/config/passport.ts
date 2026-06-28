import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import { prisma } from '../lib/prisma'

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
      scope: ['user:email', 'repo'],
    },
    async (accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const user = await prisma.user.upsert({
          where: { githubId: profile.id },
          update: {
            username: profile.username ?? '',
            avatarUrl: profile.photos?.[0]?.value ?? null,
            accessToken,
          },
          create: {
            githubId: profile.id,
            username: profile.username ?? '',
            avatarUrl: profile.photos?.[0]?.value ?? null,
            email: profile.emails?.[0]?.value ?? null,
            accessToken,
          },
        })
        return done(null, user)
      } catch (err) {
        return done(err)
      }
    }
  )
)

passport.serializeUser((user: any, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    done(null, user)
  } catch (err) {
    done(err)
  }
})