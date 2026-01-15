const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./database');

module.exports = function(passport) {
  // Only configure Google OAuth if credentials are provided
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!googleClientId || !googleClientSecret) {
    console.log('⚠️  Google OAuth disabled (credentials not configured)');
    // Still need to configure serialize/deserialize
    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
    return;
  }
  
  console.log('✅ Google OAuth enabled');
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
          });

          if (user) {
            return done(null, user);
          }

          // Check if email already exists
          const existingEmail = await prisma.user.findUnique({
            where: { email: profile.emails[0].value }
          });

          if (existingEmail) {
            // Link Google account to existing user
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: { googleId: profile.id }
            });
            return done(null, user);
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails[0].value,
              username: profile.displayName || profile.emails[0].value.split('@')[0],
              avatar: profile.photos[0]?.value || null
            }
          });

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
