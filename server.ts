import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Gemini API server-side endpoints
app.post('/api/gemini/strategy', async (req, res) => {
  try {
    const { carName, themeName, trackLengthMeters, upgrades } = req.body;
    const ai = new GoogleGenAI();
    const prompt = `You are "Apex Chief", the legendary head mechanic and race strategist of an arcade 2.5D multiplayer racing league inspired by SUP Multiplayer Racing.
The driver is taking their "${carName}" into a ${trackLengthMeters}m high-speed race on the "${themeName}" track.
Current car upgrade levels:
- Top Speed: Lvl ${upgrades?.topSpeed || 1}/5
- Acceleration: Lvl ${upgrades?.acceleration || 1}/5
- Heavy Armor Bumper: Lvl ${upgrades?.heavyArmor || 1}/5
- Nitro Capacity: Lvl ${upgrades?.nitroDuration || 1}/5
- Nitro Boost Power: Lvl ${upgrades?.nitroPower || 1}/5

Respond strictly in valid JSON format with three keys:
{
  "tacticalTip": "A 1-2 sentence punchy tactical advice on when to burn nitro, take ramps, or draft.",
  "recommendedPlaystyle": "A 1 sentence recommendation on bumping vs drafting for this specific car and track length.",
  "rivalWarning": "A humorous 1 sentence warning about rival heavy ramming or slipstream overtakes."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.json({
      tacticalTip: parsed.tacticalTip || 'Hit the apex, conserve your nitro for airborne ramp jumps!',
      recommendedPlaystyle: parsed.recommendedPlaystyle || 'Use your aerodynamic slipstream to slingshot past opponents.',
      rivalWarning: parsed.rivalWarning || 'Watch your flanks—Cyber Beasts love crushing competitors into side guardrails!',
    });
  } catch (error) {
    console.error('Error generating strategy with Gemini:', error);
    return res.json({
      tacticalTip: 'Draft directly behind lead cars to gain +15% slipstream speed, then fire nitro over jump ramps!',
      recommendedPlaystyle: 'Keep an eye on speed pads and don’t be afraid to deliver a heavy side-bump to claim the inside lane.',
      rivalWarning: 'Rival drivers are hyper-aggressive—brace for metal-crunching side bumps at high speed!',
    });
  }
});

app.post('/api/gemini/commentary', async (req, res) => {
  try {
    const { playerRank, carName, raceTimeSeconds, totalBumps, draftsUsed } = req.body;
    const ai = new GoogleGenAI();
    const prompt = `You are an energetic, hyper-excited arcade esports racing commentator.
Deliver a 2-3 sentence electrifying post-race recap for a driver who finished #${playerRank} driving the "${carName}" with a clock time of ${Number(raceTimeSeconds || 30).toFixed(2)}s, delivering ${totalBumps || 0} brutal side-bumps${draftsUsed ? ' and exploiting slipstream drafting' : ''}.
Make it sound hype, arcade-style, with racing jargon and maximum adrenaline!`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.json({
      commentary: response.text?.trim() || 'What an electrifying race finish with pure raw adrenaline!',
    });
  } catch (error) {
    console.error('Error generating commentary with Gemini:', error);
    let fallback = 'What an electrifying race finish!';
    if (req.body.playerRank === 1) {
      fallback = 'UNBELIEVABLE FINISH! You dominated the asphalt, unleashed explosive nitro boosts, and left all rivals in the dust to take FIRST PLACE!';
    } else if (req.body.playerRank === 2) {
      fallback = 'A photo-finish showdown on the home stretch! Incredible driving and relentless pressure earned you a well-deserved silver podium!';
    } else {
      fallback = 'Hard-hitting arcade warfare from start to finish! Dust off the chassis, upgrade that twin-turbo engine, and get ready for revenge!';
    }
    return res.json({ commentary: fallback });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
