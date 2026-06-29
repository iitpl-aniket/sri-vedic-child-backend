// ═══════════════════════════════════════════════════════════════
// NAME CORRECTION — Backend Route (Gemini Primary + Groq Backup)
// File: routes/nameCorrection.js
//
// Mount in server.js:
//   import nameCorrectionRouter from './routes/nameCorrection.js';
//   app.use('/api/name', nameCorrectionRouter);
//
// Endpoint: POST /api/name/analyze
// ═══════════════════════════════════════════════════════════════

import express from "express";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../config/db.js";
import checkServiceLimit from "../middleware/checkServiceLimit.js"
import {verifyToken} from "../middleware/auth.js";
const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Chaldean Map ──────────────────────────────────────────────
const CHALDEAN = {
  A: 1,
  I: 1,
  J: 1,
  Q: 1,
  Y: 1,
  B: 2,
  K: 2,
  R: 2,
  C: 3,
  G: 3,
  L: 3,
  S: 3,
  D: 4,
  M: 4,
  T: 4,
  E: 5,
  H: 5,
  N: 5,
  X: 5,
  U: 6,
  V: 6,
  W: 6,
  O: 7,
  Z: 7,
  F: 8,
  P: 8,
};

// ── Pythagorean Map ───────────────────────────────────────────
const PYTHAGOREAN = {
  A: 1,
  J: 1,
  S: 1,
  B: 2,
  K: 2,
  T: 2,
  C: 3,
  L: 3,
  U: 3,
  D: 4,
  M: 4,
  V: 4,
  E: 5,
  N: 5,
  W: 5,
  F: 6,
  O: 6,
  X: 6,
  G: 7,
  P: 7,
  Y: 7,
  H: 8,
  Q: 8,
  Z: 8,
  I: 9,
  R: 9,
};

// ── Compound Number Meanings ──────────────────────────────────
const COMPOUND_MEANINGS = {
  10: {
    meaning: "Wheel of Fortune — rise through own efforts",
    strength: "Strong",
    category: "Fortune",
  },
  11: {
    meaning: "Master Number — spiritual awareness, intuition",
    strength: "Master",
    category: "Spiritual",
  },
  12: {
    meaning: "Sacrifice — victim of others plans",
    strength: "Weak",
    category: "Caution",
  },
  13: {
    meaning: "Change — hard work, build on ruins",
    strength: "Moderate",
    category: "Caution",
  },
  14: {
    meaning: "Movement — risk through nature/elements",
    strength: "Moderate",
    category: "Caution",
  },
  15: {
    meaning: "Magic — eloquence, personal magnetism",
    strength: "Strong",
    category: "Charm",
  },
  16: {
    meaning: "Unexpected danger — downfall through overconfidence",
    strength: "Weak",
    category: "Warning",
  },
  17: {
    meaning: "Star of the Magi — immortality, spiritual strength",
    strength: "Strong",
    category: "Spiritual",
  },
  18: {
    meaning: "Conflict — materialism vs spiritual",
    strength: "Moderate",
    category: "Conflict",
  },
  19: {
    meaning: "Prince of Heaven — success, happiness",
    strength: "VeryStrong",
    category: "Success",
  },
  20: {
    meaning: "Awakening — new purpose, new plans",
    strength: "Strong",
    category: "Growth",
  },
  21: {
    meaning: "Universe — advancement, honours",
    strength: "VeryStrong",
    category: "Success",
  },
  22: {
    meaning: "Master Builder — vision into reality",
    strength: "Master",
    category: "Leadership",
  },
  23: {
    meaning: "Royal Star of Lion — success, help from superiors",
    strength: "VeryStrong",
    category: "Wealth",
  },
  24: {
    meaning: "Love and money — fortunate in partnerships",
    strength: "Strong",
    category: "Wealth",
  },
  25: {
    meaning: "Strength through experience",
    strength: "Strong",
    category: "Wisdom",
  },
  26: {
    meaning: "Partnerships bring ruin — bad advice",
    strength: "Weak",
    category: "Warning",
  },
  27: {
    meaning: "Commander — authority, success in any field",
    strength: "VeryStrong",
    category: "Leadership",
  },
  28: {
    meaning: "Conflicts with superiors — power struggles",
    strength: "Moderate",
    category: "Conflict",
  },
  29: {
    meaning: "Uncertainties — trials and treachery",
    strength: "Weak",
    category: "Warning",
  },
  30: {
    meaning: "Meditation — detachment, literary success",
    strength: "Moderate",
    category: "Wisdom",
  },
  31: {
    meaning: "Solitude — self-contained, lonely path",
    strength: "Moderate",
    category: "Caution",
  },
  32: {
    meaning: "Magic of Uranus — mass appeal, communication",
    strength: "VeryStrong",
    category: "Fame",
  },
  33: {
    meaning: "Master Teacher — compassion, healing",
    strength: "Master",
    category: "Spiritual",
  },
  34: {
    meaning: "Determination — hard work leads to success",
    strength: "Strong",
    category: "Success",
  },
  35: {
    meaning: "Business acumen — intelligence in commerce",
    strength: "Strong",
    category: "Business",
  },
  36: {
    meaning: "Wisdom — philosophical nature",
    strength: "Strong",
    category: "Wisdom",
  },
  37: {
    meaning: "Fortunate love — harmony in partnerships",
    strength: "VeryStrong",
    category: "Wealth",
  },
  38: {
    meaning: "Quarrels — conflict with surroundings",
    strength: "Weak",
    category: "Caution",
  },
  39: {
    meaning: "Obstacles — must fight for everything",
    strength: "Moderate",
    category: "Conflict",
  },
  40: {
    meaning: "Unusual life — extraordinary events",
    strength: "Moderate",
    category: "Caution",
  },
  41: {
    meaning: "Authority — strong leadership power",
    strength: "VeryStrong",
    category: "Leadership",
  },
  42: {
    meaning: "New plans — but instability in old ones",
    strength: "Moderate",
    category: "Caution",
  },
  43: {
    meaning: "Failure — revolution followed by downfall",
    strength: "Weak",
    category: "Warning",
  },
  44: {
    meaning: "Power — ambition and execution",
    strength: "Strong",
    category: "Power",
  },
  45: {
    meaning: "Slow progress — philosophical detachment",
    strength: "Moderate",
    category: "Wisdom",
  },
  46: {
    meaning: "Financial growth — commercial success",
    strength: "VeryStrong",
    category: "Business",
  },
  47: {
    meaning: "Fortunate partnerships — rewards through others",
    strength: "Strong",
    category: "Wealth",
  },
  48: {
    meaning: "Slowness — obstacles in plans",
    strength: "Moderate",
    category: "Caution",
  },
  49: {
    meaning: "Troubles from unexpected sources",
    strength: "Weak",
    category: "Warning",
  },
  50: {
    meaning: "Final success — major achievement after struggle",
    strength: "VeryStrong",
    category: "Success",
  },
  51: {
    meaning: "Power of the sword — victories over enemies",
    strength: "Strong",
    category: "Power",
  },
  52: {
    meaning: "Revolution — struggle followed by success",
    strength: "Moderate",
    category: "Conflict",
  },
};

const POWERFUL_COMPOUNDS = new Set([
  10, 15, 17, 19, 20, 21, 23, 24, 25, 27, 32, 34, 35, 36, 37, 41, 44, 46, 47,
  50, 51,
]);

// ── Compatibility Matrix ──────────────────────────────────────
const COMPAT = {
  1: {
    1: 85,
    2: 70,
    3: 90,
    4: 75,
    5: 80,
    6: 65,
    7: 85,
    8: 80,
    9: 95,
    11: 80,
    22: 75,
  },
  2: {
    1: 70,
    2: 80,
    3: 65,
    4: 90,
    5: 70,
    6: 95,
    7: 75,
    8: 65,
    9: 85,
    11: 90,
    22: 80,
  },
  3: {
    1: 90,
    2: 65,
    3: 85,
    4: 60,
    5: 90,
    6: 80,
    7: 75,
    8: 70,
    9: 85,
    11: 75,
    22: 65,
  },
  4: {
    1: 75,
    2: 90,
    3: 60,
    4: 85,
    5: 65,
    6: 85,
    7: 70,
    8: 90,
    9: 70,
    11: 65,
    22: 95,
  },
  5: {
    1: 80,
    2: 70,
    3: 90,
    4: 65,
    5: 85,
    6: 75,
    7: 80,
    8: 70,
    9: 85,
    11: 80,
    22: 70,
  },
  6: {
    1: 65,
    2: 95,
    3: 80,
    4: 85,
    5: 75,
    6: 90,
    7: 70,
    8: 75,
    9: 90,
    11: 85,
    22: 80,
  },
  7: {
    1: 85,
    2: 75,
    3: 75,
    4: 70,
    5: 80,
    6: 70,
    7: 90,
    8: 65,
    9: 80,
    11: 95,
    22: 70,
  },
  8: {
    1: 80,
    2: 65,
    3: 70,
    4: 90,
    5: 70,
    6: 75,
    7: 65,
    8: 85,
    9: 75,
    11: 70,
    22: 90,
  },
  9: {
    1: 95,
    2: 85,
    3: 85,
    4: 70,
    5: 85,
    6: 90,
    7: 80,
    8: 75,
    9: 90,
    11: 85,
    22: 75,
  },
  11: {
    1: 80,
    2: 90,
    3: 75,
    4: 65,
    5: 80,
    6: 85,
    7: 95,
    8: 70,
    9: 85,
    11: 85,
    22: 80,
  },
  22: {
    1: 75,
    2: 80,
    3: 65,
    4: 95,
    5: 70,
    6: 80,
    7: 70,
    8: 90,
    9: 75,
    11: 80,
    22: 90,
  },
};

// ── Core helpers ──────────────────────────────────────────────
function reduceNumber(num) {
  while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
    num = String(num)
      .split("")
      .reduce((a, b) => a + parseInt(b), 0);
  }
  return num;
}

function calcTotal(name, map) {
  const cleaned = name.toUpperCase().replace(/[^A-Z]/g, "");
  let total = 0;
  const breakdown = [];
  for (const ch of cleaned) {
    const val = map[ch] || 0;
    total += val;
    breakdown.push({ letter: ch, value: val });
  }
  return { total, root: reduceNumber(total), breakdown };
}

function calcLifePath(dob) {
  const digits = dob.replace(/-/g, "");
  const total = digits.split("").reduce((a, b) => a + parseInt(b), 0);
  return { total, root: reduceNumber(total) };
}

function calcBirthNumber(dob) {
  const day = parseInt(dob.split("-")[2]);
  return reduceNumber(day);
}

function getCompatibility(a, b) {
  const row = COMPAT[a] || COMPAT[1];
  return row[b] || row[1] || 70;
}

function getCompoundMeaning(compound) {
  return (
    COMPOUND_MEANINGS[compound] || {
      meaning: `Compound ${compound} — unique karmic energy`,
      strength: "Moderate",
      category: "General",
    }
  );
}

// ── Math-based suggestion engine (fast pre-filter) ───────────
function mathSuggestions(name, birthNum, lifePathNum) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0].toUpperCase();
  const rest = parts.slice(1).join(" ");
  const suffix = rest ? " " + rest : "";
  const vowels = new Set(["A", "E", "I", "O", "U"]);

  const variations = new Set();

  ["A", "I", "E"].forEach((v) => variations.add(firstName + v + suffix));

  const last = firstName[firstName.length - 1];
  if (!vowels.has(last)) variations.add(firstName + last + suffix);

  firstName.endsWith("H")
    ? variations.add(firstName.slice(0, -1) + suffix)
    : variations.add(firstName + "H" + suffix);

  const elongMap = { A: "AA", E: "EE", I: "II", O: "OO", U: "UU" };
  for (let i = 0; i < firstName.length; i++) {
    if (elongMap[firstName[i]]) {
      const v =
        firstName.slice(0, i) +
        elongMap[firstName[i]] +
        firstName.slice(i + 1) +
        suffix;
      variations.add(v);
    }
  }

  const altVowel = { A: "E", E: "A", I: "Y", Y: "I", O: "U", U: "O" };
  for (let i = 0; i < firstName.length; i++) {
    if (altVowel[firstName[i]]) {
      const v =
        firstName.slice(0, i) +
        altVowel[firstName[i]] +
        firstName.slice(i + 1) +
        suffix;
      variations.add(v);
    }
  }

  for (let i = firstName.length - 2; i >= 1; i--) {
    if (!vowels.has(firstName[i]) && vowels.has(firstName[i - 1])) {
      ["A", "I"].forEach((v) => {
        const variant = firstName.slice(0, i) + v + firstName.slice(i) + suffix;
        variations.add(variant);
      });
      break;
    }
  }

  const phoneticMap = { C: "K", K: "C", S: "SH", V: "W", W: "V", SH: "S" };
  let phonetic = firstName;
  let changed = false;
  for (let i = 0; i < firstName.length; i++) {
    const two = firstName.slice(i, i + 2);
    if (phoneticMap[two]) {
      phonetic =
        firstName.slice(0, i) + phoneticMap[two] + firstName.slice(i + 2);
      changed = true;
      break;
    }
    if (phoneticMap[firstName[i]]) {
      phonetic =
        firstName.slice(0, i) +
        phoneticMap[firstName[i]] +
        firstName.slice(i + 1);
      changed = true;
      break;
    }
  }
  if (changed && phonetic !== firstName) variations.add(phonetic + suffix);

  for (let i = 1; i < firstName.length - 1; i++) {
    if (firstName[i] === firstName[i - 1]) {
      variations.add(firstName.slice(0, i) + firstName.slice(i + 1) + suffix);
    }
  }

  const results = [];
  for (const v of variations) {
    if (v.trim().toUpperCase() === name.toUpperCase()) continue;
    const ch = calcTotal(v, CHALDEAN);
    const py = calcTotal(v, PYTHAGOREAN);
    const dc = getCompatibility(ch.root, birthNum);
    const dlp = getCompatibility(ch.root, lifePathNum);
    results.push({
      name: v.trim(),
      chaldeanCompound: ch.total,
      chaldeanRoot: ch.root,
      pythagoreanCompound: py.total,
      pythagoreanRoot: py.root,
      dobCompat: dc,
      lpCompat: dlp,
      avgCompat: Math.round((dc + dlp) / 2),
      isPowerful:
        POWERFUL_COMPOUNDS.has(ch.total) || POWERFUL_COMPOUNDS.has(py.total),
    });
  }

  return results
    .sort(
      (a, b) =>
        (b.isPowerful ? 1 : 0) - (a.isPowerful ? 1 : 0) ||
        b.avgCompat - a.avgCompat,
    )
    .slice(0, 12);
}

// ── Shared prompt builder ─────────────────────────────────────
function buildAnalysisPrompt({
  name,
  dob,
  chaldean,
  pythagorean,
  birthNum,
  lifePathNum,
  mathSugs,
}) {
  return `You are an expert Vedic numerologist specializing in name correction using both Chaldean and Pythagorean systems.

Analyze this person's name numerology and provide detailed insights:

NAME: ${name}
DATE OF BIRTH: ${dob}
BIRTH NUMBER (Day): ${birthNum}
LIFE PATH NUMBER: ${lifePathNum}

CHALDEAN ANALYSIS:
- Compound Number: ${chaldean.compound}
- Root Number: ${chaldean.root}
- Current Meaning: ${chaldean.meaning}
- Strength: ${chaldean.strength}

PYTHAGOREAN ANALYSIS:
- Compound Number: ${pythagorean.compound}
- Root Number: ${pythagorean.root}
- Current Meaning: ${pythagorean.meaning}
- Strength: ${pythagorean.strength}

MATH-GENERATED NAME VARIATIONS (with their numerology):
${mathSugs.map((s, i) => `${i + 1}. "${s.name}" — Chaldean: ${s.chaldeanCompound}(root ${s.chaldeanRoot}), Pythagorean: ${s.pythagoreanCompound}(root ${s.pythagoreanRoot}), DOB compat: ${s.dobCompat}%, Powerful: ${s.isPowerful}`).join("\n")}

Please respond in this EXACT JSON format (no markdown, no extra text):
{
  "personalityInsight": "2-3 sentences about this person's numerological personality based on their current name and DOB",
  "currentNameAnalysis": "2-3 sentences about what their current name vibration means for their life — strengths and weaknesses",
  "careerAreas": ["area1", "area2", "area3", "area4"],
  "luckyNumbers": [1, 2, 3],
  "luckyColors": ["color1", "color2"],
  "luckyDays": ["day1", "day2"],
  "challenges": "1-2 sentences about key life challenges based on their numbers",
  "correctionNeeded": true or false,
  "correctionReason": "Why correction is or isn't needed — 1-2 sentences",
  "topSuggestions": [
    {
      "name": "exact name from the list above",
      "whyGood": "Specific reason why this spelling is better — mention compound number and what it means",
      "expectedBenefits": "What improvements this person will see in life",
      "compatScore": 85
    }
  ],
  "generalAdvice": "2-3 sentences of practical numerology advice for this person"
}

STRICT RULES for topSuggestions:
1. ONLY pick names from the math-generated list above — do NOT invent new names
2. Must be a SPELLING VARIATION of the original name — same name, slightly different spelling
3. NO middle names added, NO words like Ram/Lal/Devi/Kumar/Singh appended
4. Must sound natural when spoken — if weird or unpronounceable, skip it
5. Pick 3-5 best only. Prefer powerful compound numbers (19,23,27,32,41,46,50) and high DOB compat
6. whyGood and expectedBenefits: specific and meaningful, 1-2 sentences each`;
}

// ── JSON cleaner (same for both AI responses) ─────────────────
function parseAIJson(raw) {
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(clean);
}

// ── Default fallback (jab dono AI fail ho jayein) ─────────────
const AI_FALLBACK = {
  personalityInsight: "Analysis temporarily unavailable.",
  currentNameAnalysis: "Please try again.",
  careerAreas: ["Business", "Leadership"],
  luckyNumbers: [1, 5, 9],
  luckyColors: ["Gold", "Orange"],
  luckyDays: ["Sunday", "Tuesday"],
  challenges: "Unavailable",
  correctionNeeded: false,
  correctionReason: "",
  topSuggestions: [],
  generalAdvice: "",
};

// ── AI Analysis: Gemini first, Groq backup ────────────────────
async function getAIAnalysis(params) {
  const prompt = buildAnalysisPrompt(params);

  // ── 1. Gemini Primary ──────────────────────────────────────
  try {
    console.log("🔱 Name Correction: Trying Gemini...");
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });
    const result = await model.generateContent(
      `You are an expert numerologist. Always respond with valid JSON only. No markdown code blocks. No extra text before or after JSON.\n\n${prompt}`,
    );
    const raw = result.response.text();
    if (!raw) throw new Error("Gemini returned empty response");
    const parsed = parseAIJson(raw);
    console.log("✅ Name Correction: Gemini response received");
    return parsed;
  } catch (geminiErr) {
    console.error("⚠️ Name Correction: Gemini failed —", geminiErr.message);

    // ── 2. Groq Backup ─────────────────────────────────────
    try {
      console.log("🔄 Name Correction: Switching to Groq backup...");
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1500,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert numerologist. Always respond with valid JSON only. No markdown code blocks. No extra text before or after JSON.",
          },
          { role: "user", content: prompt },
        ],
      });
      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const parsed = parseAIJson(raw);
      console.log("✅ Name Correction: Groq backup response received");
      return parsed;
    } catch (groqErr) {
      console.error("❌ Name Correction: Groq also failed —", groqErr.message);
      // Dono fail — static fallback
      return AI_FALLBACK;
    }
  }
}

// ── Build final suggestions (AI picks + math data) ───────────
function buildFinalSuggestions(aiTopSugs, mathSugsMap) {
  return aiTopSugs
    .map((aiSug) => {
      const mathData =
        mathSugsMap.get(aiSug.name.toUpperCase().trim()) ||
        [...mathSugsMap.values()].find(
          (m) =>
            m.name.toUpperCase().trim() === aiSug.name.toUpperCase().trim(),
        );

      const ch = calcTotal(aiSug.name, CHALDEAN);
      const py = calcTotal(aiSug.name, PYTHAGOREAN);

      return {
        name: aiSug.name,
        whyGood: aiSug.whyGood,
        expectedBenefits: aiSug.expectedBenefits,
        compatScore: aiSug.compatScore || mathData?.avgCompat || 75,
        chaldean: {
          compound: ch.total,
          root: ch.root,
          ...getCompoundMeaning(ch.total),
        },
        pythagorean: {
          compound: py.total,
          root: py.root,
          ...getCompoundMeaning(py.total),
        },
        dobCompat: mathData?.dobCompat || 75,
        lpCompat: mathData?.lpCompat || 75,
        isPowerful:
          POWERFUL_COMPOUNDS.has(ch.total) || POWERFUL_COMPOUNDS.has(py.total),
      };
    })
    .filter((s) => s.name && s.name.trim().length > 0);
}

// ══════════════════════════════════════════════════════════════
// POST /api/name/analyze
// Body: { name: string, dob: "YYYY-MM-DD" }
// ══════════════════════════════════════════════════════════════
router.post("/analyze", async (req, res) => {
  try {
    const { name, dob } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2)
      return res
        .status(400)
        .json({ success: false, error: "Name required (min 2 characters)" });
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob))
      return res
        .status(400)
        .json({ success: false, error: "DOB required in YYYY-MM-DD format" });

    const cleanName = name.trim();

    // ── Step 1: Math calculations ──
    const chRaw = calcTotal(cleanName, CHALDEAN);
    const pyRaw = calcTotal(cleanName, PYTHAGOREAN);
    const lp = calcLifePath(dob);
    const bn = calcBirthNumber(dob);

    const chaldean = {
      compound: chRaw.total,
      root: chRaw.root,
      breakdown: chRaw.breakdown,
      ...getCompoundMeaning(chRaw.total),
    };
    const pythagorean = {
      compound: pyRaw.total,
      root: pyRaw.root,
      breakdown: pyRaw.breakdown,
      ...getCompoundMeaning(pyRaw.total),
    };
    const dob_data = {
      birthNumber: bn,
      lifePath: lp.root,
      lifePathTotal: lp.total,
    };

    // ── Step 2: Math-based suggestions (fast) ──
    const mathSugs = mathSuggestions(cleanName, bn, lp.root);
    const mathSugsMap = new Map(
      mathSugs.map((s) => [s.name.toUpperCase().trim(), s]),
    );

    // ── Step 3: AI analysis (Gemini → Groq fallback) ──
    const aiResult = await getAIAnalysis({
      name: cleanName,
      dob,
      chaldean,
      pythagorean,
      birthNum: bn,
      lifePathNum: lp.root,
      mathSugs,
    });

    // ── Step 4: Compatibility ──
    const compat = {
      chaldeanVsBirth: getCompatibility(chaldean.root, bn),
      chaldeanVsLifePath: getCompatibility(chaldean.root, lp.root),
      pythagoreanVsBirth: getCompatibility(pythagorean.root, bn),
      pythagoreanVsLP: getCompatibility(pythagorean.root, lp.root),
      overall: Math.round(
        (getCompatibility(chaldean.root, bn) +
          getCompatibility(chaldean.root, lp.root) +
          getCompatibility(pythagorean.root, bn) +
          getCompatibility(pythagorean.root, lp.root)) /
        4,
      ),
    };

    // ── Step 5: Assessment grade ──
    const isPowerfulCh = POWERFUL_COMPOUNDS.has(chaldean.compound);
    const isPowerfulPy = POWERFUL_COMPOUNDS.has(pythagorean.compound);
    const assessment =
      compat.overall >= 80 && (isPowerfulCh || isPowerfulPy)
        ? { grade: "A+", label: "Excellent Name", color: "green" }
        : compat.overall >= 70 && (isPowerfulCh || isPowerfulPy)
          ? { grade: "A", label: "Very Good Name", color: "green" }
          : compat.overall >= 70
            ? { grade: "B+", label: "Good Name", color: "amber" }
            : compat.overall >= 60
              ? { grade: "B", label: "Average Name", color: "amber" }
              : { grade: "C", label: "Correction Recommended", color: "red" };

    // ── Step 6: Final suggestions from AI ──
    const finalSuggestions = buildFinalSuggestions(
      aiResult.topSuggestions || [],
      mathSugsMap,
    );

    return res.json({
      success: true,
      name: cleanName,
      dob: dob_data,
      chaldean,
      pythagorean,
      compat,
      assessment,
      ai: {
        personalityInsight: aiResult.personalityInsight,
        currentNameAnalysis: aiResult.currentNameAnalysis,
        careerAreas: aiResult.careerAreas || [],
        luckyNumbers: aiResult.luckyNumbers || [],
        luckyColors: aiResult.luckyColors || [],
        luckyDays: aiResult.luckyDays || [],
        challenges: aiResult.challenges,
        correctionNeeded: aiResult.correctionNeeded,
        correctionReason: aiResult.correctionReason,
        generalAdvice: aiResult.generalAdvice,
      },
      suggestions: finalSuggestions,
      isPowerfulChaldean: isPowerfulCh,
      isPowerfulPythagorean: isPowerfulPy,
    });
  } catch (err) {
    console.error("Name analysis error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error: " + err.message });
  }
});

//POST /api/name/name-correction
router.post("/name-correction", verifyToken,
  checkServiceLimit(), async (req, res) => {
    try {
      const { name, dob, userId } = req.body;

      // 1. Validation
      if (
        !name ||
        typeof name !== "string" ||
        name.trim().length < 2 ||
        !dob ||
        !userId
      ) {
        return res.status(400).json({
          success: false,
          error: "All fields (name, dob, userId) are required.",
        });
      }

      // 2. Database Insertion (Using await)
      const sql =
        "INSERT INTO name_correction (name, dob, userid) VALUES (?, ?, ?)";
      const values = [name.trim(), dob, userId];

      // Yahan await lagane se code response ka intezar karega
      const [result] = await db.execute(sql, values);

      // 3. Success Response (Yeh tabhi chalega jab upar wala kaam pura ho jayega)
      return res.status(201).json({
        success: true,
        message: "Correction request submitted successfully!",
        data: {
          id: result.insertId,
          name,
          dob,
          userId,
        },
      });
    } catch (error) {
      console.error("Error details:", error); // Terminal mein error check karein
      return res.status(500).json({
        success: false,
        error: "Internal server error: " + error.message,
      });
    }
  });

export default router;
