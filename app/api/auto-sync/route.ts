import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

const TEAM_NAME_MAP: Record<string, string> = {
  "オリックス・バファローズ": "Orix Buffaloes",
  "阪神タイガース": "Hanshin Tigers",
  "読売ジャイアンツ": "Yomiuri Giants",
  "横浜DeNAベイスターズ": "Yokohama DeNA BayStars",
  "広島東洋カープ": "Hiroshima Toyo Carp",
  "東京ヤクルトスワローズ": "Tokyo Yakult Swallows",
  "中日ドラゴンズ": "Chunichi Dragons",
  "福岡ソフトバンクホークス": "Fukuoka SoftBank Hawks",
  "北海道日本ハムファイターズ": "Hokkaido Nippon-Ham Fighters",
  "千葉ロッテマリーンズ": "Chiba Lotte Marines",
  "東北楽天ゴールデンイーグルス": "Tohoku Rakuten Golden Eagles",
  "埼玉西武ライオンズ": "Saitama Seibu Lions",
};

const REVERSE_TEAM_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAME_MAP).map(([ja, en]) => [en, ja])
);

const NPB_ENGLISH_NAMES = Object.values(TEAM_NAME_MAP);

function normalizeTeamName(name: string) {
  return TEAM_NAME_MAP[name] ?? name;
}

function toJapaneseTeamName(name: string) {
  return REVERSE_TEAM_NAME_MAP[name] ?? name;
}

function normalizeLoose(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .trim();
}

function isSameTeam(a: string, b: string) {
  const aa = normalizeLoose(a);
  const bb = normalizeLoose(b);
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function isKnownNpbTeam(name: string) {
  return NPB_ENGLISH_NAMES.some((team) => isSameTeam(team, name));
}

function parseEventTimestamp(event: any) {
  const datePart = event?.dateEvent ?? "1970-01-01";
  const timePart = event?.strTime ?? "00:00:00";
  return new Date(`${datePart}T${timePart}`).getTime();
}

function isCompletedEvent(event: any) {
  const homeScore = Number(event?.intHomeScore);
  const awayScore = Number(event?.intAwayScore);
  return !Number.isNaN(homeScore) && !Number.isNaN(awayScore);
}

function isValidNpbEvent(event: any, favoriteTeamEnglish: string) {
  const home = event?.strHomeTeam ?? "";
  const away = event?.strAwayTeam ?? "";

  const involvesFavorite =
    isSameTeam(favoriteTeamEnglish, home) || isSameTeam(favoriteTeamEnglish, away);

  const bothAreNpbTeams = isKnownNpbTeam(home) && isKnownNpbTeam(away);

  return involvesFavorite && bothAreNpbTeams;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchLastEventsByTeamSearch(teamName: string) {
  const searchUrl = `${BASE_URL}/searchteams.php?t=${encodeURIComponent(teamName)}`;
  const searchData = await fetchJson(searchUrl);
  const teams = searchData?.teams ?? [];

  const matchedTeam =
    teams.find((team: any) => {
      const strTeam = team?.strTeam ?? "";
      return isSameTeam(teamName, strTeam);
    }) ?? null;

  if (!matchedTeam?.idTeam) {
    return [];
  }

  const lastUrl = `${BASE_URL}/eventslast.php?id=${encodeURIComponent(matchedTeam.idTeam)}`;
  const lastData = await fetchJson(lastUrl);
  return lastData?.results ?? [];
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function fetchLeagueDayEvents(date: string) {
  const leagueName = "Nippon Baseball League";
  const sportName = "Baseball";

  const url =
    `${BASE_URL}/eventsday.php?d=${date}` +
    `&s=${encodeURIComponent(sportName)}` +
    `&l=${encodeURIComponent(leagueName)}`;

  const data = await fetchJson(url);
  return data?.events ?? [];
}

function convertEventToGame(event: any, favoriteTeamEnglish: string) {
  const isHome = isSameTeam(favoriteTeamEnglish, event?.strHomeTeam ?? "");
  const teamScore = Number(isHome ? event?.intHomeScore : event?.intAwayScore);
  const opponentScore = Number(isHome ? event?.intAwayScore : event?.intHomeScore);
  const opponentRaw = isHome ? event?.strAwayTeam : event?.strHomeTeam;

  return {
    sourceGameId: event?.idEvent,
    date: event?.dateEvent,
    opponent: toJapaneseTeamName(opponentRaw ?? ""),
    teamScore,
    opponentScore,
  };
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  const favoriteTeamEnglish = normalizeTeamName(favoriteTeam);

  try {
    let collectedEvents: any[] = [];

    // 1. チーム検索→直近試合
    const lastEvents = await fetchLastEventsByTeamSearch(favoriteTeamEnglish);
    collectedEvents.push(...lastEvents);

    // 2. 補助としてリーグ日別取得
    const today = new Date();
    const dates = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return formatDate(d);
    });

    for (const date of dates) {
      const dayEvents = await fetchLeagueDayEvents(date);
      collectedEvents.push(...dayEvents);
    }

    // 3. NPB & 推し球団を含む試合だけ残す
    const filteredEvents = collectedEvents.filter((event: any) =>
      isValidNpbEvent(event, favoriteTeamEnglish)
    );

    // 4. 完了済みだけ + 重複除外 + 新しい順
    const completedEvents = filteredEvents
      .filter(isCompletedEvent)
      .filter((event: any, index: number, arr: any[]) => {
        return arr.findIndex((e) => e?.idEvent === event?.idEvent) === index;
      })
      .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));

    if (completedEvents.length === 0) {
      return NextResponse.json({
        games: [],
        message: "結果確定済みの試合がありません",
        debug: {
          favoriteTeam,
          favoriteTeamEnglish,
          collectedCount: collectedEvents.length,
          filteredCount: filteredEvents.length,
          completedCount: 0,
        },
      });
    }

    const games = completedEvents.map((event: any) =>
      convertEventToGame(event, favoriteTeamEnglish)
    );

    return NextResponse.json({
      games,
      debug: {
        favoriteTeam,
        favoriteTeamEnglish,
        collectedCount: collectedEvents.length,
        filteredCount: filteredEvents.length,
        completedCount: completedEvents.length,
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