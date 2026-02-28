"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { useRouter } from "next/navigation"
import { FileText, Globe, PenLine } from "lucide-react"
import { Badge, Button } from "@beindigital-engine/ui"
import { LoadingState } from "@/components/admin/LoadingState"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function CmsPagesListPage() {
  const storeId = useAdminStoreId()
  const router = useRouter()

  const pages = useQuery(
    api.cms.listPages,
    storeId ? { storeId } : "skip",
  )

  if (!storeId) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modifiez le contenu des pages de votre site.
        </p>
      </div>

      {pages === undefined ? (
        <LoadingState variant="table" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Dernière modification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page: any) => (
                <TableRow
                  key={page.slug}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/content/pages/${page.slug}`)
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{page.label}</p>
                        <p className="text-xs text-muted-foreground">
                          /{page.slug}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {page.hasPublished && (
                        <Badge variant="default" className="text-[10px]">
                          <Globe className="mr-1 h-2.5 w-2.5" />
                          Publié
                        </Badge>
                      )}
                      {page.hasUnpublishedChanges && (
                        <Badge variant="secondary" className="text-[10px]">
                          <PenLine className="mr-1 h-2.5 w-2.5" />
                          Brouillon
                        </Badge>
                      )}
                      {!page.hasPublished && !page.hasUnpublishedChanges && (
                        <span className="text-xs text-muted-foreground">
                          Non modifié
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {page.draftUpdatedAt
                        ? new Date(page.draftUpdatedAt).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/content/pages/${page.slug}`)
                      }}
                    >
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
