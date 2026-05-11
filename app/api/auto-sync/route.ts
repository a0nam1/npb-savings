import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";
const NPB_LEAGUE_ID = "4591";

type SportsDbEvent = {
  idEvent?: string;
  dateEvent?: string;
  strTime?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
};

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

function normalizeTeamName(name: string): string {
  return TEAM_NAME_MAP[name] ?? name;
}

function toJapaneseTeamName(name: string): string {
  return REVERSE_TEAM_NAME_MAP[name] ?? name;
}

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .replace(/’/g, "'")
    .trim();
}

function isSameTeam(a: string, b: string): boolean {
  const aa = normalizeLoose(a);
  const bb = normalizeLoose(b);
  return aa === bb || aa.includes(bb) || bb.includes(a);
}

function isKnownNpbTeam(name: string): boolean {
  return NPB_ENGLISH_NAMES.some((team) => isSameTeam(team, name));
}

function parseEventTimestamp(event: SportsDbEvent): number {
  const datePart = event.dateEvent ?? "1970-01-01";
  const timePart = event.strTime ?? "00:00:00";
  return new Date(`${datePart}T${timePart}`).getTime();
}

function isCompletedEvent(event: SportsDbEvent): boolean {
  const homeScore = Number(event.intHomeScore);
  const awayScore = Number(event.intAwayScore);
  return !Number.isNaN(homeScore) && !Number.isNaN(awayScore);
}

function isValidNpbEvent(
  event: SportsDbEvent,
  favoriteTeamEnglish: string
): boolean {
  const home = event.strHomeTeam ?? "";
  const away = event.strAwayTeam ?? "";

  const bothAreNpbTeams = isKnownNpbTeam(home) && isKnownNpbTeam(away);
  const involvesFavorite =
    isSameTeam(favoriteTeamEnglish, home) || isSameTeam(favoriteTeamEnglish, away);

  return bothAreNpbTeams && involvesFavorite;
}

async function fetchLeaguePastEvents(): Promise<SportsDbEvent[]> {
  const url = `${BASE_URL}/eventspastleague.php?id=${NPB_LEAGUE_ID}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return [];
  }

  const data: unknown = await res.json();

  if (
    typeof data === "object" &&
    data !== null &&
    "events" in data &&
    Array.isArray((data as { events: unknown }).events)
  ) {
    return (data as { events: SportsDbEvent[] }).events;
  }

  return [];
}

function convertEventToGame(
  event: SportsDbEvent,
  favoriteTeamEnglish: string
) {
  const home = event.strHomeTeam ?? "";
  const away = event.strAwayTeam ?? "";
  const isHome = isSameTeam(favoriteTeamEnglish, home);

  const teamScore = Number(isHome ? event.intHomeScore : event.intAwayScore);
  const opponentScore = Number(isHome ? event.intAwayScore : event.intHomeScore);
  const opponentRaw = isHome ? away : home;

  return {
    sourceGameId: event.idEvent,
    date: event.dateEvent,
    opponent: toJapaneseTeamName(opponentRaw),
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
    const allEvents = await fetchLeaguePastEvents();

    const filteredEvents = allEvents.filter((event) =>
      isValidNpbEvent(event, favoriteTeamEnglish)
    );

    const completedEvents = filteredEvents
      .filter(isCompletedEvent)
      .filter((event, index, arr) => {
        return arr.findIndex((e) => e.idEvent === event.idEvent) === index;
      })
      .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));

    if (completedEvents.length === 0) {
      return NextResponse.json({
        games: [],
        message: "結果確定済みの試合がありません",
        debug: {
          favoriteTeam,
          favoriteTeamEnglish,
          leagueId: NPB_LEAGUE_ID,
          allEventsCount: allEvents.length,
          filteredCount: filteredEvents.length,
          completedCount: 0,
        },
      });
    }

    const games = completedEvents.map((event) =>
      convertEventToGame(event, favoriteTeamEnglish)
    );

    return NextResponse.json({
      games,
      debug: {
        favoriteTeam,
        favoriteTeamEnglish,
        leagueId: NPB_LEAGUE_ID,
        allEventsCount: allEvents.length,
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