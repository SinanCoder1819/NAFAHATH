import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressEjsLayouts from "express-ejs-layouts"; 
import morgan from "morgan";

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

app.use(morgan('dev'))

app.use(express.json());                         
app.use(express.urlencoded({ extended: true })); 

app.use("/admin", adminSessionMiddleware);


app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) return next(); 
    return userSessionMiddleware(req, res, next);     
});


app.use(passport.initialize()); 

app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) return next(); // Skip Passport session restore for admin
    return passport.session()(req, res, next);         // Restore user from session for all other routes
});


app.use(async (req, res, next) => {
    try {
        const isAdminRoute = req.path.startsWith("/admin");

        if (isAdminRoute) {
            res.locals.admin = req.session?.admin || null;
            res.locals.user  = null;
        } else {
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


app.use(expressEjsLayouts);                              
app.set("view engine", "ejs");                           
app.set("views", path.join(__dirname, "views"));         
app.set("layout", "layouts/user");                     


app.use("/admin", adminRoutes); 
app.use("/auth",  authRoutes);  
app.use("/",      userRoutes);  


export default app;
