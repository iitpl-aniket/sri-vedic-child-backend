import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pool from "./config/db.js";
import kundliRouter from "./routes/kundliRouter.js";
import nameCorrectionRouter from "./controllers/nameCorrectionController.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5053);
const mainBackendUrl = (process.env.MAIN_BACKEND_URL || "http://localhost:5052").replace(/\/$/, "");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

function buildHeaders(req) {
  const headers = {};
  const auth = req.headers.authorization;
  if (auth) {
    headers.authorization = auth;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    headers["content-type"] = "application/json";
  }
  return headers;
}

async function forward(req, res, targetPath) {
  try {
    const response = await fetch(`${mainBackendUrl}${targetPath}`, {
      method: req.method,
      headers: buildHeaders(req),
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
    });

    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";
    const text = await response.text();
    res.status(response.status);
    res.setHeader("content-type", contentType);
    res.send(text);
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Proxy request failed",
    });
  }
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, service: "kundli-backend", mainBackendUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "DB check failed" });
  }
});

app.get("/api/user/get-profile", (req, res) => forward(req, res, "/api/user/get-profile"));
app.get("/api/puja/allServices", (req, res) => forward(req, res, "/api/puja/allServices"));
app.use("/api/kundli", kundliRouter);
app.use("/api/name", nameCorrectionRouter);

app.listen(port, () => {
  console.log(`kundli-srivedicpuja-backend listening on ${port}`);
});
