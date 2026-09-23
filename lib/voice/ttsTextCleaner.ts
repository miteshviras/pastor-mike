// Converts LLM/template-generated text (which may contain markdown, emoji, bible-verse
// references, and other display-oriented formatting) into plain speakable prose before it
// reaches TTS. Mirrored in server/kittentts_adapter.py's clean_speech_text() for the Python
// CLI path — keep both in sync if you change the rules here.
//
// ponytail: deliberately does NOT expand abbreviations ("AI" -> "A I") or convert digits to
// words — modern TTS engines already handle plain numbers/abbreviations reasonably. Add that
// only if real testing surfaces an actual mispronunciation, not preemptively.

// ️ (variation selector-16) forces emoji presentation on characters like U+2764 "❤" that
// otherwise default to text presentation — without it here, removing the base character alone
// leaves a stray orphaned selector behind.
const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}️]/gu;
const INVISIBLE_UNICODE_PATTERN = /[​‌‍‎‏﻿­]/g;

// <Book Name> <chapter>:<verse>(-<verse>) -> spoken form, e.g. "Jeremiah 29:11" ->
// "Jeremiah chapter 29, verse 11". A general pattern match, not an exhaustive 66-book parser.
// The digit-prefix and its separating space are one optional unit (`(?:[1-3]\s)?`) rather than
// two independently-optional pieces — otherwise the lone `\s?` swallows the space before a
// book name with no digit prefix (e.g. "and Psalm 23:1" -> "andPsalm chapter 23...").
const BIBLE_REFERENCE_PATTERN = /\b((?:[1-3]\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?/g;

function convertBibleReferences(text: string): string {
  return text.replace(BIBLE_REFERENCE_PATTERN, (_match, book: string, chapter: string, verse: string, endVerse?: string) => {
    const versePart = endVerse ? `verses ${verse} through ${endVerse}` : `verse ${verse}`;
    return `${book.trim()} chapter ${chapter}, ${versePart}`;
  });
}

// Line-oriented rules: headers, blockquotes, bullet/numbered lists, tables, and decorative
// separators all need to be read as whole lines, not caught mid-line by inline regexes.
function convertLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      out.push("");
      continue;
    }

    // Decorative separator lines: ---, ***, ___, ===, •••, >>>
    if (/^[-*_=•>]{3,}$/.test(line)) continue;

    // Markdown table separator row: |---|---|
    if (/^[\s|:-]+$/.test(line) && line.includes("|")) continue;

    const headerMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headerMatch) {
      out.push(headerMatch[1].trim());
      continue;
    }

    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      out.push(quoteMatch[1].trim());
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      out.push(/[.!?]$/.test(item) ? item : `${item}.`);
      continue;
    }

    const numberedMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (numberedMatch) {
      const item = numberedMatch[1].trim();
      out.push(/[.!?]$/.test(item) ? item : `${item}.`);
      continue;
    }

    if (line.includes("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      out.push(cells.join(", "));
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

export function cleanTextForTTS(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Code fences and inline code — not speakable, drop entirely.
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");
  cleaned = cleaned.replace(/`([^`]*)`/g, "$1");

  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  cleaned = convertLines(cleaned);

  // Markdown images/links -> link text only; bare URLs -> dropped.
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/https?:\/\/\S+/g, "");

  // Bold/italic/underline emphasis markers.
  cleaned = cleaned.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.+?)\*/g, "$1");
  cleaned = cleaned.replace(/__(.+?)__/g, "$1");
  cleaned = cleaned.replace(/_(.+?)_/g, "$1");

  cleaned = convertBibleReferences(cleaned);

  cleaned = cleaned.replace(EMOJI_PATTERN, "");
  cleaned = cleaned.replace(INVISIBLE_UNICODE_PATTERN, "");

  // Repeated punctuation collapse — also fixes trailing "trail off" ellipses
  // ("God bless you..." -> "God bless you.").
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/!{2,}/g, "!");
  cleaned = cleaned.replace(/\?{2,}/g, "?");
  cleaned = cleaned.replace(/,{2,}/g, ",");

  // Collapse to one continuous speakable stream — TTS reads it aloud, it doesn't see lines.
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  cleaned = cleaned.replace(/[ \t]+/g, " ").trim();

  return cleaned;
}
