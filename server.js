import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pool from "./config/db.js";
import nameCorrectionRouter from "./controllers/nameCorrectionController.js";
import standalonePaymentRouter from "./routes/standalonePaymentRouter.js";
import kundliRouter from "./routes/kundliRouter.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5053);
const mainBackendUrl = (process.env.MAIN_BACKEND_URL || "http://localhost:5052").replace(/\/$/, "");
const defaultOrigins = [
  "https://srivedicpuja-child-frontend.vercel.app",
  "https://srivedicpuja.com",
  "https://www.srivedicpuja.com",
  "http://localhost:3000",
  "http://localhost:3001",
];
const allowedOrigins = Array.from(
  new Set(
    (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat(defaultOrigins),
  ),
);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
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
app.use("/api/payments", standalonePaymentRouter);
app.use("/api/kundli", kundliRouter);
app.use("/api/name", nameCorrectionRouter);

async function startServer() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS standalone_name_correction_access (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      dob DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 499.00,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      razorpay_order_id VARCHAR(255) NOT NULL UNIQUE,
      razorpay_payment_id VARCHAR(255) DEFAULT NULL,
      razorpay_signature VARCHAR(255) DEFAULT NULL,
      used_count INT NOT NULL DEFAULT 0,
      paid_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  app.listen(port, () => {
    console.log(`kundli-srivedicpuja-backend listening on ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Child backend startup failed:", error);
  process.exit(1);
});
