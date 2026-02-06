import { bandcamp, ytmusic } from "@/lib/yt-dlp";
import { spawn } from "bun";
import { Hono } from "hono";
import { PinoLogger } from "hono-pino";
import { streamSSE } from "hono/streaming";
const download = new Hono();

const name = "possumm";

const getConfig = async (url: string) => {
  let platform: "youtube" | "bandcamp" | null = null;
  let media: "single" | "album" | null = null;

  const isYouTube =
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("music.youtube.com");
  const isBandcamp = url.includes("bandcamp.com");
  const supported = isYouTube || isBandcamp;

  if (!supported) {
    throw new Error("URL not supported.");
  }

  if (isYouTube) {
    const isAlbum = url.includes("playlist?list=");
    //sample url: https://www.youtube.com/playlist?list=OLAK5uy_kh8n9s2l7j6m8a3g4z5v6w7x8y9z0a
    const isSingle = url.includes("watch?v=") || url.includes("youtu.be/");
    //sample url: https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ

    if (!isAlbum && !isSingle) {
      throw new Error("YouTube URL must be a single video or a playlist.");
    }

    platform = "youtube";
    media = isAlbum ? "album" : isSingle ? "single" : null;
  }

  if (isBandcamp) {
    const isAlbum = url.includes("/album/");
    const isSingle = url.includes("/track/");

    if (!isAlbum && !isSingle) {
      throw new Error("Bandcamp URL must be a single track or an album.");
    }

    platform = "bandcamp";
    media = isAlbum ? "album" : isSingle ? "single" : null;
  }

  return { platform, media };
};

const getMetadata = async (url: string,logger:PinoLogger) => {
  const process = spawn(
    [
      "yt-dlp",
      "--js-runtime",
      "bun",
      "--skip-download",
      "--dump-json",
      "--flat-playlist",
      "%(uploader|title)s/%(album,title)s/%(playlist_index|01)02d %(title)s.%(ext)s",
      url,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const text = await new Response(process.stdout).text();
  const lines = text.trim().split("\n").filter(line => line.length > 0);
  console.log("Metadata lines:", lines);

  try {
    const entries = lines.map(line => JSON.parse(line));
    console.log("Parsed metadata entries:", entries);
    if (entries.length === 0) throw new Error("No metadata found");
    const first = entries[0];
    return {
      
      title: first.title ?? null,
      artist: (first.artist || first.uploader) ?? null,
      album: first.album ?? null,
      album_artist: first.album_artist ?? null,
      year: first.release_year ?? first.upload_date?.slice(0, 4) ?? null,
      cover: first.thumbnail ?? null,
      duration: first.duration ?? null,
      tracks: first.entries?.map((entry: any) => ({
        track: entry.playlist_index ?? entry.track_number ?? null,
        title: entry.title ?? null,
        duration: entry.duration ?? null,
      })) ?? null,
      platform: first.uploader ?? null,
    }
  } catch (error) {
    throw new Error("Failed to parse metadata.");
  }
};

download.get("/download", async (c) => {
  const url = c.req.query("url");

  if (!url) return c.json({ message: "URL is required" }, 400);

  const { platform, media } = await getConfig(url);

  if (!platform || !media) {
    return c.json({ message: "URL not supported." }, 400);
  }

  const metadata = await getMetadata(url, c.var.logger);

  return streamSSE(c, async (stream) => {
    stream.write(`[${name}]: Starting download process...\n\n`);
    stream.write(`[${name}]: URL: ${url}\n`);
    stream.write(`[${name}]: Platform: ${platform}\n\n`);
    stream.write(`[${name}]: Media type: ${media}\n\n`);

    stream.write(`[${name}]: Metadata:\n`);
    stream.write(`[${name}]: Title: ${metadata.title}\n`);
    stream.write(`[${name}]: Artist: ${metadata.artist}\n`);
    stream.write(`[${name}]: Album: ${metadata.album}\n`);
    stream.write(`[${name}]: Album Artist: ${metadata.album_artist}\n`);
    stream.write(`[${name}]: Year: ${metadata.year}\n`);
    stream.write(`[${name}]: Cover URL: ${metadata.cover}\n`);
    stream.write(`[${name}]: Duration: ${metadata.duration}\n`);
    if (metadata.tracks) {
      stream.write(`[${name}]: Tracks:\n`);
      metadata.tracks.forEach((track) => {
        stream.write(
          `[${name}]:   ${track.track}. ${track.title} (${track.duration}s)\n`,
        );
      });
    }
    stream.write(`\n`);

    c.var.logger.info("Starting download of: %s", url);
    c.var.logger.info("Detected platform: %s", platform);
    c.var.logger.info("Detected media type: %s", media);

    const command = platform === "bandcamp" ? bandcamp : ytmusic;
    stream.write(`[${name}]: Downloading...\n\n`);

    // const process = spawn([...command, url], {
    //   stdout: "pipe",
    //   stderr: "pipe",
    // });

    // const reader = process.stdout.getReader();
    // const decoder = new TextDecoder();

    // while (true) {
    //   const { done, value } = await reader.read();
    //   if (done) break;
    //   const text = decoder.decode(value);
    //   const lines = text.split("\n");

    //   for (const line of lines) {
    //     if (line.trim()) {
    //       stream.write(`[${name}]: ${line}\n`);
    //     }
    //   }
    // }

    stream.write(`[${name}]: Download process finished.\n\n`);
  });
});

export default download;
