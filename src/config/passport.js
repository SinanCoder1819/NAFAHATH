import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.model.js"; // Path ningalude model-inu anusarithamaakkuka

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
            if (!user.googleId) {
                user.googleId = profile.id;
                await user.save();
            }
            return done(null, user);
        } else {
            const newUser = await User.create({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                isVerified: true
            });
            return done(null, newUser);
        }
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});