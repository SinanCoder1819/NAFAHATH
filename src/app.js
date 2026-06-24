import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressEjsLayouts from "express-ejs-layouts"; 
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes  from "./routes/auth.routes.js";
import userRoutes  from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";

import { userSessionMiddleware, adminSessionMiddleware } from "./config/session.js";

import passport from "passport";
import "./config/passport.js";

import { setLocalsMiddleware } from "./middlewares/locals.middleware.js"; 


const app = express();



const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);        

app.use(morgan('dev'))
app.use(cookieParser());

app.use(express.json());                         
app.use(express.urlencoded({ extended: true })); 


app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) {
        return adminSessionMiddleware(req, res, next);
    }
    return userSessionMiddleware(req, res, next);
});

app.use(passport.initialize());

app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) return next();
    return passport.session()(req, res, next);
});


app.use(setLocalsMiddleware);


app.use(expressEjsLayouts);                              
app.set("view engine", "ejs");                           
app.set("views", path.join(__dirname, "views"));         
app.set("layout", "layouts/user");                     


app.use("/admin", adminRoutes); 
app.use("/auth",  authRoutes);  
app.use("/", userRoutes);


export default app;
