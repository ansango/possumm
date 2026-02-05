import { bandcamp, ytmusic } from "@/lib/yt-dlp";
import { spawn } from "bun";
import { Hono } from "hono";
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

download.get("/download", async (c) => {
  const url = c.req.query("url");

  if (!url) return c.json({ message: "URL is required" }, 400);

  const { platform, media } = await getConfig(url);

  if (!platform || !media) {
    return c.json({ message: "URL not supported." }, 400);
  }

  return streamSSE(c, async (stream) => {

    stream.write(`[${name}]: Starting download process...\n\n`);
    stream.write(`[${name}]: URL: ${url}\n`);
    stream.write(`[${name}]: Platform: ${platform}\n\n`);
    stream.write(`[${name}]: Media type: ${media}\n\n`);

    c.var.logger.info("Starting download of: %s", url);
    c.var.logger.info("Detected platform: %s", platform);
    c.var.logger.info("Detected media type: %s", media);

    const command = platform === "bandcamp" ? bandcamp : ytmusic;
    stream.write(`[${name}]: Downloading...\n\n`);

    const process = spawn([...command, url], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const reader = process.stdout.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.trim()) {
          stream.write(`[${name}]: ${line}\n`);
        }
      }
    }

    stream.write(`[${name}]: Download process finished.\n\n`);
  });
});

export default download;
