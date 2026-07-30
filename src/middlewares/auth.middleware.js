import User from "../models/User.model.js";


export const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};


export const isLogin = async (req, res, next) => {
  if (!req.session?.user) {
    if (_isAjax(req)) {
      return res.status(401).json({ message: "Please login to continue." });
    }
    req.session.returnTo = req.originalUrl;
    return res.redirect("/auth/login");
  }


  try {
    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId).select("isBlocked").lean();

    if (!user) {
      return req.session.destroy(() => {
        res.clearCookie("user.sid");
        if (_isAjax(req)) {
          return res.status(401).json({ message: "Account not found. Please login again." });
        }
        return res.redirect("/auth/login");
      });
    }

    if (user.isBlocked) {
     return req.session.destroy(() => {
        res.clearCookie("user.sid");
        if (_isAjax(req)) {
          return res.status(403).json({ message: "Your account has been blocked." });
        }
        return res.redirect("/auth/login?blocked=true");
      });
    }

  
    return next();
  } catch (err) {
    console.error("isLogin middleware error:", err);
    if (_isAjax(req)) return res.status(500).json({ message: "Server error." });
    return res.redirect("/auth/login");
  }
};


export const isLogout = async (req, res, next) => {
  if (!req.session?.user) return next();

  try {
    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId).select("isBlocked").lean();

    if (!user || user.isBlocked) {
      return req.session.destroy(() => {
        res.clearCookie("user.sid");
        return res.redirect('/login');
      });
    }

   return res.redirect("/");
   
  } catch (err) {
    console.error("isLogout middleware error:", err);
    return next(); 
  }
};


export const isAdminLogout = async (req, res, next) => {
  if (!req.session?.admin) return next();

  try {
    const admin = await User.findById(req.session.admin.id)
      .select("role isBlocked")
      .lean();

    if (!admin || admin.role !== "admin" || admin.isBlocked) {
      return req.session.destroy(() => {
        res.clearCookie("admin.sid");
        return next();
      });
    }

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("isAdminLogout middleware error:", err);
    return next();
  }
};


function _isAjax(req) {
  return (
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.headers["content-type"]?.includes("application/json")
  );
}





