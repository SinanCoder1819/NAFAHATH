import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
dotenv.config();

// ── User session ──────────────────────────────────────────────────────────
// Cookie: user.sid  |  Collection: user_sessions
export const userSessionMiddleware = session({
    name:              "user.sid",
    secret:            process.env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl:       process.env.MONGO_URI,
        collectionName: "user_sessions",
        ttl:            24 * 60 * 60,
    }),
    cookie: {
        httpOnly: true,
        secure:   false,
        maxAge:   24 * 60 * 60 * 1000,
    },
});

// ── Admin session ─────────────────────────────────────────────────────────
// Cookie: admin.sid  |  Collection: admin_sessions
export const adminSessionMiddleware = session({
    name:              "admin.sid",
    secret:            process.env.SESSION_SECRET + "_admin",
    resave:            false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl:       process.env.MONGO_URI,
        collectionName: "admin_sessions",
        ttl:            8 * 60 * 60,          // 8 hours for admin
    }),
    cookie: {
        httpOnly: true,
        secure:   false,
        maxAge:   8 * 60 * 60 * 1000,
    },
});

// Keep backward-compat export so nothing else breaks if imported as sessionMiddleware
export const sessionMiddleware = userSessionMiddleware;
