import { NextRequest, NextResponse } from "next/server";

type ParsedGame = {
  sourceGameId: string;
  date: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
};

const TEAM_ALIASES: Record<string, string[]> = {
  "オリックス・バファローズ": ["オリックス"],
  "阪神タイガース": ["阪神"],
  "読売ジャイアンツ": ["巨人", "読売"],
  "横浜DeNAベイスターズ": ["DeNA", "横浜DeNA"],
  "広島東洋カープ": ["広島"],
  "東京ヤクルトスワローズ": ["ヤクルト"],
  "中日ドラゴンズ": ["中日"],
  "福岡ソフトバンクホークス": ["ソフトバンク"],
  "北海道日本ハムファイターズ": ["日本ハム"],
  "千葉ロッテマリーンズ": ["ロッテ"],
  "東北楽天ゴールデンイーグルス": ["楽天"],
  "埼玉西武ライオンズ": ["西武"],
};

const ALIAS_TO_FULLNAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_ALIASES).flatMap(([full, aliases]) =>
    aliases.map((alias) => [alias, full])
  )
);

const ALL_ALIASES = Object.keys(ALIAS_TO_FULLNAME).sort(
  (a, b) => b.length - a.length
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractPageDate(html: string): string | null {
  const match = html.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return null;
  return toIsoDate(match[1], match[2], match[3]);
}

function extractPrevPageUrl(html: string, currentUrl: string): string | null {
  const match = html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*前の試合\s*<\/a>/);
  if (!match) return null;
  return new URL(match[1], currentUrl).toString();
}

function parseGameSummaryText(
  text: string,
  favoriteTeam: string,
  date: string
): ParsedGame | null {
  const aliasPattern = ALL_ALIASES.map(escapeRegExp).join("|");
  const regex = new RegExp(
    `^(${aliasPattern})\\s+(\\d+)\\s+.*?\\s+(\\d+)\\s+(${aliasPattern})$`
  );

  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(regex);
  if (!match) return null;

  const homeAlias = match[1];
  const homeScore = Number(match[2]);
  const awayScore = Number(match[3]);
  const awayAlias = match[4];

  const homeTeam = ALIAS_TO_FULLNAME[homeAlias];
  const awayTeam = ALIAS_TO_FULLNAME[awayAlias];

  if (!homeTeam || !awayTeam) return null;
  if (homeTeam !== favoriteTeam && awayTeam !== favoriteTeam) return null;

  const isHome = homeTeam === favoriteTeam;

  return {
    sourceGameId: `${date}-${homeTeam}-${awayTeam}`,
    date,
    opponent: isHome ? awayTeam : homeTeam,
    teamScore: isHome ? homeScore : awayScore,
    opponentScore: isHome ? awayScore : homeScore,
  };
}

function extractGamesFromHtml(
  html: string,
  favoriteTeam: string,
  pageUrl: string
): { games: ParsedGame[]; prevUrl: string | null; date: string | null } {
  const date = extractPageDate(html);
  const prevUrl = extractPrevPageUrl(html, pageUrl);

  if (!date) {
    return { games: [], prevUrl, date: null };
  }

  const anchorRegex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const games: ParsedGame[] = [];

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const text = stripTags(match[1]);
    const parsed = parseGameSummaryText(text, favoriteTeam, date);
    if (parsed) {
      games.push(parsed);
    }
  }

  return { games, prevUrl, date };
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
    throw new Error(`fetch failed: ${res.status}`);
  }

  return res.text();
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  if (!(favoriteTeam in TEAM_ALIASES)) {
    return NextResponse.json(
      { error: "unsupported team name" },
      { status: 400 }
    );
  }

  try {
    const year = new Date().getFullYear();
    let pageUrl = `https://npb.jp/bis/${year}/games/`;

    const collectedGames: ParsedGame[] = [];
    const seenIds = new Set<string>();
    const visitedUrls = new Set<string>();

    for (let i = 0; i < 20; i += 1) {
      if (visitedUrls.has(pageUrl)) break;
      visitedUrls.add(pageUrl);

      const html = await fetchHtml(pageUrl);
      const { games, prevUrl } = extractGamesFromHtml(html, favoriteTeam, pageUrl);

      for (const game of games) {
        if (!seenIds.has(game.sourceGameId)) {
          seenIds.add(game.sourceGameId);
          collectedGames.push(game);
        }
      }

      if (collectedGames.length >= 10) break;
      if (!prevUrl) break;

      pageUrl = prevUrl;
    }

    collectedGames.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.sourceGameId.localeCompare(a.sourceGameId);
    });

    if (collectedGames.length === 0) {
      return NextResponse.json({
        games: [],
        message: "NPB公式サイトから結果を取得できませんでした",
        debug: {
          favoriteTeam,
          scannedPages: visitedUrls.size,
          lastPage: pageUrl,
        },
      });
    }

    return NextResponse.json({
      games: collectedGames,
      debug: {
        favoriteTeam,
        scannedPages: visitedUrls.size,
        count: collectedGames.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        games: [],
        message: "route error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}