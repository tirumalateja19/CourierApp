import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";
import partnerRouter from "./routes/partner.routes.js";
import jobRouter from "./routes/job.routes.js";
import pickupRouter from "./routes/pickup.routes.js";
import "./workers/pdfWorker.js"; // just importing starts it listening
import shipmentRouter from "./routes/shipment.routes.js";
const app = express();
const PORT = process.env.PORT;

app.use(cookieParser());
app.use(express.json());

app.use("/", authRouter);
app.use("/", adminRouter);
app.use("/", partnerRouter);
app.use("/", jobRouter);
app.use("/", pickupRouter);
app.use("/", shipmentRouter);

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
