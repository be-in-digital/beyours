"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "../lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table"

export interface ColumnDef<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
  accessor?: (item: T) => any
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  className?: string
}

type SortDirection = "asc" | "desc" | null

export function DataTable<T>({
  columns,
  data,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortDirection(null)
        setSortKey(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data

    const column = columns.find((col) => col.key === sortKey)
    if (!column) return data

    return [...data].sort((a, b) => {
      const aValue = column.accessor ? column.accessor(a) : (a as any)[sortKey]
      const bValue = column.accessor ? column.accessor(b) : (b as any)[sortKey]

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDirection, columns])

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>
              {column.sortable ? (
                <button
                  type="button"
                  onClick={() => handleSort(column.key)}
                  className="flex items-center gap-2 font-medium hover:text-foreground"
                >
                  {column.header}
                  {sortKey === column.key ? (
                    sortDirection === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                  )}
                </button>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              No results.
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((item, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render
                    ? column.render(item)
                    : column.accessor
                    ? column.accessor(item)
                    : (item as any)[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
