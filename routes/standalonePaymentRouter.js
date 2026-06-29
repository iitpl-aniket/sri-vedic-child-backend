import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import db from "../config/db.js";

const router = express.Router();
const STANDALONE_AMOUNT = 1;
const STANDALONE_ROLE = "standalone_paid";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function buildAccessToken(accessId) {
  return jwt.sign(
    { accessId, role: STANDALONE_ROLE },
    process.env.JWT_SECRET || "supersecretkey",
    { expiresIn: "30d" },
  );
}

router.post("/standalone/create-order", async (req, res) => {
  try {
    const { name, dob } = req.body ?? {};

    if (!name || typeof name !== "string" || name.trim().length < 2 || !dob) {
      return res.status(400).json({ success: false, error: "Name and dob are required." });
    }

    const order = await razorpay.orders.create({
      amount: STANDALONE_AMOUNT * 100,
      currency: "INR",
      receipt: `standalone_${Date.now()}`,
      payment_capture: 1,
      notes: {
        product: "name-correction-standalone",
        name: name.trim(),
        dob,
      },
    });

    await db.execute(
      `INSERT INTO standalone_name_correction_access
        (name, dob, amount, status, razorpay_order_id)
       VALUES (?, ?, ?, 'pending', ?)`,
      [name.trim(), dob, STANDALONE_AMOUNT, order.id],
    );

    return res.json({ success: true, order });
  } catch (error) {
    console.error("Standalone order error:", error);
    return res.status(500).json({ success: false, error: "Could not create order" });
  }
});

router.post("/standalone/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Payment verification fields are required." });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Invalid payment signature." });
    }

    const [rows] = await db.execute(
      `SELECT id, status FROM standalone_name_correction_access WHERE razorpay_order_id = ? LIMIT 1`,
      [razorpay_order_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Payment record not found." });
    }

    const access = rows[0];

    if (access.status !== "paid") {
      await db.execute(
        `UPDATE standalone_name_correction_access
         SET status = 'paid',
             razorpay_payment_id = ?,
             razorpay_signature = ?,
             paid_at = NOW()
         WHERE id = ?`,
        [razorpay_payment_id, razorpay_signature, access.id],
      );
    }

    return res.json({
      success: true,
      accessToken: buildAccessToken(access.id),
    });
  } catch (error) {
    console.error("Standalone verify error:", error);
    return res.status(500).json({ success: false, error: "Could not verify payment" });
  }
});

// Polled by frontend every 5s after QR/UPI payment — handler callback never fires for async payments
router.get("/standalone/order-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const [rows] = await db.execute(
      `SELECT id, status, razorpay_payment_id, razorpay_signature
       FROM standalone_name_correction_access
       WHERE razorpay_order_id = ? LIMIT 1`,
      [orderId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    const record = rows[0];

    // Already verified and paid — return cached payment details
    if (record.status === "paid" && record.razorpay_payment_id) {
      return res.json({
        success: true,
        paid: true,
        razorpay_payment_id: record.razorpay_payment_id,
        razorpay_signature: record.razorpay_signature,
      });
    }

    // Check Razorpay for payments on this order
    const payments = await razorpay.orders.fetchPayments(orderId);
    let captured = payments.items?.find((p) => p.status === "captured");

    // For orders without payment_capture:1, payment lands in 'authorized' — capture it now
    if (!captured) {
      const authorized = payments.items?.find((p) => p.status === "authorized");
      if (!authorized) {
        return res.json({ success: true, paid: false });
      }
      try {
        await razorpay.payments.capture(authorized.id, authorized.amount, authorized.currency);
        captured = { ...authorized, status: "captured" };
      } catch (captureErr) {
        // Already captured or failed — re-fetch
        const refetch = await razorpay.payments.fetch(authorized.id);
        if (refetch.status === "captured") {
          captured = refetch;
        } else {
          return res.json({ success: true, paid: false });
        }
      }
    }

    // Build and store the signature so the verify endpoint accepts it
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${captured.id}`)
      .digest("hex");

    await db.execute(
      `UPDATE standalone_name_correction_access
       SET status = 'paid',
           razorpay_payment_id = ?,
           razorpay_signature = ?,
           paid_at = NOW()
       WHERE razorpay_order_id = ? AND status != 'paid'`,
      [captured.id, signature, orderId],
    );

    return res.json({
      success: true,
      paid: true,
      razorpay_payment_id: captured.id,
      razorpay_signature: signature,
    });
  } catch (error) {
    console.error("Order status check error:", error);
    return res.status(500).json({ success: false, error: "Could not check order status" });
  }
});

export default router;
