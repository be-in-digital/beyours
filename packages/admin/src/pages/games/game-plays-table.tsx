"use client"

import { Badge } from "@beindigital-engine/ui"

interface GamePlay {
  _id: string
  playerFirstName?: string
  playerLastName?: string
  playerEmail?: string
  didWin: boolean
  playedAt: number
  gameId: string
  prizeId?: string
}

interface Game {
  _id: string
  name: string
}

interface Prize {
  _id: string
  name: string
}

interface GamePlaysTableProps {
  plays: GamePlay[]
  games: Game[]
  prizes: Prize[]
}

export function GamePlaysTable({ plays, games, prizes }: GamePlaysTableProps) {
  const gameMap = new Map(games.map((g) => [g._id, g.name]))
  const prizeMap = new Map(prizes.map((p) => [p._id, p.name]))

  if (plays.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune partie jouée</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joueur</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Jeu</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Résultat</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Prix</th>
          </tr>
        </thead>
        <tbody>
          {plays.map((play) => (
            <tr key={play._id} className="border-b border-border/30">
              <td className="py-3 px-2 text-xs">
                {new Date(play.playedAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-3 px-2 text-xs">
                {play.playerFirstName || play.playerEmail || "Anonyme"}
              </td>
              <td className="py-3 px-2 text-xs">
                {gameMap.get(play.gameId) ?? "—"}
              </td>
              <td className="py-3 px-2">
                <Badge variant={play.didWin ? "default" : "secondary"} className="text-xs">
                  {play.didWin ? "Gagné" : "Perdu"}
                </Badge>
              </td>
              <td className="py-3 px-2 text-xs">
                {play.prizeId ? prizeMap.get(play.prizeId) ?? "—" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
