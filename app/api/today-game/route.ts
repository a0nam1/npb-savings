import { NextRequest, NextResponse } from "next/server";

type TodaySection = {
  hasGame: boolean;
  date: string;
  opponent: string;
  venue: string;
  startTime: string;
  note?: string;
};

type TomorrowStarterSection = {
  hasAnnouncement: boolean;
  date: string;
  opponent: string;
  venue: string;
  startTime: string;
  favoriteStarter: string;
  opponentStarter: string;
  note?: string;
};

type TodayGameApiResponse = {
  today: TodaySection;
  tomorrowStarter: TomorrowStarterSection;
  debug?: {
    team: string;
    year: number;
    month: number;
    todaySource: "monthly-detail" | "none";
    tomorrowSource: "starter" | "monthly-detail" | "none";
  };
};

const TEAM_ALIASES: Record<string, string[]> = {
  "オリックス・バファローズ": ["オリックス", "オリ", "オリックス・バファローズ"],
  "阪神タイガース": ["阪神", "阪神タイガース"],
  "読売ジャイアンツ": ["巨人", "読売", "読売ジャイアンツ", "ジャイアンツ"],
  "横浜DeNAベイスターズ": ["DeNA", "横浜DeNA", "横浜", "ベイスターズ", "横浜DeNAベイスターズ"],
  "広島東洋カープ": ["広島", "広島東洋カープ", "カープ"],
  "東京ヤクルトスワローズ": ["ヤクルト", "東京ヤクルト", "スワローズ", "東京ヤクルトスワローズ"],
  "中日ドラゴンズ": ["中日", "中日ドラゴンズ", "ドラゴンズ"],
  "福岡ソフトバンクホークス": ["ソフトバンク", "福岡ソフトバンク", "ホークス", "福岡ソフトバンクホークス"],
  "北海道日本ハムファイターズ": ["日本ハム", "北海道日本ハム", "日ハム", "ファイターズ", "北海道日本ハムファイターズ"],
  "千葉ロッテマリーンズ": ["ロッテ", "千葉ロッテ", "マリーンズ", "千葉ロッテマリーンズ"],
  "東北楽天ゴールデンイーグルス": ["楽天", "東北楽天", "イーグルス", "東北楽天ゴールデンイーグルス"],
  "埼玉西武ライオンズ": ["西武", "埼玉西武", "ライオンズ", "埼玉西武ライオンズ"],
};

const ALIAS_TO_FULLNAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_ALIASES).flatMap(([full, aliases]) =>
    aliases.map((alias) => [alias, full]),
  ),
);

const ALL_ALIASES = Object.keys(ALIAS_TO_FULLNAME).sort((a, b) => b.length - a.length);

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(html: string): string {
  return normalizeSpace(decodeHtml(html.replace(/<[^>]*>/g, " ")));
}

function canonicalTeamName(name: string): string {
  return ALIAS_TO_FULLNAME[name] ?? name;
}

function toIsoDate(year: number | string, month: number | string, day: number | string): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getJstDate(offsetDays = 0) {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const target = addDays(jstNow, offsetDays);

  return {
    year: target.getFullYear(),
    month: target.getMonth() + 1,
    day: target.getDate(),
    iso: toIsoDate(target.getFullYear(), target.getMonth() + 1, target.getDate()),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${url}`);
  }

  return res.text();
}

function splitByDateSections(monthText: string, season: string): Array<{ date: string; text: string }> {
  const dateRegex = /(\d{1,2})\/(\d{1,2})（[^）]+）/g;
  const matches = Array.from(monthText.matchAll(dateRegex));
  const sections: Array<{ date: string; text: string }> = [];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? monthText.length;

    sections.push({
      date: toIsoDate(season, current[1], current[2]),
      text: monthText.slice(start, end),
    });
  }

  return sections;
}

function splitIntoGameChunks(sectionText: string): string[] {
  const text = normalizeSpace(sectionText);
  const timeRegex = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g;
  const matches = Array.from(text.matchAll(timeRegex));

  if (matches.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  for (const match of matches) {
    const end = (match.index ?? 0) + match[0].length;
    const chunk = normalizeSpace(text.slice(start, end));
    if (chunk) chunks.push(chunk);
    start = end;
  }

  return chunks;
}

function extractVenueBeforeTime(chunk: string, startTime: string): string {
  const idx = chunk.lastIndexOf(startTime);
  if (idx <= 0) return "";

  const beforeTime = normalizeSpace(chunk.slice(0, idx));
  const tokens = beforeTime.split(" ").filter(Boolean);
  if (tokens.length === 0) return "";

  const ignored = new Set([
    ...ALL_ALIASES,
    "vs",
    "VS",
    "対",
    "【",
    "】",
    "-",
  ]);

  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (ignored.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (/^\d+-\d+$/.test(token)) continue;
    if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(token)) continue;
    return token;
  }

  return "";
}

function parseMonthlySectionForGame(
  sectionText: string,
  favoriteTeam: string,
  isoDate: string,
): TodaySection | null {
  const chunks = splitIntoGameChunks(sectionText);
  const favoriteAliases = TEAM_ALIASES[favoriteTeam] ?? [];

  for (const chunk of chunks) {
    const matchedFavoriteAlias = favoriteAliases.find((alias) => chunk.includes(alias));
    if (!matchedFavoriteAlias) continue;

    const timeMatches = Array.from(chunk.matchAll(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\b/g));
    if (timeMatches.length === 0) continue;
    const startTime = timeMatches[timeMatches.length - 1][1];

    const venue = extractVenueBeforeTime(chunk, startTime);

    for (const [opponentTeam, opponentAliases] of Object.entries(TEAM_ALIASES)) {
      if (opponentTeam === favoriteTeam) continue;

      const matchedOpponentAlias = opponentAliases.find((alias) => chunk.includes(alias));
      if (!matchedOpponentAlias) continue;

      return {
        hasGame: true,
        date: isoDate,
        opponent: opponentTeam,
        venue,
        startTime,
      };
    }
  }

  return null;
}

function parseMonthlySectionForTomorrowStarterFallback(
  sectionText: string,
  favoriteTeam: string,
  isoDate: string,
): TomorrowStarterSection | null {
  const chunks = splitIntoGameChunks(sectionText);
  const favoriteAliases = TEAM_ALIASES[favoriteTeam] ?? [];

  for (const chunk of chunks) {
    const matchedFavoriteAlias = favoriteAliases.find((alias) => chunk.includes(alias));
    if (!matchedFavoriteAlias) continue;

    const timeMatches = Array.from(chunk.matchAll(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\b/g));
    if (timeMatches.length === 0) continue;
    const startTime = timeMatches[timeMatches.length - 1][1];

    const venue = extractVenueBeforeTime(chunk, startTime);

    for (const [opponentTeam, opponentAliases] of Object.entries(TEAM_ALIASES)) {
      if (opponentTeam === favoriteTeam) continue;

      const matchedOpponentAlias = opponentAliases.find((alias) => chunk.includes(alias));
      if (!matchedOpponentAlias) continue;

      return {
        hasAnnouncement: true,
        date: isoDate,
        opponent: opponentTeam,
        venue,
        startTime,
        favoriteStarter: "未発表",
        opponentStarter: "未発表",
        note: "予告先発ページから取得できなかったため、日程詳細から補完しています。",
      };
    }
  }

  return null;
}

function parseStarterPageForTargetDate(
  html: string,
  favoriteTeam: string,
  targetDate: { year: number; month: number; day: number; iso: string },
): TomorrowStarterSection | null {
  const text = stripTags(html);
  const heading = `${targetDate.month}月${targetDate.day}日の予告先発投手`;

  if (!text.includes(heading)) {
    return null;
  }

  const teamPattern = ALL_ALIASES
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const regex = new RegExp(
    `(${teamPattern})\\s+([^\\s]+(?:\\s+[^\\s]+){0,2})\\s+(${teamPattern})\\s+([^\\s]+(?:\\s+[^\\s]+){0,2})\\s+（([^）]+)）\\s*((?:[01]?\\d|2[0-3]):[0-5]\\d)`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const leftTeam = canonicalTeamName(match[1]);
    const leftPitcher = normalizeSpace(match[2]);
    const rightTeam = canonicalTeamName(match[3]);
    const rightPitcher = normalizeSpace(match[4]);
    const venue = normalizeSpace(match[5]);
    const startTime = match[6];

    if (leftTeam !== favoriteTeam && rightTeam !== favoriteTeam) continue;

    const isLeftFavorite = leftTeam === favoriteTeam;

    return {
      hasAnnouncement: true,
      date: targetDate.iso,
      opponent: isLeftFavorite ? rightTeam : leftTeam,
      venue,
      startTime,
      favoriteStarter: isLeftFavorite ? leftPitcher : rightPitcher,
      opponentStarter: isLeftFavorite ? rightPitcher : leftPitcher,
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  if (!(favoriteTeam in TEAM_ALIASES)) {
    return NextResponse.json({ error: "unsupported team name" }, { status: 400 });
  }

  const today = getJstDate(0);
  const tomorrow = getJstDate(1);

  try {
    const monthUrl = `https://npb.jp/games/${today.year}/schedule_${String(today.month).padStart(2, "0")}_detail.html`;
    const monthHtml = await fetchHtml(monthUrl);
    const monthText = stripTags(monthHtml);
    const sections = splitByDateSections(monthText, String(today.year));

    const todaySection = sections.find((s) => s.date === today.iso);
    const tomorrowSection = sections.find((s) => s.date === tomorrow.iso);

    const todayGame = todaySection
      ? parseMonthlySectionForGame(todaySection.text, favoriteTeam, today.iso)
      : null;

    const starterHtml = await fetchHtml("https://npb.jp/announcement/starter/");
    let tomorrowStarter = parseStarterPageForTargetDate(starterHtml, favoriteTeam, tomorrow);

    if (!tomorrowStarter && tomorrowSection) {
      tomorrowStarter = parseMonthlySectionForTomorrowStarterFallback(
        tomorrowSection.text,
        favoriteTeam,
        tomorrow.iso,
      );
    }

    const response: TodayGameApiResponse = {
      today:
        todayGame ?? {
          hasGame: false,
          date: today.iso,
          opponent: "",
          venue: "",
          startTime: "",
          note: "本日は試合予定がありません。",
        },
      tomorrowStarter:
        tomorrowStarter ?? {
          hasAnnouncement: false,
          date: tomorrow.iso,
          opponent: "",
          venue: "",
          startTime: "",
          favoriteStarter: "未発表",
          opponentStarter: "未発表",
          note: "翌日の予告先発は未発表です。",
        },
      debug: {
        team: favoriteTeam,
        year: today.year,
        month: today.month,
        todaySource: todayGame ? "monthly-detail" : "none",
        tomorrowSource: tomorrowStarter ? "starter" : "none",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        today: {
          hasGame: false,
          date: today.iso,
          opponent: "",
          venue: "",
          startTime: "",
          note: error instanceof Error ? error.message : String(error),
        },
        tomorrowStarter: {
          hasAnnouncement: false,
          date: tomorrow.iso,
          opponent: "",
          venue: "",
          startTime: "",
          favoriteStarter: "未発表",
          opponentStarter: "未発表",
          note: "翌日の予告先発は取得できませんでした。",
        },
        debug: {
          team: favoriteTeam,
          year: today.year,
          month: today.month,
          todaySource: "none",
          tomorrowSource: "none",
        },
      } satisfies TodayGameApiResponse,
      { status: 500 },
    );
  }
}