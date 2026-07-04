const isAdmin = (req, res, next) => {
  if (req.user !== "admin") {
    return res.status(403).send("Access denied: admin only");
  }
  next();
};
export default isAdmin;
