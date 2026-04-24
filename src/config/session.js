import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";

dotenv.config();

export const sessionMiddleware = session({
  name: "auth.sid",

  secret: process.env.SESSION_SECRET,

  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60,
  }),

  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  },
});