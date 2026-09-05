"use client"

import { resolveAllergens } from "@be-in-digital/core/allergens"

interface PrintTicketItem {
  productName: string
  quantity: number
  options: string[]
  notes?: string
}

interface PrintTicketLayoutProps {
  storeName: string
  orderNumber: string
  orderType: "delivery" | "pickup" | "dine_in"
  source: "website" | "uber_eats" | "deliveroo" | "pos"
  items: PrintTicketItem[]
  customerName?: string
  customerPhone?: string
  /** Dine-in only. The line that tells the cook where the plate goes. */
  tableNumber?: string
  deliveryNotes?: string
  /**
   * Raw values out of `kitchenTickets.allergens`, exactly as the owner stored
   * them. Resolved here rather than upstream so the ticket can distinguish a
   * name the vocabulary recognised from one it did not.
   */
  allergens?: string[]
  estimatedPrepTime?: number
  trackingToken?: string
  printTrigger?: "confirmed" | "ready" | "reprint"
  paperSize: "80mm" | "58mm"
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: "LIVRAISON",
  pickup: "A EMPORTER",
  dine_in: "SUR PLACE",
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Site Web",
  uber_eats: "Uber Eats",
  deliveroo: "Deliveroo",
  pos: "Caisse",
}

const TRIGGER_LABELS: Record<string, string> = {
  confirmed: "NOUVEAU",
  ready: "PRÊT",
  reprint: "RÉIMPRESSION",
}

export function PrintTicketLayout({
  storeName,
  orderNumber,
  orderType,
  source,
  items,
  customerName,
  customerPhone,
  tableNumber,
  deliveryNotes,
  allergens,
  estimatedPrepTime,
  trackingToken,
  printTrigger,
  paperSize,
}: PrintTicketLayoutProps) {
  const is58mm = paperSize === "58mm"

  // One resolution, the same one the dish page and the Uber Eats sync use.
  // `resolveAllergens` deduplicates, so a product tagged both `lactose` and
  // `lait` prints "Lait" once instead of twice.
  const resolved = resolveAllergens(allergens)
  const declaredAllergens = resolved.filter((a) => a.kind === "allergen")
  const unverifiedAllergens = resolved.filter((a) => a.kind === "unverified")
  const diets = resolved.filter((a) => a.kind === "diet")

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: is58mm ? "11px" : "13px",
        width: is58mm ? "48mm" : "72mm",
        padding: "4mm",
        lineHeight: 1.4,
        color: "#000",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "3mm" }}>
        <div style={{ fontWeight: "bold", fontSize: is58mm ? "14px" : "16px" }}>
          {storeName}
        </div>
        {printTrigger && (
          <div
            style={{
              fontWeight: "bold",
              fontSize: is58mm ? "16px" : "20px",
              margin: "2mm 0",
              padding: "1mm",
              border: "2px solid #000",
              display: "inline-block",
            }}
          >
            {TRIGGER_LABELS[printTrigger] ?? ""}
          </div>
        )}
      </div>

      {/* Order info */}
      <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginBottom: "2mm" }}>
        <div style={{ fontWeight: "bold", fontSize: is58mm ? "16px" : "20px", textAlign: "center" }}>
          #{orderNumber}
        </div>
        <div style={{ textAlign: "center", marginTop: "1mm" }}>
          {ORDER_TYPE_LABELS[orderType]} | {SOURCE_LABELS[source]}
        </div>
        {/*
          The table, as large as the order number. A cook reads this slip at
          arm's length on a pass; the whole point of a dine-in ticket is
          knowing which table the plate goes to, and it competes with the
          order number for attention rather than sitting in the customer
          block. Printed whenever it is set — an order that has a table has
          one because it is served at one.
        */}
        {tableNumber && (
          <div
            style={{
              textAlign: "center",
              marginTop: "1mm",
              fontWeight: "bold",
              fontSize: is58mm ? "16px" : "20px",
            }}
          >
            TABLE {tableNumber}
          </div>
        )}
      </div>

      {/* Customer info */}
      {(customerName || customerPhone) && (
        <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginBottom: "2mm" }}>
          {customerName && <div>Client: {customerName}</div>}
          {customerPhone && <div>Tel: {customerPhone}</div>}
        </div>
      )}

      {/* Items */}
      <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginBottom: "2mm" }}>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: "2mm" }}>
            <div style={{ fontWeight: "bold" }}>
              {item.quantity}x {item.productName}
            </div>
            {item.options.length > 0 && (
              <div style={{ paddingLeft: "3mm", fontSize: is58mm ? "10px" : "11px" }}>
                {item.options.join(", ")}
              </div>
            )}
            {item.notes && (
              <div style={{ paddingLeft: "3mm", fontStyle: "italic", fontSize: is58mm ? "10px" : "11px" }}>
                Note: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delivery notes */}
      {deliveryNotes && (
        <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginBottom: "2mm" }}>
          <div style={{ fontWeight: "bold" }}>Instructions livraison:</div>
          <div>{deliveryNotes}</div>
        </div>
      )}

      {/* Allergens */}
      {(declaredAllergens.length > 0 || unverifiedAllergens.length > 0 || diets.length > 0) && (
        <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginBottom: "2mm" }}>
          {declaredAllergens.length > 0 && (
            <>
              <div style={{ fontWeight: "bold" }}>ALLERGÈNES :</div>
              <div>{declaredAllergens.map((a) => a.label).join(", ")}</div>
            </>
          )}
          {/*
            A name the vocabulary did not recognise is printed, never dropped —
            it may be the one that matters. But it is printed apart from the
            recognised ones and in the owner's own words, because the cook has
            to treat it differently: nothing has checked what it means. Folding
            it into the line above would let "sans gluten" read as a gluten
            declaration.
          */}
          {unverifiedAllergens.length > 0 && (
            <div style={{ marginTop: declaredAllergens.length > 0 ? "1mm" : 0 }}>
              <div style={{ fontWeight: "bold" }}>MENTIONS À VÉRIFIER :</div>
              <div>{unverifiedAllergens.map((a) => a.label).join(", ")}</div>
            </div>
          )}
          {/*
            Dietary markers are prep information, not a disclosure. They used to
            print under the allergen heading, which told a cook that "Végan" was
            an allergen.
          */}
          {diets.length > 0 && (
            <div style={{ marginTop: "1mm" }}>
              <div style={{ fontWeight: "bold" }}>RÉGIME :</div>
              <div>{diets.map((a) => a.label).join(", ")}</div>
            </div>
          )}
        </div>
      )}

      {/* Estimated time */}
      {estimatedPrepTime && (
        <div style={{ textAlign: "center", marginTop: "2mm", fontWeight: "bold" }}>
          Temps estime: {estimatedPrepTime} min
        </div>
      )}

      {/* Tracking QR placeholder (80mm only) */}
      {!is58mm && trackingToken && (
        <div style={{ textAlign: "center", marginTop: "3mm", fontSize: "10px" }}>
          Suivi: {trackingToken}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "3mm", textAlign: "center", fontSize: "10px" }}>
        {new Date().toLocaleString("fr-FR")}
      </div>
    </div>
  )
}
