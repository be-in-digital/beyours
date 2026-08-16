"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Camera,
  Music2,
  Share2,
  Check,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Sparkles,
  ArrowRight,
  RotateCcw,
  User,
  Loader2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WheelOfFortune, type WheelSegment } from "./wheel-of-fortune";
import { ScratchCard } from "./scratch-card";
import { Confetti } from "./confetti";
import { RewardSeal, TicketQr } from "./reward-visuals";

/* ═══════════════════════════════════════════════
   Game demo — a faithful customer journey, reworked to convert.
   The principle: ONE action = ONE play. The action changes on every visit
   (Google review → Instagram → TikTok → referral). The customer comes back
   to play again: that is the loyalty engine.
   ═══════════════════════════════════════════════ */

type Phase = "intro" | "action" | "play" | "result" | "claim" | "ticket";
type GameType = "wheel" | "scratch";

const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: "Café offert", color: "#E8483F", text: "#ffffff" },
  { label: "-10 %", color: "#F5A524", text: "#3A1D00" },
  { label: "Dessert offert", color: "#7C3AED", text: "#ffffff", win: true },
  { label: "Perdu", color: "#2A2139", text: "#B9AECF" },
  { label: "Boisson", color: "#0D9488", text: "#ffffff" },
  { label: "-20 %", color: "#DB2777", text: "#ffffff" },
  { label: "Menu offert", color: "#2563EB", text: "#ffffff" },
  { label: "Rejouer", color: "#1E2A3A", text: "#A7BDD4" },
];
const WIN_INDEX = 2;
const PRIZE = "Dessert offert";

type Visit = {
  key: string;
  icon: typeof Star;
  short: string; // short label (stepper)
  actionLabel: string; // shown inside the phone
  cta: string;
  kind: "google" | "instagram" | "tiktok" | "referral";
  captionTitle: string;
  caption: string;
};

const VISITS: Visit[] = [
  {
    key: "google",
    icon: Star,
    short: "Avis Google",
    actionLabel: "Laissez un avis Google",
    cta: "Donner mon avis",
    kind: "google",
    captionTitle: "Une action, une partie",
    caption:
      "En attendant sa commande, le client scanne le QR. Cette visite, l'action est un avis Google : il tape, part sur votre fiche, laisse son avis, revient. On valide (sans jamais lire les données Google) et il joue. Un avis de plus, c'est jusqu'à +5 à 9 % de chiffre d'affaires (Harvard, Luca 2011).",
  },
  {
    key: "instagram",
    icon: Camera,
    short: "Instagram",
    actionLabel: "Abonnez-vous à notre Instagram",
    cta: "Voir le compte",
    kind: "instagram",
    captionTitle: "Il revient, l'action change",
    caption:
      "Il est déjà venu. Cette fois, l'action est un abonnement Instagram. Vos demandes tournent à chaque visite : vous récoltez avis, abonnés et contacts un par un, sans jamais lasser le client.",
  },
  {
    key: "tiktok",
    icon: Music2,
    short: "TikTok",
    actionLabel: "Suivez-nous sur TikTok",
    cta: "Voir le compte",
    kind: "tiktok",
    captionTitle: "Un levier marketing par visite",
    caption:
      "Troisième passage, troisième levier : TikTok. Chaque visite nourrit un canal différent de votre marketing, et redonne une bonne raison de revenir chez vous.",
  },
  {
    key: "referral",
    icon: Share2,
    short: "Parrainage",
    actionLabel: "Invitez un ami à découvrir Trattoria Nonna",
    cta: "Partager mon lien",
    kind: "referral",
    captionTitle: "L'habitué devient votre commercial",
    caption:
      "Client fidèle : il a déjà tout fait. Désormais, chaque visite lui propose de parrainer un ami pour rejouer. Vos meilleurs clients vous amènent les suivants. La boucle est bouclée.",
  },
];

const CAPTIONS: Record<
  Exclude<Phase, "action">,
  { step: number; title: string; body: string }
> = {
  intro: {
    step: 1,
    title: "À table, il scanne et il joue",
    body: "Le client commande, patiente, et voit le QR sur sa table. Aucune application à installer : le jeu s'ouvre dans le navigateur, à votre image.",
  },
  play: {
    step: 3,
    title: "Il joue, vous gardez la main",
    body: "Roue ou carte à gratter. Vous pilotez le taux de gain depuis votre back-office : vous savez, au centime, ce que vous offrez.",
  },
  result: {
    step: 4,
    title: "Il gagne, il reviendra",
    body: "Un lot à retirer chez vous, c'est une raison concrète de revenir. Un client qui revient, pas une commission versée à une plateforme.",
  },
  claim: {
    step: 5,
    title: "Vous récupérez un contact qualifié",
    body: "Il laisse son email une seule fois, pour recevoir son lot. Il entre dans VOTRE base, opt-in : relances gratuites, à vie, sans intermédiaire.",
  },
  ticket: {
    step: 6,
    title: "Le lot part toujours par email",
    body: "Le QR de retrait est systématiquement envoyé par email, pour qu'il en garde une trace. Il le présente au comptoir, vous le scannez. Puis il revient, pour une nouvelle action et une nouvelle partie.",
  },
};

export function GameDemo() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [gameType, setGameType] = useState<GameType>("wheel");
  const [visitIndex, setVisitIndex] = useState(0);
  const [hasEmail, setHasEmail] = useState(false);

  const visit = VISITS[Math.min(visitIndex, VISITS.length - 1)]!;

  function reset() {
    setPhase("intro");
    setVisitIndex(0);
    setHasEmail(false);
  }

  const caption =
    phase === "action"
      ? { step: 2, title: visit.captionTitle, body: visit.caption }
      : CAPTIONS[phase];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-16">
      {/* ── Phone ── */}
      <div className="mx-auto w-full max-w-[340px]">
        {/* Game picker */}
        <div className="mb-5 flex rounded-full border border-[color:var(--border)] bg-surface-1 p-1 text-sm font-medium">
          {(
            [
              ["wheel", "Roue de la fortune"],
              ["scratch", "Carte à gratter"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setGameType(type);
                if (phase === "result" || phase === "claim" || phase === "ticket")
                  setPhase("play");
              }}
              className={cn(
                "flex-1 rounded-full px-3 py-2 transition-colors",
                gameType === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <PhoneShell visit={visitIndex + 1}>
          <AnimatePresence mode="wait">
            <motion.div
              key={phase + gameType + visit.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex h-full flex-col"
            >
              {phase === "intro" && (
                <IntroScreen onStart={() => setPhase("action")} />
              )}
              {phase === "action" && (
                <ActionStep
                  key={visit.key}
                  visit={visit}
                  onDone={() => setPhase("play")}
                />
              )}
              {phase === "play" && (
                <PlayScreen
                  gameType={gameType}
                  onResult={() => setPhase("result")}
                />
              )}
              {phase === "result" && (
                <ResultScreen
                  onGetPrize={() => setPhase(hasEmail ? "ticket" : "claim")}
                />
              )}
              {phase === "claim" && (
                <ClaimScreen
                  onSubmit={() => {
                    setHasEmail(true);
                    setPhase("ticket");
                  }}
                />
              )}
              {phase === "ticket" && (
                <TicketScreen
                  onNextVisit={() => {
                    setVisitIndex((v) => v + 1);
                    setPhase("action");
                  }}
                  onRestart={reset}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </PhoneShell>
      </div>

      {/* ── Guided legend ── */}
      <div className="lg:pl-4">
        <VisitProgress visitIndex={visitIndex} />
        <AnimatePresence mode="wait">
          <motion.div
            key={phase + visit.key}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35 }}
          >
            <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-primary">
              Étape {caption.step} / 6
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.01em] sm:text-3xl">
              {caption.title}
            </h3>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              {caption.body}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-surface-1 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            Recommencer la démo
          </button>
          <span className="text-xs text-muted-foreground/70">
            Jouez vraiment : réalisez l&apos;action, tournez la roue, grattez la
            carte.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Phone shell ── */
function PhoneShell({
  children,
  visit,
}: {
  children: React.ReactNode;
  visit: number;
}) {
  return (
    <div
      className="relative mx-auto aspect-[9/19] w-full overflow-hidden rounded-[2.4rem] border-[6px] border-[#0c0812] bg-[#120d1a] shadow-[0_40px_90px_-40px_rgba(112,60,34,0.6)]"
      style={{ maxHeight: 640 }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 40% at 50% 0%, rgba(245,165,36,0.16), transparent 60%), radial-gradient(60% 40% at 50% 100%, rgba(124,58,237,0.14), transparent 60%)",
        }}
      />
      <div className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
      <div className="relative z-10 flex h-full flex-col px-4 pb-4 pt-6">
        <GameHeader visit={visit} />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function GameHeader({ visit }: { visit: number }) {
  return (
    <div className="mb-2 flex shrink-0 items-center justify-between text-white/70">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-[11px] font-bold text-amber-300">
          TN
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold text-white">
            Trattoria Nonna
          </p>
          <p className="text-[9px] text-white/50">Table 12</p>
        </div>
      </div>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
        Visite {visit}
      </span>
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-sm font-bold text-[#3A1D00] shadow-[0_10px_30px_-8px_rgba(245,165,36,0.55)] transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="text-5xl"
        >
          🎡
        </motion.div>
        <h3 className="mt-4 bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text font-display text-2xl font-bold text-transparent">
          Tentez votre chance
        </h3>
        <p className="mt-2 px-2 text-[13px] leading-relaxed text-white/60">
          Une petite action, une partie, un cadeau à gagner. À chaque visite.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {["Dessert offert", "-20 %", "Café offert"].map((p) => (
            <span
              key={p}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-amber-200"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
      <PrimaryBtn onClick={onStart}>
        C&apos;est parti
        <ArrowRight className="h-4 w-4" />
      </PrimaryBtn>
    </div>
  );
}

/* ── Action step (ONE action → one play), with a validation simulator ── */

type ActionState = "ask" | "leaving" | "external" | "checking" | "ok";

const KIND_META: Record<
  Visit["kind"],
  { site: string; accent: string }
> = {
  google: { site: "Google", accent: "#4285F4" },
  instagram: { site: "Instagram", accent: "#E1306C" },
  tiktok: { site: "TikTok", accent: "#00f2ea" },
  referral: { site: "votre messagerie", accent: "#c5542c" },
};

function ActionStep({
  visit,
  onDone,
}: {
  visit: Visit;
  onDone: () => void;
}) {
  const [s, setS] = useState<ActionState>("ask");
  const Icon = visit.icon;
  const meta = KIND_META[visit.kind];

  useEffect(() => {
    if (s === "leaving") {
      const t = setTimeout(() => setS("external"), 1000);
      return () => clearTimeout(t);
    }
    if (s === "checking") {
      const t = setTimeout(() => setS("ok"), 2200);
      return () => clearTimeout(t);
    }
  }, [s]);

  if (s === "ask") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-amber-300">
            <Icon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
            Pour jouer
          </p>
          <h3 className="mt-1 px-2 font-display text-lg font-bold leading-snug text-white">
            {visit.actionLabel}
          </h3>
          <p className="mt-2 px-3 text-[12px] leading-relaxed text-white/55">
            Une seule action, et vous tentez votre chance tout de suite.
          </p>
        </div>
        <PrimaryBtn onClick={() => setS("leaving")}>
          {visit.cta}
          <ArrowRight className="h-4 w-4" />
        </PrimaryBtn>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] text-white/40">
          <ShieldCheck className="h-3 w-3" />
          On valide à votre retour. Vos données ne sont jamais lues.
        </p>
      </div>
    );
  }

  if (s === "leaving") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        <p className="mt-4 text-[13px] text-white/70">
          Ouverture de {meta.site}…
        </p>
      </div>
    );
  }

  if (s === "external") {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: meta.accent }}
          />
          Simulation · {meta.site}
        </div>
        <div className="flex flex-1 items-center">
          <ExternalMock kind={visit.kind} onDone={() => setS("checking")} />
        </div>
      </div>
    );
  }

  if (s === "checking") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        <p className="mt-4 text-[13px] font-medium text-white/80">
          Validation de votre action…
        </p>
        <p className="mt-2 px-6 text-[11px] leading-relaxed text-white/45">
          On confirme simplement votre retour. Aucune donnée Google ou réseau
          social n&apos;est collectée.
        </p>
      </div>
    );
  }

  // ok
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-400"
        >
          <CheckCircle2 className="h-9 w-9" />
        </motion.span>
        <h3 className="mt-4 font-display text-xl font-bold text-white">
          Action validée
        </h3>
        <p className="mt-1 text-[12px] text-white/55">
          Merci ! Vous pouvez jouer.
        </p>
      </div>
      <PrimaryBtn onClick={onDone}>
        <Sparkles className="h-4 w-4" />
        Jouer maintenant
      </PrimaryBtn>
    </div>
  );
}

function LightPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl border border-black/5 bg-[#f7f5f2] p-4 text-[#221c15] shadow-[0_10px_30px_-14px_rgba(0,0,0,0.5)]">
      {children}
    </div>
  );
}

function ExternalMock({
  kind,
  onDone,
}: {
  kind: Visit["kind"];
  onDone: () => void;
}) {
  if (kind === "google") {
    return (
      <LightPanel>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold shadow-sm">
            <span className="text-[#4285F4]">G</span>
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-semibold">Trattoria Nonna</p>
            <p className="text-[10px] text-black/50">Noter cet établissement</p>
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className="h-6 w-6 text-amber-400"
              fill="currentColor"
            />
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-black/10 bg-white p-2 text-[11px] text-black/60">
          Super pizza, service au top. Je reviens !
        </div>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 w-full rounded-xl bg-[#1a73e8] py-2.5 text-[12px] font-semibold text-white"
        >
          Publier mon avis
        </button>
      </LightPanel>
    );
  }

  if (kind === "referral") {
    return (
      <LightPanel>
        <p className="text-[12px] font-semibold">Invitez un ami</p>
        <p className="mt-0.5 text-[10px] text-black/50">
          Il découvre le resto, vous rejouez.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-2">
          <span className="flex-1 truncate text-[11px] text-black/70">
            trattoria-nonna.fr/i/AB12
          </span>
          <Copy className="h-3.5 w-3.5 text-black/40" />
        </div>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 w-full rounded-xl bg-[#c5542c] py-2.5 text-[12px] font-semibold text-white"
        >
          J&apos;ai partagé le lien
        </button>
      </LightPanel>
    );
  }

  // instagram / tiktok
  const label = kind === "instagram" ? "Instagram" : "TikTok";
  const handle = "@trattorianonna";
  const accent = kind === "instagram" ? "#E1306C" : "#111111";
  return (
    <LightPanel>
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-full text-white"
          style={{ background: accent }}
        >
          {kind === "instagram" ? (
            <Camera className="h-5 w-5" />
          ) : (
            <Music2 className="h-5 w-5" />
          )}
        </span>
        <div className="leading-tight">
          <p className="text-[12px] font-semibold">{handle}</p>
          <p className="text-[10px] text-black/50">Trattoria Nonna · {label}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 w-full rounded-xl py-2.5 text-[12px] font-semibold text-white"
        style={{ background: accent }}
      >
        Je me suis abonné
      </button>
    </LightPanel>
  );
}

function PlayScreen({
  gameType,
  onResult,
}: {
  gameType: GameType;
  onResult: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      {gameType === "wheel" ? (
        <WheelOfFortune
          segments={WHEEL_SEGMENTS}
          winningIndex={WIN_INDEX}
          onResult={onResult}
        />
      ) : (
        <div className="w-full">
          <p className="mb-3 text-center text-[12px] font-medium text-white/70">
            Grattez pour découvrir votre lot
          </p>
          <ScratchCard won prizeLabel={PRIZE} onRevealed={onResult} />
        </div>
      )}
    </div>
  );
}

function ResultScreen({ onGetPrize }: { onGetPrize: () => void }) {
  return (
    <div className="relative flex h-full flex-col">
      <Confetti show />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
        >
          <RewardSeal size={92} />
        </motion.div>
        <h3 className="mt-5 bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text font-display text-3xl font-bold text-transparent">
          Gagné !
        </h3>
        <p className="mt-1 text-[13px] text-white/60">Vous remportez</p>
        <p className="mt-1 font-display text-xl font-bold text-white">
          {PRIZE}
        </p>
      </div>
      <PrimaryBtn onClick={onGetPrize}>Récupérer mon lot</PrimaryBtn>
    </div>
  );
}

function ClaimScreen({ onSubmit }: { onSubmit: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const valid = email.includes("@") && email.includes(".") && name.length > 1;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="flex h-full flex-col"
    >
      <div className="flex-1">
        <h3 className="text-center font-display text-lg font-bold text-white">
          Recevez votre lot
        </h3>
        <p className="mb-4 text-center text-[11px] text-white/50">
          On vous l&apos;envoie par email pour que vous en gardiez une trace
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
            <User className="h-4 w-4 text-white/40" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre prénom"
              className="w-full bg-transparent py-3 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
            <Mail className="h-4 w-4 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              className="w-full bg-transparent py-3 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40">
          <Sparkles className="h-3 w-3 text-amber-300" />
          Ce contact entre dans votre base client, pas celle d&apos;une
          plateforme.
        </p>
      </div>
      <PrimaryBtn type="submit" disabled={!valid}>
        Recevoir mon lot
      </PrimaryBtn>
    </form>
  );
}

function TicketScreen({
  onNextVisit,
  onRestart,
}: {
  onNextVisit: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl border border-amber-300/25 bg-gradient-to-b from-amber-400/12 to-transparent p-4"
        >
          <div className="flex items-center justify-between border-b border-dashed border-white/15 pb-3">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-amber-300">
                Votre lot
              </p>
              <p className="font-display text-base font-bold text-white">
                {PRIZE}
              </p>
            </div>
            <RewardSeal size={40} />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)]">
              <TicketQr size={76} />
            </div>
            <div className="text-[10px] leading-relaxed text-white/60">
              <p className="font-mono text-[12px] font-bold text-white">
                BID-7K2M9Q
              </p>
              <p className="mt-1">Valable 30 jours</p>
              <p>À présenter au comptoir</p>
            </div>
          </div>
        </motion.div>

        {/* Email-sent confirmation (always shown) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 flex w-full items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-[11px] leading-relaxed text-white/80">
            <span className="font-semibold text-white">
              Email envoyé à jean@email.fr.
            </span>{" "}
            Votre QR code y est aussi : gardez-le, présentez-le au restaurant.
          </p>
        </motion.div>
      </div>

      <div className="mt-3 space-y-2">
        <PrimaryBtn onClick={onNextVisit}>
          Simuler ma prochaine visite
          <ArrowRight className="h-4 w-4" />
        </PrimaryBtn>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white/80"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Recommencer
        </button>
      </div>
    </div>
  );
}

/* ── Visit progression (legend column) ── */

function VisitProgress({ visitIndex }: { visitIndex: number }) {
  const current = Math.min(visitIndex, VISITS.length - 1);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {VISITS.map((v, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = v.icon;
          return (
            <div key={v.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : done
                      ? "border-[color:var(--border)] bg-surface-1 text-muted-foreground"
                      : "border-[color:var(--border)] bg-background text-muted-foreground/50",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {v.short}
              </span>
              {i < VISITS.length - 1 && (
                <span className="h-px w-2 bg-[color:var(--border)]" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground/70">
        Une action par visite. Chaque passage débloque une partie, et vous
        rapporte un avis, un abonné ou un parrainage.
      </p>
    </div>
  );
}
