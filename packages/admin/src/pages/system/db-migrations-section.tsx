"use client"

import { useAction } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import {
  ShieldCheckIcon,
  Loader2,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import type { SystemInfo } from "./types"
import { formatTimestamp } from "./helpers"

// ─── Section: Migrations ─────────────────────────────────────────────────────

export function MigrationsSection({ info }: { info: SystemInfo }) {
  const { api } = useAdminApiStore()
  const runMigrations = useAction(api?.system?.runMigrations)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    if (!api?.system || !runMigrations) return
    setRunning(true)
    try {
      const result = await runMigrations({})
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec des migrations")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5" />
          Migrations
        </CardTitle>
        <CardDescription>
          Gérez les migrations de données de votre application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRun} disabled={running || !api?.system}>
          {running && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Executer les migrations en attente
        </Button>

        {info.appliedMigrations.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Appliquee le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.appliedMigrations.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(m.appliedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune migration appliquee</p>
        )}
      </CardContent>
    </Card>
  )
}
