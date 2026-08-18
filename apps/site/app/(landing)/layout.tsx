import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WhitelistModal } from "@/components/whitelist-modal";
import { BookingModal } from "@/components/booking-modal";
import { DevModeDetector } from "@/components/dev-mode-detector";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { MotionProvider } from "@/components/ui/motion-provider";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <SmoothScroll />
      <Suspense>
        <DevModeDetector />
      </Suspense>
      <Navbar />
      <main className="relative flex-1">{children}</main>
      <Footer />
      <WhitelistModal />
      <BookingModal />
    </MotionProvider>
  );
}
