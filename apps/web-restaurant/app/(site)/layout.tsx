import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WhitelistModal } from "@/components/whitelist-modal";
import { CalendlyModal } from "@/components/calendly-modal";
import { DevModeDetector } from "@/components/dev-mode-detector";
import { SmoothScroll } from "@/components/ui/smooth-scroll";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      <Suspense>
        <DevModeDetector />
      </Suspense>
      <Navbar />
      <main className="relative flex-1">{children}</main>
      <Footer />
      <WhitelistModal />
      <CalendlyModal />
    </>
  );
}
