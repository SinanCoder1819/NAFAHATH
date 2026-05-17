import User from '../models/User.model.js';

/**
 * isLogin — protect routes that require a valid, non-blocked session.
 */
export const isLogin = async (req, res, next) => {
    if (!req.session?.user) {
        if (_isAjax(req)) {
            return res.status(401).json({ message: 'Please log in to continue.' });
        }
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    try {
        const userId = req.session.user.id || req.session.user._id;
        const user   = await User.findById(userId).select('isBlocked').lean();

        if (!user) {
            return req.session.destroy(() => res.redirect('/auth/login'));
        }

        if (user.isBlocked) {
            return req.session.destroy(() => {
                if (_isAjax(req)) {
                    return res.status(403).json({ message: 'Your account has been blocked.' });
                }
                return res.redirect('/auth/login?blocked=true');
            });
        }

        return next();
    } catch (err) {
        console.error('isLogin error:', err);
        return res.redirect('/auth/login');
    }
};

/**
 * isLogout — redirect active non-blocked users away from auth pages.
 * Uses res.locals.user (set by app.js from DB) so we know if they're blocked.
 * Blocked users: session exists but res.locals.user is null → let them through.
 */
export const isLogout = (req, res, next) => {
    // No session at all → allow
    if (!req.session?.user) return next();

    // Session exists but DB says user is blocked/deleted (res.locals.user is null)
    // → let them reach the login page so they see the blocked message
    if (!res.locals.user || res.locals.user.isBlocked) return next();

    // Valid active session → redirect to home
    return res.redirect('/');
};

function _isAjax(req) {
    return req.xhr
        || req.headers.accept?.includes('application/json')
        || req.headers['content-type']?.includes('application/json');
}
