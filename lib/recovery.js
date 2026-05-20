// Recovery-time recommendation.
// Heuristic-based — looks at the last "hard" ride and suggests when next hard
// effort is OK. Modifiers from today's check-in (low readiness = +1 day).

export function classifyIntensity(ride) {
  const minutes = ride?.minutes || 0;
  const elev    = ride?.elev_m  || 0;
  const km      = ride?.km      || 0;
  if (minutes >= 180 || elev >= 1000 || km >= 50)  return "epic";
  if (minutes >= 120 || elev >=  500 || km >= 30)  return "hard";
  if (minutes >=  60 || elev >=  200 || km >= 15)  return "moderate";
  return "easy";
}

const RECOVERY_DAYS = { easy: 0, moderate: 1, hard: 2, epic: 3 };

export function recoveryRecommendation({ rides, todayCheckin }) {
  if (!rides || rides.length === 0) {
    return { status: "ready", label: "No recent rides — ready for anything.", color: "#5cb85c" };
  }

  // Find the hardest of the last 7 days.
  const cutoff = new Date(Date.now() - 7 * 86400_000);
  const recent = rides.filter((r) => new Date(r.date + "T00:00:00") >= cutoff);
  if (recent.length === 0) {
    return { status: "ready", label: "No rides in the past 7 days — recovered.", color: "#5cb85c" };
  }

  const enriched = recent.map((r) => ({ ...r, intensity: classifyIntensity(r) }));
  // Hardest by ordinal: epic > hard > moderate > easy
  const order = { epic: 3, hard: 2, moderate: 1, easy: 0 };
  enriched.sort((a, b) => order[b.intensity] - order[a.intensity]);
  const hardest = enriched[0];

  const daysSince = Math.floor((Date.now() - new Date(hardest.date + "T00:00:00").getTime()) / 86400_000);
  let neededDays = RECOVERY_DAYS[hardest.intensity];

  // Modify based on today's check-in.
  let modifier = "";
  if (todayCheckin) {
    const readiness = todayCheckin.sleep + todayCheckin.energy - todayCheckin.soreness;
    if (readiness <= 3) {
      neededDays += 1;
      modifier = " (low readiness — added a day)";
    } else if (readiness >= 12 && neededDays > 0) {
      neededDays = Math.max(0, neededDays - 1);
      modifier = " (high readiness — shaved a day)";
    }
  }

  const remaining = Math.max(0, neededDays - daysSince);
  const status = remaining === 0 ? "ready" : remaining === 1 ? "almost" : "recovering";

  const intensityLabel = { epic: "Epic", hard: "Hard", moderate: "Moderate", easy: "Easy" }[hardest.intensity];
  let label;
  if (remaining === 0) {
    label = `Last ${intensityLabel.toLowerCase()} ride was ${daysSince} day${daysSince === 1 ? "" : "s"} ago. You're ready for another hard session.${modifier}`;
  } else if (remaining === 1) {
    label = `Last ride was ${intensityLabel.toLowerCase()} (${daysSince}d ago). One more easy day recommended.${modifier}`;
  } else {
    label = `Last ride was ${intensityLabel.toLowerCase()} (${daysSince}d ago). ${remaining} more recovery days suggested.${modifier}`;
  }

  return {
    status,
    label,
    color: status === "ready" ? "#5cb85c" : status === "almost" ? "#f0ad4e" : "#d9534f",
    daysSince,
    remaining,
    hardest: { date: hardest.date, intensity: intensityLabel, km: hardest.km, elev_m: hardest.elev_m, minutes: hardest.minutes },
  };
}
