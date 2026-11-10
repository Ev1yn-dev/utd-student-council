import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { SkipLink } from "@/components/layout/SkipLink";
import { VisitBeacon } from "@/components/layout/VisitBeacon";

// structured data is per page (lib/seo.tsx); the school is the council's parentOrganization on the home page
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <Navbar />
      <main id="main" className="flex-1">{children}</main>
      {/* below the fold: hydrated after the page above it (selective hydration) */}
      <Suspense>
        <Footer />
      </Suspense>
      <ScrollTop />
      <VisitBeacon />
    </div>
  );
}
