"use client"

import { useQuery } from "convex/react"
import { useState } from "react"
import {
  HistoryIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import type { AuditEntry } from "./types"
import {
  AUDIT_ACTION_LABELS,
  formatActionLabel,
  formatAuditDetails,
  formatTimestamp,
} from "./helpers"

// ─── Section: Audit Log ──────────────────────────────────────────────────────

export function AuditLogSection() {
  const { api } = useAdminApiStore()
  const [filterAction, setFilterAction] = useState<string>("all")
  const [cursor, setCursor] = useState<string | null>(null)
  const PAGE_SIZE = 10

  const auditLog = useQuery(
    api?.system?.getAuditLog ?? "skip",
    api?.system ? {
      paginationOpts: { cursor, numItems: PAGE_SIZE },
      filterAction: filterAction === "all" ? undefined : filterAction,
    } : "skip"
  ) as
    | {
        page: AuditEntry[]
        continueCursor: string | null
        isDone: boolean
      }
    | undefined

  const handlePrev = () => {
    // Simple approach: go back to the beginning
    setCursor(null)
  }

  const handleNext = () => {
    if (auditLog?.continueCursor) {
      setCursor(auditLog.continueCursor)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Journal d'activite
            </CardTitle>
            <CardDescription>
              Historique des operations systeme
            </CardDescription>
          </div>
          <Select
            value={filterAction}
            onValueChange={(val) => {
              setFilterAction(val)
              setCursor(null)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer par action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {auditLog === undefined ? (
          <LoadingState variant="table" count={5} />
        ) : auditLog.page.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune entree dans le journal
          </p>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resultat</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.page.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <span className="text-sm">{formatActionLabel(entry.action)}</span>
                      </TableCell>
                      <TableCell>
                        {entry.result === "success" ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-500"
                          >
                            <CheckCircle2Icon className="h-3 w-3 mr-1" />
                            Succes
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-red-500/10 text-red-500"
                          >
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Échec
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatTimestamp(entry.performedAt)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {formatAuditDetails(entry)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={!cursor}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Debut
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={auditLog.isDone}
              >
                Suivant
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
