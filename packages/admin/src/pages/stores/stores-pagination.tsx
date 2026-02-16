"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  ButtonGroup,
} from "@beindigital-engine/ui"

interface StoresPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

/**
 * Build the list of page numbers to display with ellipsis logic.
 * Always shows first, last, current and 1 sibling on each side.
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "ellipsis")[] = [1]

  if (current > 3) {
    pages.push("ellipsis")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push("ellipsis")
  }

  pages.push(total)
  return pages
}

export function StoresPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: StoresPaginationProps) {
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  if (totalItems === 0) return null

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <div className="flex items-center justify-between py-4">
      <p className="text-sm text-muted-foreground">
        {start}-{end} sur {totalItems} résultat{totalItems > 1 ? "s" : ""}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent className="gap-0">
          <ButtonGroup>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-disabled={currentPage <= 1}
              />
            </PaginationItem>

            {pages.map((page, idx) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={page === currentPage}
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-disabled={currentPage >= totalPages}
              />
            </PaginationItem>
          </ButtonGroup>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
