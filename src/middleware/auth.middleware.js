import jwt from "jsonwebtoken";

const userAuth = (req, res, next) => {
  try {
    const { token } = req.cookies;
    if (!token) {
      return res.status(401).send("Please login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
    
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).send("Session expired, please login again");
    }
    return res.status(401).send("Invalid token");
  }
};

export default userAuth;
