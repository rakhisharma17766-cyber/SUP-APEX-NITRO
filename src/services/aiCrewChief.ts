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
  try {
    const res = await fetch('/api/gemini/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carName, themeName, trackLengthMeters, upgrades }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        tacticalTip: data.tacticalTip || 'Hit the apex, conserve your nitro for airborne ramp jumps!',
        recommendedPlaystyle: data.recommendedPlaystyle || 'Use your aerodynamic slipstream to slingshot past opponents.',
        rivalWarning: data.rivalWarning || 'Watch your flanks—Cyber Beasts love crushing competitors into side guardrails!',
      };
    }
  } catch (e) {
    console.warn('Strategy proxy call fallback:', e);
  }

  return {
    tacticalTip: 'Draft directly behind lead cars to gain +15% slipstream speed, then fire nitro over jump ramps!',
    recommendedPlaystyle: 'Keep an eye on speed pads and don’t be afraid to deliver a heavy side-bump to claim the inside lane.',
    rivalWarning: 'Rival drivers are hyper-aggressive—brace for metal-crunching side bumps at high speed!',
  };
}

export async function getPostRaceCommentary(
  playerRank: number,
  carName: string,
  raceTimeSeconds: number,
  totalBumps: number,
  draftsUsed: boolean
): Promise<string> {
  try {
    const res = await fetch('/api/gemini/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerRank, carName, raceTimeSeconds, totalBumps, draftsUsed }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.commentary) {
        return data.commentary;
      }
    }
  } catch (e) {
    console.warn('Commentary proxy call fallback:', e);
  }

  if (playerRank === 1) {
    return 'UNBELIEVABLE FINISH! You dominated the asphalt, unleashed explosive nitro boosts, and left all rivals in the dust to take FIRST PLACE!';
  } else if (playerRank === 2) {
    return 'A photo-finish showdown on the home stretch! Incredible driving and relentless pressure earned you a well-deserved silver podium!';
  } else {
    return 'Hard-hitting arcade warfare from start to finish! Dust off the chassis, upgrade that twin-turbo engine, and get ready for revenge!';
  }
}
