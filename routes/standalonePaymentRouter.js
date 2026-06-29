import express from "express";
import { createOrder, verifyPayment, getOrderStatus } from "../controllers/standalonePaymentController.js";

const router = express.Router();

router.post("/standalone/create-order", createOrder);
router.post("/standalone/verify", verifyPayment);
router.get("/standalone/order-status/:orderId", getOrderStatus);

export default router;
