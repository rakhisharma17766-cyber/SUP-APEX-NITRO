import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client using environment key
const ai = new GoogleGenAI();

export interface StrategyBriefing {
  tacticalTip: string;
  recommendedPlaystyle: string;
  rivalWarning: string;
}

export async function getTuningStrategyAdvice(
  carName: string,
  themeName: string,
  trackLengthMeters: number,
  upgrades: { [key: string]: number }
): Promise<StrategyBriefing> {
  const prompt = `You are "Apex Chief", the legendary head mechanic and race strategist of an arcade 2.5D multiplayer racing league inspired by SUP Multiplayer Racing.
The driver is taking their "${carName}" into a ${trackLengthMeters}m high-speed race on the "${themeName}" track.
Current car upgrade levels:
- Top Speed: Lvl ${upgrades.topSpeed || 1}/5
- Acceleration: Lvl ${upgrades.acceleration || 1}/5
- Heavy Armor Bumper: Lvl ${upgrades.heavyArmor || 1}/5
- Nitro Capacity: Lvl ${upgrades.nitroDuration || 1}/5
- Nitro Boost Power: Lvl ${upgrades.nitroPower || 1}/5

Respond strictly in valid JSON format with three keys:
{
  "tacticalTip": "A 1-2 sentence punchy tactical advice on when to burn nitro, take ramps, or draft.",
  "recommendedPlaystyle": "A 1 sentence recommendation on bumping vs drafting for this specific car and track length.",
  "rivalWarning": "A humorous 1 sentence warning about rival heavy ramming or slipstream overtakes."
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      tacticalTip: parsed.tacticalTip || 'Hit the apex, conserve your nitro for airborne ramp jumps!',
      recommendedPlaystyle: parsed.recommendedPlaystyle || 'Use your aerodynamic slipstream to slingshot past opponents.',
      rivalWarning: parsed.rivalWarning || 'Watch your flanks—Cyber Beasts love crushing competitors into side guardrails!',
    };
  } catch (e) {
    console.warn('Gemini strategy generation fallback:', e);
    return {
      tacticalTip: 'Draft directly behind lead cars to gain +15% slipstream speed, then fire nitro over jump ramps!',
      recommendedPlaystyle: 'Keep an eye on speed pads and don’t be afraid to deliver a heavy side-bump to claim the inside lane.',
      rivalWarning: 'Rival drivers are hyper-aggressive—brace for metal-crunching side bumps at high speed!',
    };
  }
}

export async function getPostRaceCommentary(
  playerRank: number,
  carName: string,
  raceTimeSeconds: number,
  totalBumps: number,
  draftsUsed: boolean
): Promise<string> {
  const prompt = `You are an energetic, hyper-excited arcade esports racing commentator.
Deliver a 2-3 sentence electrifying post-race recap for a driver who finished #${playerRank} driving the "${carName}" with a clock time of ${raceTimeSeconds.toFixed(2)}s, delivering ${totalBumps} brutal side-bumps${draftsUsed ? ' and exploiting slipstream drafting' : ''}.
Make it sound hype, arcade-style, with racing jargon and maximum adrenaline!`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || `What an electrifying performance! Finishing P${playerRank} with pure raw aggression and lightning-fast nitro deployment!`;
  } catch (e) {
    console.warn('Gemini commentary fallback:', e);
    if (playerRank === 1) {
      return `UNBELIEVABLE FINISH! You dominated the asphalt, unleashed explosive nitro boosts, and left all rivals in the dust to take FIRST PLACE!`;
    } else if (playerRank === 2) {
      return `A photo-finish showdown on the home stretch! Incredible driving and relentless pressure earned you a well-deserved silver podium!`;
    } else {
      return `Hard-hitting arcade warfare from start to finish! Dust off the chassis, upgrade that twin-turbo engine, and get ready for revenge!`;
    }
  }
}
