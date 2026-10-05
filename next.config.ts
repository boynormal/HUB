import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // LINE's preview crawler is not in Next's default list, so it would miss the card tags.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Linespider|line-poker/i,
};

export default nextConfig;
