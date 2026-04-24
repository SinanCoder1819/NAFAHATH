import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressEjsLayouts from "express-ejs-layouts";
import pinoHttp from "pino-http"; // ✅ ADD THIS
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js";
import { sessionMiddleware } from "./config/session.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// // ✅ 🔥 Logging middleware (PLACE HERE)
// app.use(
//   pinoHttp({
//     level: "info",
//   })
// );

// ✅ Session
app.use(sessionMiddleware);

// ✅ Locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ✅ View engine
app.use(expressEjsLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/user");

// ✅ Routes
app.use("/", userRoutes);
app.use("/auth", authRoutes);

export default app;