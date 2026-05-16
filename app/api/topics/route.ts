import { NextRequest, NextResponse } from "next/server";

type TopicVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelLabel: string;
  watchUrl: string;
  embedUrl: string;
};

type TodayGameApiResponse = {
  today?: {
    hasGame?: boolean;
    opponent?: string;
    venue?: string;
    startTime?: string;
  };
};

const PACIFIC_TEAMS = new Set([
  "オリックス・バファローズ",
  "福岡ソフトバンクホークス",
  "北海道日本ハムファイターズ",
  "千葉ロッテマリーンズ",
  "東北楽天ゴールデンイーグルス",
  "埼玉西武ライオンズ",
]);

const TEAM_KEYWORDS: Record<string, string[]> = {
  "オリックス・バファローズ": ["オリックス", "バファローズ"],
  "福岡ソフトバンクホークス": ["ソフトバンク", "ホークス"],
  "北海道日本ハムファイターズ": ["日本ハム", "ファイターズ"],
  "千葉ロッテマリーンズ": ["ロッテ", "マリーンズ"],
  "東北楽天ゴールデンイーグルス": ["楽天", "イーグルス"],
  "埼玉西武ライオンズ": ["西武", "ライオンズ"],
  "阪神タイガース": ["阪神", "タイガース"],
  "読売ジャイアンツ": ["巨人", "ジャイアンツ", "読売"],
  "横浜DeNAベイスターズ": ["DeNA", "ベイスターズ", "横浜"],
  "広島東洋カープ": ["広島", "カープ"],
  "東京ヤクルトスワローズ": ["ヤクルト", "スワローズ"],
  "中日ドラゴンズ": ["中日", "ドラゴンズ"],
};

const DEFAULT_PATV_CHANNEL_ID = "UC0v-pxTo1XamIDE-f__Ad0Q";
const DAZN_BASEBALL_CHANNEL_ID = "UCyeDNNizMGbVsn_8Ttc3FIw";
const JSPORTS_BASEBALL_CHANNEL_ID = "UCfWaYoWWSlY-K2TJU0UW-pQ";

type SourceInfo = {
  source: "pacific" | "dazn" | "jsports";
  channelId: string;
  channelLabel: string;
};

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function getTeamKeywords(team: string): string[] {
  return TEAM_KEYWORDS[team] ?? [team];
}

function buildVideoQueries(team: string, opponent?: string): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const teamKeywords = getTeamKeywords(team);
  const opponentKeywords = opponent ? getTeamKeywords(opponent) : [];
  const primaryTeam = teamKeywords[0];
  const primaryOpponent = opponentKeywords[0] ?? "";

  const queries = [
    `${primaryTeam} ${primaryOpponent} ハイライト ${month}月${day}日 プロ野球`,
    `${primaryTeam} ${primaryOpponent} ハイライト プロ野球`,
    `${primaryTeam} ハイライト ${month}月${day}日 プロ野球`,
    `${primaryTeam} ハイライト プロ野球`,
  ];

  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function getTodayGameInfo(origin: string, team: string): Promise<TodayGameApiResponse | null> {
  try {
    const url = `${origin}/api/today-game?team=${encodeURIComponent(team)}`;
    return await fetchJson<TodayGameApiResponse>(url);
  } catch {
    return null;
  }
}

function isMazdaHomeVenue(venue?: string): boolean {
  const v = normalizeText(venue);
  return (
    v.includes("マツダ") ||
    v.includes("Mazda") ||
    v.includes("MAZDA") ||
    v.includes("マツダスタジアム")
  );
}

function resolveSource(team: string, todayGame: TodayGameApiResponse | null): SourceInfo {
  if (PACIFIC_TEAMS.has(team)) {
    return {
      source: "pacific",
      channelId: process.env.PATV_YOUTUBE_CHANNEL_ID || DEFAULT_PATV_CHANNEL_ID,
      channelLabel: "PACIFIC LEAGUE TV",
    };
  }

  const todayVenue = todayGame?.today?.venue;
  if (isMazdaHomeVenue(todayVenue)) {
    return {
      source: "jsports",
      channelId: process.env.JSPORTS_YOUTUBE_CHANNEL_ID || JSPORTS_BASEBALL_CHANNEL_ID,
      channelLabel: "J SPORTS 野球【公式】",
    };
  }

  return {
    source: "dazn",
    channelId: process.env.DAZN_BASEBALL_YOUTUBE_CHANNEL_ID || DAZN_BASEBALL_CHANNEL_ID,
    channelLabel: "DAZNベースボール",
  };
}

function scoreVideoTitle(title: string, team: string, opponent?: string): number {
  const normalizedTitle = normalizeText(title);
  let score = 0;

  for (const keyword of getTeamKeywords(team)) {
    if (normalizedTitle.includes(keyword)) score += 5;
  }

  if (opponent) {
    for (const keyword of getTeamKeywords(opponent)) {
      if (normalizedTitle.includes(keyword)) score += 3;
    }
  }

  if (normalizedTitle.includes("ハイライト")) score += 4;
  if (normalizedTitle.includes("プロ野球")) score += 1;
  if (normalizedTitle.includes("J SPORTS STADIUM")) score += 1;
  if (normalizedTitle.includes("DAZN")) score += 1;

  return score;
}

async function searchVideos(
  apiKey: string,
  channelId: string,
  queries: string[],
  team: string,
  opponent: string | undefined,
  channelLabel: string,
): Promise<TopicVideo | null> {
  let best: (TopicVideo & { _score: number }) | null = null;

  for (const query of queries) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("order", "date");
    url.searchParams.set("maxResults", "8");
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);

    const data = await fetchJson<{
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          publishedAt?: string;
          channelTitle?: string;
          thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
          };
        };
      }>;
    }>(url.toString());

    for (const item of data.items ?? []) {
      const videoId = normalizeText(item.id?.videoId);
      const snippet = item.snippet;
      if (!videoId || !snippet) continue;

      const title = normalizeText(snippet.title);
      const score = scoreVideoTitle(title, team, opponent);

      const candidate: TopicVideo & { _score: number } = {
        videoId,
        title,
        publishedAt: normalizeText(snippet.publishedAt),
        thumbnailUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        channelTitle: normalizeText(snippet.channelTitle),
        channelLabel,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        _score: score,
      };

      if (!best || candidate._score > best._score) {
        best = candidate;
      }
    }

    if (best && best._score >= 10) {
      break;
    }
  }

  if (!best) return null;

  const { _score, ...topic } = best;
  return topic;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          topic: null,
          debug: {
            reason: "YOUTUBE_API_KEY is not set",
          },
        },
        { status: 500 },
      );
    }

    const team = normalizeText(
      request.nextUrl.searchParams.get("team") || "オリックス・バファローズ",
    );

    const origin = request.nextUrl.origin;
    const todayGame = await getTodayGameInfo(origin, team);
    const opponent = normalizeText(todayGame?.today?.opponent);

    const sourceInfo = resolveSource(team, todayGame);
    const queries = buildVideoQueries(team, opponent);

    const topic = await searchVideos(
      apiKey,
      sourceInfo.channelId,
      queries,
      team,
      opponent || undefined,
      sourceInfo.channelLabel,
    );

    if (!topic) {
      return NextResponse.json({
        ok: false,
        topic: null,
        debug: {
          team,
          source: sourceInfo.source,
          channelLabel: sourceInfo.channelLabel,
          channelId: sourceInfo.channelId,
          query: queries[0] ?? "",
          usedKeywords: getTeamKeywords(team),
          itemCount: 0,
          reason: "動画が見つかりませんでした",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      topic,
      debug: {
        team,
        source: sourceInfo.source,
        channelLabel: sourceInfo.channelLabel,
        channelId: sourceInfo.channelId,
        query: queries[0] ?? "",
        usedKeywords: getTeamKeywords(team),
        itemCount: 1,
        opponent,
        venue: todayGame?.today?.venue ?? "",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        topic: null,
        debug: {
          reason: message,
        },
      },
      { status: 500 },
    );
  }
}