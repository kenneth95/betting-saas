import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public, indexable pages only (the app sections are noindexed via robots.ts).
const PAGES: Array<[path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number]> = [
  ["", "daily", 1],
  ["/picks", "daily", 0.9],
  ["/track-record", "daily", 0.8],
  ["/pricing", "monthly", 0.7],
  ["/how-it-works", "monthly", 0.6],
  ["/faq", "monthly", 0.5],
  ["/about", "monthly", 0.4],
  ["/contact", "monthly", 0.4],
  ["/responsible-gambling", "monthly", 0.4],
  ["/terms", "monthly", 0.2],
  ["/privacy", "monthly", 0.2],
  ["/refunds", "monthly", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
