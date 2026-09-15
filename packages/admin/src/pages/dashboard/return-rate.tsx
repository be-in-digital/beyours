"use client"

/**
 * « Taux de retour » — how many of the period's diners had been here before.
 *
 * The third metric the site named and the engine had no notion of: there was no
 * idea of a returning customer anywhere in the product until #364 built the
 * customer book.
 *
 * THE DEFINITION IS ON THE SCREEN, and it has to be. « Taux de retour » has
 * several readings that disagree: a diner whose first ever order predates the
 * period, or one who ordered twice inside it. The second makes the figure a
 * function of the window — the same restaurant with the same regulars scores 8%
 * on a week and 34% on a month — so this is the first, and the card says so
 * rather than leaving the reader to assume the other.
 *
 * THE READ'S OWN CAP IS NAMED TOO (#531). The customer book is read 2,000 rows
 * at a time and that limit used to be invisible here: an establishment with
 * more distinct diners than that in the period read a rate over an arbitrary
 * slice of them, printed with the same confidence as an exact one. The orders
 * read beside it has always said when it stopped short. `diners.truncated` is
 * its own flag and not `stats.truncated` — two reads, two caps, and a period
 * can exhaust either one alone.
 *
 * THE ANONYMOUS ORDERS ARE NAMED. An order with no e-mail address belongs to
 * somebody this establishment cannot recognise on their next visit, so it is
 * neither new nor returning. A cash-heavy establishment would otherwise read a
 * rate computed over a minority of its trade with nothing saying so.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@be-in-digital/ui"
import { Repeat } from "lucide-react"
import type { DashboardDiners } from "./use-dashboard-stats"

interface ReturnRateProps {
  diners: DashboardDiners | null
}

/** `0.34` → `34 %`, with the French thin space before the sign. */
function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`
}

export function ReturnRate({ diners }: ReturnRateProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Taux de retour
        </CardTitle>
      </CardHeader>
      <CardContent>
        {diners === null ? (
          // Not a zero. A zero would claim nobody came back; this says the
          // figure was not computed.
          <p className="py-6 text-center text-sm text-muted-foreground">
            Le carnet de clients n'est pas disponible pour cette période.
          </p>
        ) : diners.identified === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun client identifié sur la période.
            {diners.anonymousOrders > 0 && (
              <>
                {" "}
                {diners.anonymousOrders} commande
                {diners.anonymousOrders > 1 ? "s" : ""} sans adresse e-mail.
              </>
            )}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-3xl font-bold tabular-nums">
              {percent(diners.returningRate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {diners.returning} client{diners.returning > 1 ? "s" : ""} sur{" "}
              {diners.identified} avaient déjà commandé avant cette période.
              {diners.newcomers > 0 && (
                <>
                  {" "}
                  {diners.newcomers} nouveau{diners.newcomers > 1 ? "x" : ""}.
                </>
              )}
            </p>
            {diners.anonymousOrders > 0 && (
              <p className="text-xs text-muted-foreground">
                {diners.anonymousOrders} commande
                {diners.anonymousOrders > 1 ? "s" : ""} sans adresse e-mail ne
                {diners.anonymousOrders > 1 ? " sont" : " est"} comptée
                {diners.anonymousOrders > 1 ? "s" : ""} ni comme nouveau client
                ni comme client fidèle.
              </p>
            )}
            {diners.truncated && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="return-rate-truncated"
              >
                Votre carnet de clients dépasse ce qui peut être lu en une fois
                sur cette période : ce taux porte sur les clients les plus
                récents, pas sur la totalité.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
