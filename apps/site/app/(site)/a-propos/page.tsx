import type { Metadata } from "next";
import { CtaSection } from "@/components/cta-section";
import { AboutHero } from "@/components/about/about-hero";
import { MissionSection } from "@/components/about/mission-section";
import { ValuesSection } from "@/components/about/values-section";
import { TeamSection } from "@/components/about/team-section";
import { StorySection } from "@/components/about/story-section";
import { AboutFaqSection } from "@/components/about/about-faq-section";
import { SocialProofSection } from "@/components/social-proof-section";

export const metadata: Metadata = {
  title: "À propos — Be in Digital",
  description:
    "L'équipe derrière Be in Digital : passionnés de restauration et de digital, au service des restaurants indépendants ambitieux.",
  alternates: { canonical: "/a-propos" },
  openGraph: {
    title: "À propos — Be in Digital",
    description:
      "Notre mission : rendre les restaurants indépendants plus autonomes grâce au digital.",
    url: "/a-propos",
    type: "website",
  },
};

export default function AProposPage() {
  return (
    <>
      <AboutHero />
      <StorySection />
      <MissionSection />
      <ValuesSection />
      <SocialProofSection />
      <TeamSection />
      <AboutFaqSection />
      <CtaSection />
    </>
  );
}
