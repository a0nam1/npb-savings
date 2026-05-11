import { NextRequest, NextResponse } from "next/server";

type ParsedGame = {
  sourceGameId: string;
  date: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  teamName: string;
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

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toIsoDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function makeStableGameKey(
  date: string,
  teamA: string,
  teamB: string,
  scoreA: number,
  scoreB: number,
): string {
  const teams = [teamA, teamB].sort().join("__");
  const scores = [scoreA, scoreB].sort((a, b) => a - b).join("__");
  return `${date}__${teams}__${scores}`;
}

function buildMonthlyUrl(season: string, month: number): string {
  return `https://npb.jp/games/${season}/schedule_${String(month).padStart(2, "0")}_detail.html`;
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

function createParsedGame(
  leftAlias: string,
  leftScoreRaw: string,
  rightScoreRaw: string,
  rightAlias: string,
  favoriteTeam: string,
  date: string,
): ParsedGame | null {
  const leftTeam = ALIAS_TO_FULLNAME[leftAlias];
  const rightTeam = ALIAS_TO_FULLNAME[rightAlias];
  const leftScore = Number(leftScoreRaw);
  const rightScore = Number(rightScoreRaw);

  if (!leftTeam || !rightTeam) return null;
  if (Number.isNaN(leftScore) || Number.isNaN(rightScore)) return null;
  if (leftTeam !== favoriteTeam && rightTeam !== favoriteTeam) return null;

  const isLeftFavorite = leftTeam === favoriteTeam;

  return {
    sourceGameId: makeStableGameKey(date, leftTeam, rightTeam, leftScore, rightScore),
    date,
    opponent: isLeftFavorite ? rightTeam : leftTeam,
    teamScore: isLeftFavorite ? leftScore : rightScore,
    opponentScore: isLeftFavorite ? rightScore : leftScore,
    teamName: favoriteTeam,
  };
}

function splitByDateSections(monthText: string, season: string): Array<{ date: string; text: string }> {
  const dateRegex = /(\d{1,2})\/(\d{1,2})（[^）]+）/g;
  const matches = Array.from(monthText.matchAll(dateRegex));

  const sections: Array<{ date: string; text: string }> = [];
  if (matches.length === 0) return sections;

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? monthText.length;

    const month = current[1];
    const day = current[2];
    const date = toIsoDate(season, month, day);
    const text = monthText.slice(start, end);

    sections.push({ date, text });
  }

  return sections;
}

function parseGamesFromDateSection(
  sectionText: string,
  favoriteTeam: string,
  date: string,
): ParsedGame[] {
  const aliasPattern = ALL_ALIASES.map(escapeRegExp).join("|");

  // 月別詳細ページは「チーム名」「スコア」「相手チーム」がこの並びで出る
  const gameRegex = new RegExp(
    `(${aliasPattern})\\s+(\\d+)\\s*-\\s*(\\d+)\\s+(${aliasPattern})`,
    "g",
  );

  const games: ParsedGame[] = [];
  let match: RegExpExecArray | null;

  while ((match = gameRegex.exec(sectionText)) !== null) {
    const parsed = createParsedGame(
      match[1],
      match[2],
      match[3],
      match[4],
      favoriteTeam,
      date,
    );
    if (parsed) {
      games.push(parsed);
    }
  }

  return games;
}

function parseGamesFromMonthlyHtml(
  html: string,
  favoriteTeam: string,
  season: string,
): ParsedGame[] {
  const text = normalizeSpace(stripTags(html));

  // 「##### 3月」以降の本文だけを主対象にする
  const bodyStart = text.indexOf("月日 対戦カード 球場・開始時間");
  const bodyText = bodyStart >= 0 ? text.slice(bodyStart) : text;

  const sections = splitByDateSections(bodyText, season);
  const allGames: ParsedGame[] = [];

  for (const section of sections) {
    allGames.push(...parseGamesFromDateSection(section.text, favoriteTeam, section.date));
  }

  return allGames;
}

function dedupeGames(games: ParsedGame[]): ParsedGame[] {
  const map = new Map<string, ParsedGame>();
  for (const game of games) {
    if (!map.has(game.sourceGameId)) {
      map.set(game.sourceGameId, game);
    }
  }
  return Array.from(map.values());
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");
  const season = req.nextUrl.searchParams.get("season") ?? String(new Date().getFullYear());

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  if (!(favoriteTeam in TEAM_ALIASES)) {
    return NextResponse.json({ error: "unsupported team name" }, { status: 400 });
  }

  try {
    // 2026年公式戦開幕は 3/27。3月からシーズン終盤の11月まで月別詳細を読む
    const months = [3, 4, 5, 6, 7, 8, 9, 10, 11];
    const collectedGames: ParsedGame[] = [];

    for (const month of months) {
      const url = buildMonthlyUrl(season, month);
      const html = await fetchHtml(url);
      const monthlyGames = parseGamesFromMonthlyHtml(html, favoriteTeam, season);
      collectedGames.push(...monthlyGames);
    }

    const dedupedGames = dedupeGames(collectedGames).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.sourceGameId.localeCompare(a.sourceGameId);
    });

    if (dedupedGames.length === 0) {
      return NextResponse.json({
        games: [],
        message: "NPB公式サイトから結果を取得できませんでした",
        debug: {
          favoriteTeam,
          season,
          monthsScanned: months,
          rawCount: collectedGames.length,
          dedupedCount: 0,
        },
      });
    }

    return NextResponse.json({
      games: dedupedGames,
      debug: {
        favoriteTeam,
        season,
        monthsScanned: months,
        rawCount: collectedGames.length,
        dedupedCount: dedupedGames.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        games: [],
        message: "route error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}