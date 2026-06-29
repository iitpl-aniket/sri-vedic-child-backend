import db from "../config/db.js";

const checkServiceLimit = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // ✅ Koi bhi pooja complete ho — total count nikalo
      const [countRows] = await db.query(
        `SELECT COUNT(*) as total FROM puja_requests 
         WHERE user_id = ? AND status = 'completed'`,
        [userId]
      );

      const allowed = countRows[0].total;

      // ✅ Usage check karo
      const [usageRows] = await db.query(
        "SELECT id, used_count FROM user_service_usage WHERE user_id = ?",
        [userId]
      );

      const used = usageRows.length > 0 ? usageRows[0].used_count : 0;

      // ✅ Table update karo latest count ke sath
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

      // ✅ Block karo agar limit khatam
      if (used >= allowed) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          error: "Pehle ek pooja complete karo.",
        });
      }

      // ✅ Use count badhao
      await db.query(
        "UPDATE user_service_usage SET used_count = used_count + 1 WHERE user_id = ?",
        [userId]  // ✅ 
      );

      next();
    } catch (err) {
      console.error("Service limit check error:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  };
};

export default checkServiceLimit;