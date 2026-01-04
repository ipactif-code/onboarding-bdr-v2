"use client";

import { useState, type ReactElement } from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TeamRow, getColumns } from "./teams-table-columns";

interface TeamsTableProps {
  teams: TeamRow[];
  onDelete: (id: Id<"teams">) => void;
}

export function TeamsTable({ teams, onDelete }: TeamsTableProps): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const columns = getColumns({ onDelete });

  const table = useReactTable({
    data: teams,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No teams found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-4" data-icon="inline-start" />
          Previous
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: table.getPageCount() }, (_, i) => i + 1)
            .slice(0, 5) // Show max 5 pages
            .map((page) => (
              <Button
                key={page}
                variant={
                  table.getState().pagination.pageIndex === page - 1
                    ? "outline"
                    : "ghost"
                }
                size="icon"
                className="size-9"
                onClick={() => table.setPageIndex(page - 1)}
              >
                {page}
              </Button>
            ))}
          {table.getPageCount() > 5 && (
            <span className="px-2 text-muted-foreground">...</span>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight className="size-4" data-icon="inline-end" />
        </Button>
      </div>

      {/* Selection info */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="text-sm text-muted-foreground">
          {Object.keys(rowSelection).length} of {teams.length} row(s) selected
        </div>
      )}
    </div>
  );
}
