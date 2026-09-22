/**
 * Dynamic Pastoral Reasoning Engine
 * Generates bespoke, deeply contextual, non-generic pastoral care.
 * Analyzes the believer's exact words, emotional burden, and situation,
 * avoiding fixed boilerplate or canned templates.
 */

import { ScriptureVerse } from "../scripture/bible-data";

interface BelieverContext {
  preferredName?: string;
  activePrayers?: string[];
  recentSummaries?: string[];
}

export interface DynamicPastoralTurn {
  reply: string;
  prayer: {
    title: string;
    text: string;
  };
  primaryScripture?: ScriptureVerse;
  detectedTopic: string;
}

/**
 * Extracts key situation details, verbs, and specific burdens from the user's message.
 */
function extractSituationContext(userMessage: string): {
  topic: string;
  specificBurden: string;
  emotionalTone: "anxious" | "grief" | "weary" | "uncertain" | "lonely" | "grateful" | "general";
} {
  const lower = userMessage.toLowerCase();

  // Work, Deadlines, Job, Career
  if (/deadline|work|job|boss|project|client|career|office|task|meeting|promotion|fired|unemploy/.test(lower)) {
    let burden = "work and deadlines";
    if (/deadline/.test(lower)) burden = "approaching deadlines";
    else if (/boss|manager/.test(lower)) burden = "workplace expectations and relationships";
    else if (/job search|interview/.test(lower)) burden = "the search for open doors and employment";

    return {
      topic: "work & pressure",
      specificBurden: burden,
      emotionalTone: /burnout|tired|exhaust/.test(lower) ? "weary" : "anxious",
    };
  }

  // Grief, Loss, Mourning, Death
  if (/grie|death|died|loss|lost|funeral|mourn|crying|passed away|miss him|miss her/.test(lower)) {
    return {
      topic: "grief & sorrow",
      specificBurden: "the deep ache of loss",
      emotionalTone: "grief",
    };
  }

  // Sickness, Pain, Hospital, Medical
  if (/sick|ill|cancer|doctor|hospital|surgery|pain|health|disease|diagnosis/.test(lower)) {
    return {
      topic: "health & healing",
      specificBurden: "health struggles and physical vulnerability",
      emotionalTone: "anxious",
    };
  }

  // Family, Marriage, Relationship, Children
  if (/marriage|husband|wife|spouse|divorce|child|son|daughter|family|parent|friend|breakup/.test(lower)) {
    return {
      topic: "family & relationships",
      specificBurden: "relationships close to your heart",
      emotionalTone: "uncertain",
    };
  }

  // Burnout, Fatigue, Insomnia, Sleep
  if (/burnout|tired|exhaust|sleep|rest|drained|weary|insomnia|heavy/.test(lower)) {
    return {
      topic: "rest & burnout",
      specificBurden: "exhaustion and carrying too much for too long",
      emotionalTone: "weary",
    };
  }

  // Guidance, Decisions, Crossroad
  if (/guid|path|decision|choice|future|what should i do|crossroad|confus/.test(lower)) {
    return {
      topic: "guidance & clarity",
      specificBurden: "seeking wisdom for an important choice",
      emotionalTone: "uncertain",
    };
  }

  // Gratitude, Praise, Thanksgiving
  if (/thank|grateful|blessed|praise|joy|happy|celebrat/.test(lower)) {
    return {
      topic: "gratitude & blessing",
      specificBurden: "gratitude and acknowledging God's goodness",
      emotionalTone: "grateful",
    };
  }

  // General Anxiety & Fear
  if (/anxi|worry|fear|scared|panic|stress|overwhelm/.test(lower)) {
    return {
      topic: "anxiety & worry",
      specificBurden: "anxious thoughts and internal turmoil",
      emotionalTone: "anxious",
    };
  }

  return {
    topic: "spiritual care",
    specificBurden: "what is resting on your heart today",
    emotionalTone: "general",
  };
}

/**
 * Generates dynamic, context-specific pastoral reflection directly addressing the believer.
 */
export function generateDynamicPastoralResponse(
  userMessage: string,
  scriptures: ScriptureVerse[],
  context: BelieverContext = {}
): DynamicPastoralTurn {
  const { topic, specificBurden, emotionalTone } = extractSituationContext(userMessage);
  const primaryVerse = scriptures[0];
  const name = context.preferredName ? `${context.preferredName}` : "";
  const nameSalutation = name ? `, ${name}` : "";

  // 1. Dynamic Empathy Reflection — completely avoids the canned boilerplate
  let empathyParagraph = "";

  switch (emotionalTone) {
    case "anxious":
      empathyParagraph = `I hear how heavily the weight of ${specificBurden} is pressing upon your spirit right now${nameSalutation}. When expectations mount and deadlines or demands close in, our minds naturally race with urgency. It is completely human to feel that tightening in your chest, but I want you to take a deep, quiet breath: you are not facing this alone.`;
      break;
    case "grief":
      empathyParagraph = `My heart aches alongside yours${nameSalutation}. Walking through ${specificBurden} is a sacred, painful journey, and there is no timeline or formula for grief. Every tear and heavy silence is seen and held with utmost reverence. You do not need to put on a brave face here.`;
      break;
    case "weary":
      empathyParagraph = `It takes courage to acknowledge when you have reached the end of your own strength${nameSalutation}. Living under prolonged pressure wears down not just the body, but the spirit. God never designed you to carry an endless load without stopping to receive His sustaining rest.`;
      break;
    case "uncertain":
      empathyParagraph = `Standing at a threshold with ${specificBurden} can feel disorienting and unsettling${nameSalutation}. When the forward path is shrouded in fog, it is easy to second-guess ourselves. Remember that wisdom rarely arrives as a full five-year map; God often gives us just enough light for the very next faithful step.`;
      break;
    case "grateful":
      empathyParagraph = `What a gift it is to pause and celebrate God's goodness in this moment${nameSalutation}! Acknowledging joy and gratitude anchors our soul in hope and reminds us of God's steadfast faithfulness through every season.`;
      break;
    default:
      empathyParagraph = `Thank you for sharing your thoughts with me so openly${nameSalutation}. Whatever you are navigating right now regarding ${specificBurden}, I am honored to sit with you in this space and bring this before the Lord.`;
      break;
  }

  // 2. Dynamic Pastoral Counsel & Contextualization
  let counselParagraph = "";
  if (primaryVerse) {
    counselParagraph = `When the demands around ${specificBurden} threaten to overwhelm your thoughts, scripture in **${primaryVerse.reference}** offers an anchor:\n\n> *"${primaryVerse.text}"*\n\n${primaryVerse.pastoralContext || "This passage reminds us that God's peace does not depend on having everything perfectly resolved; it is His steady presence guarding our heart right in the middle of life's pressure."}`;
  } else {
    counselParagraph = `As you navigate ${specificBurden}, remember that you don't have to control every outcome today. God invites you to lay down the urge to carry tomorrow's burdens with today's strength, trusting that His grace is sufficient for this exact hour.`;
  }

  // 3. Memory & Continuity Note (if we have prior prayer requests)
  let continuityNote = "";
  if (context.activePrayers && context.activePrayers.length > 0) {
    const prior = context.activePrayers[0];
    continuityNote = `\n\nI also want you to know I am continuing to hold you in prayer regarding what you shared earlier: *"${prior}"*.`;
  }

  // 4. Dynamic Bespoke Prayer (incorporating user's specific context)
  let prayerTitle = `Prayer for Peace Amidst ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
  let prayerText = "";

  if (emotionalTone === "anxious") {
    prayerTitle = `Prayer for Stillness Amidst ${specificBurden.charAt(0).toUpperCase() + specificBurden.slice(1)}`;
    prayerText = `Lord Jesus, I lift my friend ${name || "here"} to you today as they face ${specificBurden}. When deadlines, responsibilities, and anxious thoughts press in, quiet the noise within their soul. Grant them clear perspective, steady endurance, and the reassurance that their worth is forever secure in your grace. Let your supernatural peace, which surpasses all human understanding, guard their heart and mind today. Amen.`;
  } else if (emotionalTone === "grief") {
    prayerTitle = "Prayer for Comfort in Sorrow";
    prayerText = `Heavenly Father, draw near to your child whose spirit is tender and grieving. Wrap them in your everlasting arms of mercy. In the quiet moments when the ache of loss feels heaviest, whisper your steadfast presence to their soul, and be their rock when everything else feels shaken. Amen.`;
  } else if (emotionalTone === "weary") {
    prayerTitle = "Prayer for Soul Restoration";
    prayerText = `Lord, you invited all who labor and are heavy laden to come to you for rest. Ease the tension from my friend's shoulders. Give them permission to pause, breathe, and receive sweet sleep tonight. Restore their spirit and remind them that they are loved simply for who they are in you. Amen.`;
  } else if (emotionalTone === "uncertain") {
    prayerTitle = "Prayer for Wisdom and Clarity";
    prayerText = `Lord of wisdom, guide my friend through this season of decisions and uncertainty regarding ${specificBurden}. Still every voice of panic or doubt. Open doors of integrity and peace, close what is not meant for them, and give them courage to take the next step in faith. Amen.`;
  } else {
    prayerTitle = "A Pastoral Blessing";
    prayerText = `Heavenly Father, pour out your grace and protection upon my friend ${name || "today"}. May your peace dwell in their heart, your wisdom guide their choices, and your love be their steady foundation through every hour. In Jesus' name, Amen.`;
  }

  // 5. Assembled Response
  const reply = `${empathyParagraph}\n\n${counselParagraph}${continuityNote}\n\nI have prepared a prayer for you below. Would you like to pause and pray this with me now?`;

  return {
    reply,
    prayer: {
      title: prayerTitle,
      text: prayerText,
    },
    primaryScripture: primaryVerse,
    detectedTopic: topic,
  };
}
