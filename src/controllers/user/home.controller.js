import User from "../../models/User.model.js";

export const getHomePage = (req, res) => {
    res.render("user/home");
};
