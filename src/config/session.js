import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
dotenv.config();


export const userSessionMiddleware = session({
    name: "user.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "user_sessions",
        ttl: 8 * 60 * 60,      // 8 hours for user
    }),
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
    },
});


export const adminSessionMiddleware = session({
    name: "admin.sid",
    secret: process.env.SESSION_SECRET + "_admin",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "admin_sessions",
        ttl: 8 * 60 * 60,          // 8 hours for admin
    }),
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
    },
});


export const sessionMiddleware = userSessionMiddleware;
