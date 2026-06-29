// ============================================================
//  gptServiceController.js
//  Gemini Primary + Groq Backup — Dual system analysis
// ============================================================

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildPrompt(k) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const rows = Object.entries(k.planets)
    .map(([n,p]) =>
      `${n.padEnd(10)} | ${p.rashi.padEnd(14)} | ${String(p.degree).padEnd(6)}° | H${String(p.house).padEnd(2)} | ${p.strength}${p.retrograde?' ℞':''}`
    ).join('\n');

  const doshaList = k.doshas.length
    ? k.doshas.map(d =>
        `- ${d.name} [${d.severity}]${d.cancellations?.length ? ' — CANCELLED: '+d.cancellations.join('; ') : ''}`
      ).join('\n')
    : '- No major doshas detected';

  const srcNote = k.dataSource==='swisseph'
    ? 'Swiss Ephemeris .se1 files — highest accuracy (0.001 arcsec)'
    : k.dataSource==='moshier'
    ? 'Swiss Ephemeris Moshier mode — very accurate (~1 arcsec)'
    : 'Mathematical VSOP87 fallback';

  return `You are Jyotish Acharya — master Vedic Astrologer, 30+ years experience.
Deeply versed in BPHS, KP Astrology, Jaimini Sutras.

DATA SOURCE: ${srcNote}
AYANAMSA: Lahiri ${k.ayanamsa}° (Tropical → Sidereal)
HOUSE SYSTEM: Whole Sign — houses count from Lagna


=== CURRENT DATE ===
Today      : ${today.toISOString().split('T')[0]}
Current Year: ${currentYear}
IMPORTANT  : All Best & Caution Periods MUST start from ${currentMonth}. Never use ${currentYear - 1} or earlier as future dates.

=== NATIVE ===
Name    : ${k.nativeInfo.name}
DOB     : ${k.nativeInfo.dateOfBirth} ${k.nativeInfo.timeOfBirth}
Place   : ${k.nativeInfo.placeOfBirth} (TZ: UTC+${k.nativeInfo.timezoneOffset})
Gender  : ${k.nativeInfo.gender}
Lagna   : ${k.lagnaRashi} (Lord: ${k.lagnaLord})
Moon    : ${k.planets.Moon.rashi}
Nakshatra: ${k.nakshatra} (Lord: ${k.nakshatraLord})
Mahadasha: ${k.mahadasha.planet} — ${k.mahadasha.yearsRemaining} yrs remaining

=== PLANETS (Sidereal / Vedic) ===
Planet     | Rashi          | Degree | H  | Strength
-----------|----------------|--------|----|---------
${rows}

Strong: ${k.strongPlanets.join(', ')||'None'}
Weak  : ${k.weakPlanets.join(', ')||'None'}

=== DOSHAS ===
${doshaList}

=== INSTRUCTIONS ===
Be SPECIFIC to this person, not generic.
Use STRENGTH in analysis. Respect CANCELLATIONS.
Mark each life area: GOOD / MIXED / CHALLENGING

Reply with EXACTLY these 6 tags, each on its OWN LINE:

<<OPTION_A_START>>
## OPTION A — PARASHARI (BPHS / North Indian)

### 1. Lagna & Chart Strength
[${k.lagnaRashi} Lagna, lord ${k.lagnaLord}, overall promise]

### 2. Dosha Verification (Parashari)
[Verify each, confirm cancellations, final status]

### 3. Key Yogas
[Specific Raj Yogas, Dhana Yogas, or negative yogas]

### 4. Life Areas
Career (H10)  : GOOD/MIXED/CHALLENGING — reason
Marriage (H7) : GOOD/MIXED/CHALLENGING — reason
Finance (H2/11): GOOD/MIXED/CHALLENGING — reason
Health (H1/6) : GOOD/MIXED/CHALLENGING — reason

### 5. Current Mahadasha
[${k.mahadasha.planet} Mahadasha — specific impact, ${k.mahadasha.yearsRemaining} yrs left]
<<OPTION_A_END>>

<<OPTION_B_START>>
## OPTION B — KP / JAIMINI SYSTEM

### 1. KP Sub-lord Analysis
[Sub-lords of H1, H7, H10, H11 — what they signify]

### 2. Dosha Verification (KP Rules)
[Does KP agree/disagree with Parashari on each dosha?]

### 3. Jaimini Chara Dasha
[Current period and impact]

### 4. Life Areas (KP Method)
Career  : agree/disagree with A — why
Marriage: agree/disagree with A — why
Finance : agree/disagree with A — why
Health  : agree/disagree with A — why

### 5. Cross-Check
[Where do A & B fully agree? Where differ?]
<<OPTION_B_END>>

<<VERDICT_START>>
## FINAL VERDICT — CROSS-VERIFIED

### Confidence Level
[HIGH / MODERATE / UNCERTAIN for each major prediction]

### Active Doshas (Confirmed)
[Only present AND not cancelled]

### Overall Reading
[3 specific paragraphs: current phase, challenges, opportunities]

### Top 5 Remedies
1. [Most urgent]
2. [Second]
3. [Third]
4. [Fourth]
5. [Fifth]

### Best & Caution Periods (Next 2 Years)
[Start from ${currentMonth}. Give specific month ranges for ${currentYear} and ${currentYear + 1} only.]
<<VERDICT_END>>`;
}

function parseSections(raw) {
  const get = (startTag, endTag) => {
    // Regex to match tags even with varying whitespace/newlines
    const startRegex = new RegExp(`${startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const endRegex = new RegExp(`${endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    
    const startMatch = raw.match(startRegex);
    const endMatch = raw.match(endRegex);
    
    if (startMatch && endMatch && endMatch.index > startMatch.index) {
      return raw.slice(startMatch.index + startMatch[0].length, endMatch.index).trim();
    }
    return null;
  };

  let A = get('<<OPTION_A_START>>', '<<OPTION_A_END>>');
  let B = get('<<OPTION_B_START>>', '<<OPTION_B_END>>');
  let V = get('<<VERDICT_START>>',  '<<VERDICT_END>>');

  // Fallback 1: Try to find sections by standard Markdown headers if tags are missing
  if (!A || !B || !V) {
    const parts = raw.split(/##\s+(OPTION A|OPTION B|FINAL VERDICT|PARASHARI|KP\/JAIMINI|VERDICT)/i);
    // When splitting with capture groups, even indices are content, odd indices are the captured headers
    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i].toUpperCase();
      const content = parts[i + 1]?.trim();
      if (!content) continue;

      if (!A && (header.includes('OPTION A') || header.includes('PARASHARI'))) A = content;
      else if (!B && (header.includes('OPTION B') || header.includes('KP/JAIMINI'))) B = content;
      else if (!V && (header.includes('VERDICT'))) V = content;
    }
  }

  // Fallback 2: If we STILL have nothing (no tags and no headers), DO NOT split into thirds.
  // Instead, provide the full text in Option A and show warnings in others.
  if (!A && !B && !V) {
    return {
      optionA      : raw,
      optionB      : '⚠️ Analysis could not be separated into sections automatically. Please refer to Option A or the Technical Details (Raw) tab.',
      finalVerdict : '⚠️ Analysis could not be separated into sections automatically. Please refer to Option A or the Technical Details (Raw) tab.',
      fallback     : true,
    };
  }

  return {
    optionA      : A || '⚠️ Option A content missing — see Raw tab',
    optionB      : B || '⚠️ Option B content missing — see Raw tab',
    finalVerdict : V || '⚠️ Verdict content missing — see Raw tab',
    fallback     : false,
  };
}

export async function analyzeWithGPT(kundliData) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY missing in .env');

  const prompt = buildPrompt(kundliData);

  const SYSTEM_PROMPT = `You are Jyotish Acharya — master Vedic Astrologer.
RULES:
1. Use all 6 tags EXACTLY on their own lines
2. Be specific to this person, never generic
3. Use planet strength (EXALTED/DEBILITATED) in analysis
4. Respect pre-calculated dosha cancellations
5. Label life areas: GOOD / MIXED / CHALLENGING
6. Whole Sign houses — H1 = Lagna Rashi`;

  // ── 1. Gemini Primary ──────────────────────────────────────
  try {
    console.log('🔱 Kundli Analysis: Trying Gemini...');
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${prompt}`);
    const raw    = result.response.text();
    if (!raw) throw new Error('Gemini returned empty response');
    console.log('✅ Kundli Analysis: Gemini response received');
    return {
      sections   : parseSections(raw),
      rawAnalysis: raw,
      tokensUsed : 0,
      model      : 'gemini-3.1-flash-lite-preview',
    };

  } catch (geminiErr) {
    console.error('⚠️ Kundli Analysis: Gemini failed —', geminiErr.message);

    // ── 2. Groq Backup ─────────────────────────────────────
    try {
      console.log('🔄 Kundli Analysis: Switching to Groq backup...');
      const groq     = new Groq({ apiKey });
      const response = await groq.chat.completions.create({
        model      : 'llama-3.3-70b-versatile',
        temperature: 0.15,
        max_tokens : 4500,
        messages   : [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt         },
        ],
      });
      const raw = response.choices[0].message.content;
      console.log('✅ Kundli Analysis: Groq backup response received');
      return {
        sections   : parseSections(raw),
        rawAnalysis: raw,
        tokensUsed : response.usage?.total_tokens || 0,
        model      : response.model,
      };

    } catch (groqErr) {
      console.error('❌ Kundli Analysis: Groq also failed —', groqErr.message);
      throw new Error('Both Gemini and Groq failed: ' + groqErr.message);
    }
  }
}