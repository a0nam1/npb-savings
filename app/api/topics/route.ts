import { NextRequest, NextResponse } from "next/server";

type TopicResponse = {
  ok: boolean;
  topic: {
    videoId: string;
    title: string;
    publishedAt: string;
    thumbnailUrl: string;
    channelTitle: string;
    watchUrl: string;
    embedUrl: string;
  } | null;
  debug?: {
    team: string;
    query: string;
    usedKeywords: string[];
    itemCount: number;
    reason?: string;
  };
};

const TEAM_KEYWORDS: Record<string, string[]> = {
  "オリックス・バファローズ": ["オリックス", "バファローズ"],
  "阪神タイガース": ["阪神", "タイガース"],
  "読売ジャイアンツ": ["巨人", "読売", "ジャイアンツ"],
  "横浜DeNAベイスターズ": ["DeNA", "横浜", "ベイスターズ"],
  "広島東洋カープ": ["広島", "カープ"],
  "東京ヤクルトスワローズ": ["ヤクルト", "スワローズ"],
  "中日ドラゴンズ": ["中日", "ドラゴンズ"],
  "福岡ソフトバンクホークス": ["ソフトバンク", "ホークス"],
  "北海道日本ハムファイターズ": ["日本ハム", "日ハム", "ファイターズ"],
  "千葉ロッテマリーンズ": ["ロッテ", "マリーンズ"],
  "東北楽天ゴールデンイーグルス": ["楽天", "イーグルス"],
  "埼玉西武ライオンズ": ["西武", "ライオンズ"],
};

const DEFAULT_CHANNEL_ID = "UC0v-pxTo1XamIDE-f__Ad0Q";

function pickBestThumbnail(thumbnails: any): string {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    ""
  );
}

function buildSearchQueries(team: string): string[] {
  const keywords = TEAM_KEYWORDS[team] ?? [team];
  const baseWords = ["ハイライト", "試合ハイライト", "今日のハイライト"];

  const queries: string[] = [];
  for (const keyword of keywords) {
    for (const base of baseWords) {
      queries.push(`${keyword} ${base}`);
    }
  }

  return queries;
}

async function fetchYoutubeSearch(
  apiKey: string,
  channelId: string,
  query: string,
) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`youtube search failed: ${res.status}`);
  }

  return res.json();
}

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get("team") ?? "";
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.PATV_YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

  if (!team) {
    return NextResponse.json({ ok: false, topic: null, debug: { team: "", query: "", usedKeywords: [], itemCount: 0, reason: "team is required" } }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      topic: null,
      debug: {
        team,
        query: "",
        usedKeywords: [],
        itemCount: 0,
        reason: "YOUTUBE_API_KEY is not set",
      },
    } satisfies TopicResponse, { status: 500 });
  }

  try {
    const queries = buildSearchQueries(team);
    const keywords = TEAM_KEYWORDS[team] ?? [team];

    for (const query of queries) {
      const data = await fetchYoutubeSearch(apiKey, channelId, query);
      const items = Array.isArray(data?.items) ? data.items : [];

      const matched = items.find((item: any) => {
        const title = String(item?.snippet?.title ?? "");
        return keywords.some((keyword) => title.includes(keyword));
      });

      if (matched) {
        const videoId = matched?.id?.videoId ?? "";
        const snippet = matched?.snippet ?? {};

        return NextResponse.json({
          ok: true,
          topic: {
            videoId,
            title: snippet.title ?? "",
            publishedAt: snippet.publishedAt ?? "",
            thumbnailUrl: pickBestThumbnail(snippet.thumbnails),
            channelTitle: snippet.channelTitle ?? "",
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
          },
          debug: {
            team,
            query,
            usedKeywords: keywords,
            itemCount: items.length,
          },
        } satisfies TopicResponse);
      }
    }

    return NextResponse.json({
      ok: true,
      topic: null,
      debug: {
        team,
        query: "",
        usedKeywords: TEAM_KEYWORDS[team] ?? [team],
        itemCount: 0,
        reason: "no matched highlight video found",
      },
    } satisfies TopicResponse);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      topic: null,
      debug: {
        team,
        query: "",
        usedKeywords: TEAM_KEYWORDS[team] ?? [team],
        itemCount: 0,
        reason: error instanceof Error ? error.message : String(error),
      },
    } satisfies TopicResponse, { status: 500 });
  }
}