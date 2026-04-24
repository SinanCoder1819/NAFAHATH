export const getHomePage = (req, res) => {
  console.log(req?.session?.user);
  res.render("user/home", { 
    user: req.session.user || null 
  });
};