import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressEjsLayouts from "express-ejs-layouts";
import authRoutes  from "./routes/auth.routes.js";
import userRoutes  from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { userSessionMiddleware, adminSessionMiddleware } from "./config/session.js";
import passport from "passport";
import "./config/passport.js";
import User from "./models/User.model.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Separate sessions per domain ──────────────────────────────────────────
// Admin routes: admin.sid cookie  →  admin_sessions collection.
// User / auth routes: user.sid cookie  →  user_sessions collection.
//
// IMPORTANT: app.use("/", ...) matches ALL paths including /admin, so
// we MUST mount the user session ONLY on non-admin paths to prevent
// session bleed where both middlewares run on the same admin request.

app.use("/admin", adminSessionMiddleware);

// Mount user session on /auth and everything that is NOT /admin
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) return next();
    return userSessionMiddleware(req, res, next);
});

// Passport: initialise globally but only restore session for non-admin routes.
// On admin routes Passport would try to deserialize req.user which is irrelevant
// and can silently overwrite req.session set by adminSessionMiddleware.
app.use(passport.initialize());
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) return next();
    return passport.session()(req, res, next);
});

// ── Global locals ─────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
    try {
        const isAdminRoute = req.path.startsWith("/admin");

        if (isAdminRoute) {
            // Admin routes: expose admin session to views, no user lookup
            res.locals.admin = req.session?.admin || null;
            res.locals.user  = null;
        } else {
            // User routes: expose user from DB for navbar/profile
            res.locals.admin = null;
            if (req.session?.user) {
                const userId = req.session.user.id || req.session.user._id;
                const dbUser = await User.findById(userId)
                    .select("name email profileImage isBlocked")
                    .lean();
                res.locals.user = dbUser || null;
            } else if (req.user) {
                res.locals.user = req.user;
            } else {
                res.locals.user = null;
            }
        }
    } catch (err) {
        console.error("Locals middleware error:", err);
        res.locals.user  = null;
        res.locals.admin = null;
    }
    next();
});

// ── View engine ───────────────────────────────────────────────────────────
app.use(expressEjsLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/user");

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/admin", adminRoutes);
app.use("/auth",  authRoutes);
app.use("/",      userRoutes);

export default app;

