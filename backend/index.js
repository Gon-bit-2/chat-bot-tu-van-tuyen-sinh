import express from "express";
import cors from "cors";
import "dotenv/config";
import router from "./src/router/index.js";
import database from "./src/config/database.js";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/", router);
database.connectDB();
const PORT = process.env.PORT || 4321;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
