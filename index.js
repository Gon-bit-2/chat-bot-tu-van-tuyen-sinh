import express from "express";
import cors from "cors";
import "dotenv/config";
import router from "./router/index.js";
import connectDB from "./config/database.js";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/", router);
connectDB();
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
