import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/track-record", "/responsible-gambling"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "daily" as const,
  }));
}
