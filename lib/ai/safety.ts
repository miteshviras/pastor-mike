export interface SafetyCheckResult {
  isCrisis: boolean;
  isMedicalOrLegal: boolean;
  isProphecyRefusal: boolean;
  crisisResponse?: string;
  flaggedKeywords?: string[];
  hotlines?: Array<{ name: string; contact: string; description: string }>;
}

const CRISIS_PATTERNS = [
  /\b(kill|end)\s+(myself|my\s+life)\b/i,
  /\bcommit\s+suicide\b/i,
  /\bsuicid(e|al)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|wake\s+up)\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcutting\s+myself\b/i,
  /\boverdose\b/i,
  /\bdomestic\s+abuse\b/i,
  /\bsomeone\s+is\s+hitting\s+me\b/i,
  /\bin\s+immediate\s+danger\b/i,
];

const MEDICAL_LEGAL_PATTERNS = [
  /\b(stop\s+taking|prescribe|dosage|medication\s+for|medical\s+advice)\b/i,
  /\b(legal\s+case|sue\s+them|lawsuit\s+advice|custody\s+court)\b/i,
  /\b(invest\s+money\s+in|crypto\s+advice|financial\s+portfolio)\b/i,
];

const PROPHECY_COERCION_PATTERNS = [
  /\btell\s+me\s+my\s+future\b/i,
  /\bwhat\s+does\s+god\s+say\s+will\s+happen\s+to\s+me\s+tomorrow\b/i,
  /\bprophesy\s+over\s+me\b/i,
  /\bwho\s+will\s+i\s+marry\b/i,
  /\bgive\s+me\s+a\s+direct\s+revelation\b/i,
];

export function evaluateSafety(input: string): SafetyCheckResult {
  const text = input.trim();

  // 1. Crisis Check
  const crisisMatched = CRISIS_PATTERNS.filter(pattern => pattern.test(text));
  if (crisisMatched.length > 0) {
    return {
      isCrisis: true,
      isMedicalOrLegal: false,
      isProphecyRefusal: false,
      flaggedKeywords: crisisMatched.map(p => p.source),
      crisisResponse: `Beloved, I hear how deeply you are hurting right now, and I want you to know with certainty that your life is precious and you do not have to carry this immense pain alone.\n\nBecause I am an AI assistant and not a human caregiver or emergency responder, please connect right now with someone who can support you safely in this exact moment:`,
      hotlines: [
        {
          name: "988 Suicide & Crisis Lifeline",
          contact: "Call or text 988 (USA & Canada)",
          description: "Free, confidential, 24/7 support by trained crisis counselors.",
        },
        {
          name: "Crisis Text Line",
          contact: "Text HOME to 741741",
          description: "Connect with a volunteer crisis counselor 24/7.",
        },
        {
          name: "The Trevor Project",
          contact: "1-866-488-7386 or text START to 678-678",
          description: "24/7 confidential crisis support.",
        },
        {
          name: "National Domestic Violence Hotline",
          contact: "1-800-799-SAFE (7233) or text START to 88788",
          description: "Free, confidential support for anyone experiencing relationship abuse.",
        },
      ],
    };
  }

  // 2. Prophecy / Manipulation / Future Telling
  if (PROPHECY_COERCION_PATTERNS.some(pattern => pattern.test(text))) {
    return {
      isCrisis: false,
      isMedicalOrLegal: false,
      isProphecyRefusal: true,
    };
  }

  // 3. Medical / Legal Check
  const isMedOrLegal = MEDICAL_LEGAL_PATTERNS.some(pattern => pattern.test(text));

  return {
    isCrisis: false,
    isMedicalOrLegal: isMedOrLegal,
    isProphecyRefusal: false,
  };
}
