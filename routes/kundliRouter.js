// routes/kundliRouter.js
import express from 'express';
import { generateKundli } from '../controllers/kundliController.js';
import { analyzeWithGPT  } from '../controllers/gptServiceController.js';

import pool from '../config/db.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const {
      name, mobile, dateOfBirth, timeOfBirth, placeOfBirth, gender,
      latitude, longitude, timezoneOffset
    } = req.body;

    if (!name || !mobile || !dateOfBirth || !timeOfBirth || !placeOfBirth || !gender)
      return res.status(400).json({ success:false, error:'All fields are mandatory, including mobile number.' });

    const lat = latitude   ?? 20.5937;
    const lon = longitude  ?? 78.9629;
    const tz  = timezoneOffset ?? 5.5;

    // Store the request in DB
    try {
      await pool.query(
        `INSERT INTO kundli_requests (name, mobile, gender, dob, tob, pob, latitude, longitude, timezone_offset) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, mobile, gender, dateOfBirth, timeOfBirth, placeOfBirth, lat, lon, tz]
      );
    } catch (dbErr) {
      console.error('⚠️ DB Log Error (Kundli):', dbErr.message);
      // We continue even if DB logging fails, to not block the user.
    }

    console.log(`\n📍 ${placeOfBirth} | Mobile:${mobile} | Lat:${lat} Lon:${lon} TZ:${tz}`);

    // generateKundli is async (Swiss Ephemeris)
    const kundliData = await generateKundli(name, dateOfBirth, timeOfBirth, placeOfBirth, gender, tz, lat, lon);
    const gptResult  = await analyzeWithGPT(kundliData);

    return res.json({
      success     : true,
      kundli      : kundliData,
      analysis    : gptResult.sections,
      rawAnalysis : gptResult.rawAnalysis,
      meta        : {
        model       : gptResult.model,
        tokensUsed  : gptResult.tokensUsed,
        generatedAt : new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ Kundli Error:', err.message);
    return res.status(500).json({ success:false, error: err.message });
  }
});

export default router;