"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import {
  GamepadIcon,
  Gamepad2Icon,
  TrophyIcon,
  TicketCheckIcon,
  QrCodeIcon,
  ListChecksIcon,
  GiftIcon,
  ChevronRightIcon,
  ScanIcon,
} from "lucide-react"
import {
  Badge,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { adminRoutes } from "../../config/admin-routes"

/**
 * Gamification overview: the pulse (stats), the setup surfaces one click
 * away, and the latest plays. Configuration lives on the dedicated pages
 * (Jeux & Lots, Codes QR, Actions, Gagnants) — mirrored in the sidebar.
 */

interface Stats {
  totalPlays: number
  totalWins: number
  winRate: number
  totalRedeemed: number
  pendingRedemptions: number
}

interface GamePlay {
  id: string
  didWin: boolean
  playerName?: string
  playerEmail?: string
  prizeName?: string
  playedAt: number
}

interface Game {
  _id: string
  name: string
  type: "wheel" | "scratch_card"
  isActive: boolean
}

interface QRCode {
  _id: string
  isActive: boolean
  scannedCount?: number
}

interface Prize {
  _id: string
  isActive: boolean
  remainingCount?: number
  totalAvailable?: number
}

export function GamesPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const stats = useQuery(api.prizeRedemptions.getStats, storeId ? { storeId } : "skip") as
    | Stats
    | undefined
  const plays = useQuery(api.prizeRedemptions.listPlays, storeId ? { storeId, limit: 8 } : "skip") as
    | GamePlay[]
    | undefined
  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as Game[] | undefined
  const qrCodes = useQuery(api.gameQRCodes.list, storeId ? { storeId } : "skip") as
    | QRCode[]
    | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as Prize[] | undefined

  if (!storeId) {
    return (
      <Empty className="min-h-[400px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GamepadIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour voir la gamification</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (
    stats === undefined ||
    plays === undefined ||
    games === undefined ||
    qrCodes === undefined ||
    prizes === undefined
  ) {
    return <LoadingState />
  }

  const activeGames = games.filter((g) => g.isActive).length
  const activeQrCodes = qrCodes.filter((q) => q.isActive).length
  const totalScans = qrCodes.reduce((sum, q) => sum + (q.scannedCount ?? 0), 0)
  const prizesInStock = prizes.filter(
    (p) => p.isActive && ((p.remainingCount ?? p.totalAvailable) === undefined || (p.remainingCount ?? p.totalAvailable ?? 0) > 0)
  ).length

  const statCards = [
    { label: "Parties jouées", value: stats.totalPlays, icon: Gamepad2Icon },
    { label: "Victoires", value: stats.totalWins, icon: TrophyIcon },
    { label: "Scans QR", value: totalScans, icon: ScanIcon },
    { label: "Lots à valider", value: stats.pendingRedemptions, icon: TicketCheckIcon },
  ]

  const setupCards = [
    {
      label: "Jeux & Lots",
      description: `${activeGames} jeu${activeGames > 1 ? "x" : ""} actif${activeGames > 1 ? "s" : ""} · ${prizesInStock} lot${prizesInStock > 1 ? "s" : ""} en stock`,
      href: adminRoutes.gamesCatalog,
      icon: GiftIcon,
      warning: activeGames > 0 && prizesInStock === 0 ? "Aucun lot en stock" : undefined,
    },
    {
      label: "Codes QR",
      description: `${activeQrCodes} code${activeQrCodes > 1 ? "s" : ""} sur vos tables`,
      href: adminRoutes.gamesQrCodes,
      icon: QrCodeIcon,
      warning: activeGames > 0 && activeQrCodes === 0 ? "Aucun QR à scanner" : undefined,
    },
    {
      label: "Actions requises",
      description: "Avis Google, follow Instagram…",
      href: adminRoutes.gamesActions,
      icon: ListChecksIcon,
    },
    {
      label: "Gagnants",
      description:
        stats.pendingRedemptions > 0
          ? `${stats.pendingRedemptions} lot${stats.pendingRedemptions > 1 ? "s" : ""} en attente de validation`
          : "Historique et validation en caisse",
      href: adminRoutes.gamesWinners,
      icon: TrophyIcon,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gamification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vos clients scannent, jouent, reviennent
        </p>
      </div>

      {/* Pulse */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="border border-border/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Setup surfaces */}
      <div className="grid gap-4 sm:grid-cols-2">
        {setupCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group flex items-center gap-4 border border-border/50 rounded-lg p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <card.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{card.label}</p>
                {card.warning && (
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"
                  >
                    {card.warning}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{card.description}</p>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {/* Latest plays */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Dernières parties</h2>
          <Link
            href={adminRoutes.gamesWinners}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voir les gagnants →
          </Link>
        </div>
        {plays.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GamepadIcon />
              </EmptyMedia>
              <EmptyTitle>Aucune partie pour le moment</EmptyTitle>
              <EmptyDescription>
                Dès qu&apos;un client scanne un QR et joue, la partie apparaît ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="border border-border/50 rounded-lg divide-y divide-border/50">
            {plays.map((play) => (
              <div key={play.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3.5">
                <Badge
                  variant="outline"
                  className={
                    play.didWin
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }
                >
                  {play.didWin ? "Gagné" : "Perdu"}
                </Badge>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {play.didWin ? (play.prizeName ?? "Lot") : "Aucun lot"}
                  {play.playerName && (
                    <span className="text-muted-foreground"> — {play.playerName}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(play.playedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
