import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { SkipLink } from "@/components/layout/SkipLink";
import { VisitBeacon } from "@/components/layout/VisitBeacon";
import { schoolJsonLd } from "@/lib/school-info";
import { SITE_URL } from "@/lib/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  // structured data (school name, address, telephone — nothing else); static config, "<" escaped
  const ld = JSON.stringify(schoolJsonLd(SITE_URL)).replace(/</g, "\\u003c");
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Navbar />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      <ScrollTop />
      <VisitBeacon />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
    </div>
  );
}
