import User from "../models/User.model.js";

export const isLogin = (req, res, next) => {
  if (!req.session?.user) {
    if (_isAjax(req)) {
      return res.status(401).json({ message: "Please login to continue." });
    }
    req.session.returnTo = req.originalUrl;
    return res.redirect("/auth/login");
  }

  return next();
};

export const isLogout = (req, res, next) => {
  if (!req.session?.user) return next();
  
  if (!res.locals.user || res.locals.user.isBlocked) return next();

  return res.redirect("/");
};

export const checkBlocked = async (req, res, next) => {
  if (!req.session?.user) return next();

  try {
    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId).select("isBlocked").lean();

    if (!user || user.isBlocked) {
      return req.session.destroy(() => {
        if (_isAjax(req)) {
          return res.status(403).json({ message: "Your account has been blocked." });
        }
        res.clearCookie("user.sid");
        return res.redirect("/auth/login?blocked=true");
      });
    }

    return next();
  } catch (err) {
    console.error("checkBlocked middleware error:", err);
    return next();
  }
};



function _isAjax(req) {
  return (
    req.xhr ||req.headers.accept?.includes("application/json") || req.headers["content-type"]?.includes("application/json")
  );
}
