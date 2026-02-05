const common = [
  "yt-dlp",
  "--js-runtime",
  "bun", // Solución al error de JS
  "--no-warnings",
  "--cookies-from-browser",
  "firefox",
  "-x",
  "--audio-format",
  "mp3",
  "--audio-quality",
  "0",
  "--embed-thumbnail",
  "--add-metadata",
  "--write-thumbnail",
  "--convert-thumbnails",
  "jpg",
  "--replace-in-metadata",
  "title",
  "^.* - ",
  "",
  "--ppa",
  'ThumbnailsConvertor:-c:v mjpeg -vf crop="ih:ih"',
];

export const bandcamp = [
  ...common,
  "-o",
  "thumbnail:%(uploader|title)s/%(album,title)s/cover.%(ext)s",
  "-o",
  "%(uploader|title)s/%(album,title)s/%(playlist_index|01)02d %(title)s.%(ext)s",
];

export const ytmusic = [
  ...common,

  "--replace-in-metadata", "uploader", " - Topic$", "",
  "--replace-in-metadata", "artist", " - Topic$", "",

  "--parse-metadata", "%(playlist_index|track_number)s:%(track_number)s",
  "--parse-metadata", "%(release_year,upload_date>%Y)s:%(meta_date)s",
  
  "-o", "thumbnail:%(uploader|Unknown)s/%(album|Unknown)s/cover.%(ext)s",
  "-o", "%(uploader|Unknown)s/%(album|Unknown)s/%(playlist_index|01)02d %(title)s.%(ext)s",
];