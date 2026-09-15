import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /* `/admin/` and `/parrainage/dashboard/` added by #535. Both are behind
           a sign-in, so what a crawler could index is the sign-in wall — which
           is worthless in a result page and tells whoever reads the index where
           the console lives. This is a REQUEST, not a control: the layouts
           beneath both paths also carry `robots: { index: false }`, which is
           what travels with a page fetched by a crawler that ignored this. */
        disallow: [
          "/checkout/",
          "/api/",
          "/admin/",
          "/parrainage/dashboard/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
