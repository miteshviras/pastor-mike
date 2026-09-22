export interface ScriptureVerse {
  reference: string;
  book: string;
  chapter: number;
  verse: string;
  text: string;
  translation: "WEB" | "KJV";
  topic: string;
  keywords: string[];
  pastoralContext?: string;
}

export const SCRIPTURE_COLLECTION: ScriptureVerse[] = [
  // --- ANXIETY, WORRY, STRESS & WORK ---
  {
    reference: "Philippians 4:6-7",
    book: "Philippians",
    chapter: 4,
    verse: "6-7",
    text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.",
    translation: "WEB",
    topic: "anxiety",
    keywords: ["anxious", "anxiety", "worry", "overwhelmed", "prayer", "peace", "stress", "work", "calm"],
    pastoralContext: "A reminder to gently hand over our burdens through honest prayer, receiving a peace that defies worldly pressure.",
  },
  {
    reference: "1 Peter 5:7",
    book: "1 Peter",
    chapter: 5,
    verse: "7",
    text: "Casting all your worries on him, because he cares for you.",
    translation: "WEB",
    topic: "anxiety",
    keywords: ["cast", "worries", "worry", "cares", "care", "anxiety", "heavy", "exhausted"],
    pastoralContext: "You do not have to carry the weight alone; God invites you to place every concern into His hands.",
  },
  {
    reference: "Matthew 6:34",
    book: "Matthew",
    chapter: 6,
    verse: "34",
    text: "Therefore do not be anxious about tomorrow, for tomorrow will be anxious for itself. Each day has enough trouble of its own.",
    translation: "WEB",
    topic: "anxiety",
    keywords: ["tomorrow", "anxious", "future", "fear", "work", "deadline", "uncertainty"],
    pastoralContext: "Jesus encourages us to live anchored in today's grace rather than borrowing trouble from tomorrow.",
  },
  {
    reference: "Psalm 94:19",
    book: "Psalms",
    chapter: 94,
    verse: "19",
    text: "In the multitude of my doubts and worries within me, your consolations delight my soul.",
    translation: "WEB",
    topic: "anxiety",
    keywords: ["doubts", "worries", "anxious", "overthinking", "comfort", "soul", "rest"],
    pastoralContext: "When thoughts are racing and overwhelming, God's gentle comfort brings quietness to our spirit.",
  },

  // --- WEARINESS, REST & BURNOUT ---
  {
    reference: "Matthew 11:28-30",
    book: "Matthew",
    chapter: 11,
    verse: "28-30",
    text: "Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you, and learn from me, for I am gentle and lowly in heart; and you will find rest for your souls. For my yoke is easy, and my burden is light.",
    translation: "WEB",
    topic: "rest",
    keywords: ["weary", "tired", "labor", "heavy", "burdened", "burnout", "rest", "work", "exhaustion", "sleep"],
    pastoralContext: "Jesus offers true, deep soul rest for those drained by striving, work pressures, and heavy expectations.",
  },
  {
    reference: "Exodus 33:14",
    book: "Exodus",
    chapter: 33,
    verse: "14",
    text: "He said, 'My presence will go with you, and I will give you rest.'",
    translation: "WEB",
    topic: "rest",
    keywords: ["presence", "rest", "tired", "burnout", "peace", "lonely", "exhausted"],
    pastoralContext: "God does not send us ahead into difficulties alone; His very presence accompanies us with restorative rest.",
  },

  // --- PEACE & CALMNESS ---
  {
    reference: "John 14:27",
    book: "John",
    chapter: 14,
    verse: "27",
    text: "Peace I leave with you. My peace I give to you; not as the world gives, do I give to you. Do not let your heart be troubled, neither let it be fearful.",
    translation: "WEB",
    topic: "peace",
    keywords: ["peace", "calm", "troubled", "fear", "afraid", "serenity", "stillness"],
    pastoralContext: "Christ gives a supernatural peace rooted not in the absence of trouble, but in the certainty of His abiding love.",
  },
  {
    reference: "Isaiah 26:3",
    book: "Isaiah",
    chapter: 26,
    verse: "3",
    text: "You will keep him in perfect peace, whose mind is stayed on you, because he trusts in you.",
    translation: "WEB",
    topic: "peace",
    keywords: ["perfect peace", "peace", "mind", "trust", "calm", "focus", "stability"],
    pastoralContext: "When we fix our attention on God's steadfast character, our minds find calm even in the storm.",
  },
  {
    reference: "Psalm 46:10",
    book: "Psalms",
    chapter: 46,
    verse: "10",
    text: "Be still, and know that I am God. I will be exalted among the nations. I will be exalted in the earth.",
    translation: "WEB",
    topic: "peace",
    keywords: ["be still", "stillness", "quiet", "stop", "striving", "control", "peace"],
    pastoralContext: "An invitation to let down our guard, cease frantic striving, and rest in God's sovereignty.",
  },

  // --- STRENGTH & COURAGE ---
  {
    reference: "Isaiah 40:29-31",
    book: "Isaiah",
    chapter: 40,
    verse: "29-31",
    text: "He gives power to the weak. He increases the strength of him who has no might. Even the youths faint and get weary... but those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.",
    translation: "WEB",
    topic: "strength",
    keywords: ["strength", "weak", "power", "weary", "faint", "renew", "wings", "eagles", "courage"],
    pastoralContext: "When our personal energy is depleted, waiting on God renews our deepest spiritual vitality.",
  },
  {
    reference: "Joshua 1:9",
    book: "Joshua",
    chapter: 1,
    verse: "9",
    text: "Haven’t I commanded you? Be strong and courageous. Do not be afraid, neither be dismayed, for Yahweh your God is with you wherever you go.",
    translation: "WEB",
    topic: "courage",
    keywords: ["strong", "courage", "courageous", "afraid", "dismayed", "fear", "challenge", "new beginning"],
    pastoralContext: "Courage is not the absence of fear, but moving forward knowing God is walking beside you.",
  },
  {
    reference: "2 Corinthians 12:9",
    book: "2 Corinthians",
    chapter: 12,
    verse: "9",
    text: "He has said to me, 'My grace is sufficient for you, for my power is made perfect in weakness.' Most gladly therefore I will rather glory in my weaknesses, that the power of Christ may rest on me.",
    translation: "WEB",
    topic: "strength",
    keywords: ["grace", "sufficient", "weakness", "weak", "power", "inadequacy", "failure", "struggle"],
    pastoralContext: "Our human limitations and vulnerabilities become the very places where God's grace shines brightest.",
  },

  // --- GRIEF, LOSS & HEARTBREAK ---
  {
    reference: "Psalm 34:18",
    book: "Psalms",
    chapter: 34,
    verse: "18",
    text: "Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.",
    translation: "WEB",
    topic: "grief",
    keywords: ["broken heart", "brokenhearted", "crushed", "grief", "loss", "mourning", "sorrow", "pain", "sad"],
    pastoralContext: "God does not stand at a distance from our heartache; in our deepest pain, He draws nearest.",
  },
  {
    reference: "Matthew 5:4",
    book: "Matthew",
    chapter: 5,
    verse: "4",
    text: "Blessed are those who mourn, for they shall be comforted.",
    translation: "WEB",
    topic: "grief",
    keywords: ["mourn", "mourning", "loss", "grief", "death", "crying", "comfort", "tears"],
    pastoralContext: "Tears and grief are sacred; Jesus acknowledges our sorrow and promises divine comfort.",
  },
  {
    reference: "Revelation 21:4",
    book: "Revelation",
    chapter: 21,
    verse: "4",
    text: "He will wipe away from them every tear from their eyes. Death will be no more; neither will there be mourning, nor crying, nor pain, any more. The first things have passed away.",
    translation: "WEB",
    topic: "grief",
    keywords: ["tear", "tears", "death", "mourning", "pain", "loss", "eternal", "hope"],
    pastoralContext: "The ultimate Christian hope: a day when sorrow, sickness, and parting are completely redeemed.",
  },
  {
    reference: "Psalm 23:1-4",
    book: "Psalms",
    chapter: 23,
    verse: "1-4",
    text: "Yahweh is my shepherd: I shall lack nothing. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul... Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
    translation: "WEB",
    topic: "comfort",
    keywords: ["shepherd", "valley", "shadow of death", "fear no evil", "still waters", "soul", "comfort", "psalm 23"],
    pastoralContext: "A timeless prayer of companionship through our darkest valleys into green pastures of restoration.",
  },

  // --- HOPE, PURPOSE & GUIDANCE ---
  {
    reference: "Jeremiah 29:11",
    book: "Jeremiah",
    chapter: 29,
    verse: "11",
    text: "'For I know the thoughts that I think toward you,' says Yahweh, 'thoughts of peace, and not of evil, to give you hope and a future.'",
    translation: "WEB",
    topic: "hope",
    keywords: ["hope", "future", "plans", "purpose", "destiny", "career", "direction", "peace"],
    pastoralContext: "God's overarching heart toward you is for good and redemption, offering steady hope regardless of current setbacks.",
  },
  {
    reference: "Romans 8:28",
    book: "Romans",
    chapter: 8,
    verse: "28",
    text: "We know that all things work together for good for those who love God, to those who are called according to his purpose.",
    translation: "WEB",
    topic: "hope",
    keywords: ["work together", "good", "purpose", "tragedy", "confusion", "trust", "redemption"],
    pastoralContext: "Even painful and confusing seasons can be woven by God's gentle hand into beauty and purpose.",
  },
  {
    reference: "Proverbs 3:5-6",
    book: "Proverbs",
    chapter: 3,
    verse: "5-6",
    text: "Trust in Yahweh with all your heart, and don’t lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
    translation: "WEB",
    topic: "guidance",
    keywords: ["trust", "understanding", "paths", "guidance", "direction", "decision", "choice", "career"],
    pastoralContext: "When the way forward is foggy, trusting God's wisdom step by step brings clarity in due time.",
  },

  // --- FORGIVENESS, GUILT & GRACE ---
  {
    reference: "1 John 1:9",
    book: "1 John",
    chapter: 1,
    verse: "9",
    text: "If we confess our sins, he is faithful and righteous to forgive us our sins, and to cleanse us from all unrighteousness.",
    translation: "WEB",
    topic: "forgiveness",
    keywords: ["forgive", "forgiveness", "confess", "sin", "guilt", "shame", "cleanse", "mistake", "regret"],
    pastoralContext: "No mistake is beyond God's capacity to forgive. When we come with honest humility, His grace cleanses completely.",
  },
  {
    reference: "Romans 8:1",
    book: "Romans",
    chapter: 8,
    verse: "1",
    text: "There is therefore now no condemnation to those who are in Christ Jesus, who don’t walk according to the flesh, but according to the Spirit.",
    translation: "WEB",
    topic: "grace",
    keywords: ["condemnation", "shame", "guilt", "freedom", "grace", "forgiven", "mercy"],
    pastoralContext: "God convicts to heal, but He does not condemn. You can walk free from the crushing weight of past shame.",
  },
  {
    reference: "Psalm 103:11-12",
    book: "Psalms",
    chapter: 103,
    verse: "11-12",
    text: "For as the heavens are high above the earth, so great is his loving kindness toward those who fear him. As far as the east is from the west, so far has he removed our transgressions from us.",
    translation: "WEB",
    topic: "forgiveness",
    keywords: ["loving kindness", "mercy", "east from west", "removed", "forgiven", "past mistakes", "grace"],
    pastoralContext: "God's forgiveness is not halfway; He removes our failures entirely and showers us with tender compassion.",
  },

  // --- LOVE, RELATIONSHIPS & FAMILY ---
  {
    reference: "1 Corinthians 13:4-7",
    book: "1 Corinthians",
    chapter: 13,
    verse: "4-7",
    text: "Love is patient and is kind; love doesn't envy. Love doesn't brag, is not proud, doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil; doesn't rejoice in unrighteousness, but rejoices with the truth; bears all things, believes all things, hopes all things, endures all things.",
    translation: "WEB",
    topic: "love",
    keywords: ["love", "patient", "kind", "marriage", "relationship", "family", "conflict", "endurance", "anger"],
    pastoralContext: "The golden standard of selfless Christ-like love that heals broken relationships and binds families in peace.",
  },
  {
    reference: "Colossians 3:12-14",
    book: "Colossians",
    chapter: 3,
    verse: "12-14",
    text: "Put on therefore, as God’s chosen ones, holy and beloved, a heart of compassion, kindness, lowliness, humility, and perseverance; bearing with one another, and forgiving each other... Above all these things, walk in love, which is the bond of perfection.",
    translation: "WEB",
    topic: "relationships",
    keywords: ["compassion", "kindness", "humility", "forgive", "conflict", "family", "friendship", "unity"],
    pastoralContext: "A practical guide for resolving relational friction with gentle forbearance and unconditional grace.",
  },

  // --- HEALING & SICKNESS ---
  {
    reference: "Jeremiah 17:14",
    book: "Jeremiah",
    chapter: 17,
    verse: "14",
    text: "Heal me, O Yahweh, and I will be healed. Save me, and I will be saved; for you are my praise.",
    translation: "WEB",
    topic: "healing",
    keywords: ["heal", "healing", "sick", "illness", "health", "body", "pain", "doctor", "recovery"],
    pastoralContext: "A simple, heartfelt cry for physical, emotional, and spiritual wholeness from the Great Physician.",
  },
  {
    reference: "James 5:14-16",
    book: "James",
    chapter: 5,
    verse: "14-16",
    text: "Is any among you sick? Let him call for the elders of the assembly, and let them pray over him... The prayer of faith will heal him who is sick... Pray for one another, that you may be healed.",
    translation: "WEB",
    topic: "healing",
    keywords: ["sick", "pray", "prayer", "elders", "healed", "illness", "faith", "community"],
    pastoralContext: "God invites us into community and prayer during seasons of bodily illness and vulnerability.",
  }
];

// Helper to normalize strings for comparison
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getVerseByReference(refQuery: string): ScriptureVerse | null {
  const normQuery = normalize(refQuery);
  for (const item of SCRIPTURE_COLLECTION) {
    if (normalize(item.reference).includes(normQuery) || normQuery.includes(normalize(item.reference))) {
      return item;
    }
    // Also check book + chapter
    const bookChap = normalize(`${item.book}${item.chapter}`);
    if (normQuery === bookChap) {
      return item;
    }
  }
  return null;
}

export function searchScripture(query: string, maxResults = 3): ScriptureVerse[] {
  if (!query || query.trim().length === 0) {
    return SCRIPTURE_COLLECTION.slice(0, maxResults);
  }

  const direct = getVerseByReference(query);
  if (direct) {
    return [direct];
  }

  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = SCRIPTURE_COLLECTION.map((verse) => {
    let score = 0;

    // Check topic
    if (queryTerms.some(t => verse.topic.toLowerCase().includes(t))) {
      score += 10;
    }

    // Check keywords
    for (const term of queryTerms) {
      if (verse.keywords.some(k => k.toLowerCase().includes(term))) {
        score += 5;
      }
      if (verse.text.toLowerCase().includes(term)) {
        score += 3;
      }
      if (verse.reference.toLowerCase().includes(term)) {
        score += 8;
      }
    }

    return { verse, score };
  });

  const filtered = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (filtered.length > 0) {
    return filtered.slice(0, maxResults).map(f => f.verse);
  }

  // Default comforting scriptures if no specific match
  return [
    SCRIPTURE_COLLECTION[0], // Phil 4:6-7
    SCRIPTURE_COLLECTION[4], // Matt 11:28-30
    SCRIPTURE_COLLECTION[6], // John 14:27
  ].slice(0, maxResults);
}
