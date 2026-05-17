export const notFound = (req, res, next) => {
    res.status(404).render('user/404', { title: '404 - Not Found' });
};