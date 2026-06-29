import db from "../config/db.js";

const checkServiceLimit = () => {
  return async (req, res, next) => {
    try {
      if (req.user?.role === "standalone_paid" && req.user?.accessId) {
        const [accessRows] = await db.query(
          `SELECT id, used_count, status
           FROM standalone_name_correction_access
           WHERE id = ?
           LIMIT 1`,
          [req.user.accessId],
        );

        const access = accessRows[0];

        if (!access || access.status !== "paid") {
          return res.status(403).json({
            success: false,
            error: "Standalone access is not active.",
          });
        }

        if (access.used_count >= 1) {
          return res.status(403).json({
            success: false,
            limitReached: true,
            error: "Standalone access already used. Please purchase again.",
          });
        }

        await db.query(
          `UPDATE standalone_name_correction_access
           SET used_count = used_count + 1
           WHERE id = ?`,
          [req.user.accessId],
        );

        return next();
      }

      const userId = req.user.id;

      const [countRows] = await db.query(
        `SELECT COUNT(*) as total FROM puja_requests 
         WHERE user_id = ? AND status = 'completed'`,
        [userId]
      );

      const allowed = countRows[0].total;

      const [usageRows] = await db.query(
        "SELECT id, used_count FROM user_service_usage WHERE user_id = ?",
        [userId]
      );

      const used = usageRows.length > 0 ? usageRows[0].used_count : 0;

      if (usageRows.length === 0) {
        await db.query(
          "INSERT INTO user_service_usage (user_id, used_count, allowed_count) VALUES (?, 0, ?)",
          [userId, allowed]
        );
      } else {
        await db.query(
          "UPDATE user_service_usage SET allowed_count = ? WHERE id = ?",
          [allowed, usageRows[0].id]
        );
      }

      if (used >= allowed) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          error: "Pehle ek pooja complete karo.",
        });
      }

      await db.query(
        "UPDATE user_service_usage SET used_count = used_count + 1 WHERE user_id = ?",
        [userId]
      );

      next();
    } catch (err) {
      console.error("Service limit check error:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  };
};

export default checkServiceLimit;
