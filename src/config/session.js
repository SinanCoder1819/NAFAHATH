import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
dotenv.config();

const IS_PROD = process.env.NODE_ENV === "production";


export const userSessionMiddleware = session({
    name: "user.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "user_sessions",
        ttl: 24 * 60 * 60,             // 24 hours (seconds)
    }),
    cookie: {
        httpOnly: true,                
        secure: IS_PROD,               
        sameSite: "lax",               
        maxAge: 24 * 60 * 60 * 1000,  // 24 hours (ms)
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
        ttl: 8 * 60 * 60,              // 8 hours (seconds)
    }),
    cookie: {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,   // 8 hours (ms)
    },
});
