import express from "express";
import "dotenv/config";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.routes.js";

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use("/", authRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something Went Wrong");
});

connectDB()
  .then(() => {
    console.log("Database Connection established successfully...");
    app.listen(PORT, () => {
      console.log("Server is successfully running at port:", PORT);
    });
  })
  .catch((err) => {
    console.log("Database connection failed!!", err.message);
  });
