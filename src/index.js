import express from "express";
import "dotenv/config";

const app = express();
const port = process.env.PORT;

app.use("/", (req, res) => {
  res.send("Hello courier world welcome!!!");
});

app.listen(port || 4798, () => {
  console.log("Server running at port", port);
});
