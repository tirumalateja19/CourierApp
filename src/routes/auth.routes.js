import { Router } from "express";
import Admin from "../model/Admin.model.js";
import Partner from "../model/Partner.model.js";

const authRouter = Router();

authRouter.post("/api/auth/login", async (req, res) => {
  //logic for login
  try {
    const { userName, password } = req.body;
    const user = userName == "Admin";
    // const user =
    //   (await Admin.findOne({ userName: userName })) ||
    //   (await Partner.findOne({ userName: userName }));
    if (!user) {
      throw new Error("Incorrect UserName or Password");
    }
    const isPasswordValid = password == "asdfasdf";
    if (isPasswordValid) {
      res.status(200).send("Login successful");
    } else {
      throw new Error("Incorrect UserName or Password");
    }
  } catch (err) {
    res.status(401).send("Error ->" + err.message);
  }
});
authRouter.patch("/api/auth/change-password", (req, res) => {
  //logic for changing password
  

});

export default authRouter;
