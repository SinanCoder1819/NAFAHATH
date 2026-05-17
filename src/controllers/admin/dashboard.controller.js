/**
 * GET /admin/dashboard
 */
export const getDashboard = (req, res) => {
    res.render("admin/dashboard", {
        layout: "layouts/admin",
        admin: req.session.admin,
        activePage: "dashboard",
    });
};
