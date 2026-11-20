import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { type Column, DataTable } from "./DataTable";

interface Row { id: number; name: string }

const cols: Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable caption="t" columns={cols} rows={[{ id: 1, name: "a" }]} rowKey={(r) => r.id} />);
    expect(screen.getByText("a")).toBeInTheDocument();
  });
  it("shows skeleton rows while loading", () => {
    render(<DataTable caption="t" columns={cols} rows={undefined} isLoading rowKey={(r) => r.id} />);
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });
  it("shows the empty state for an empty result", () => {
    render(<DataTable caption="t" columns={cols} rows={[]} rowKey={(r) => r.id}
      empty={<EmptyState title="Nothing here" />} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
  it("shows the error state with retry", () => {
    render(<DataTable caption="t" columns={cols} rows={undefined} error={new Error("boom")} rowKey={(r) => r.id} />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("labels unknown statuses safely", () => {
    render(<StatusBadge status="in_review" />);
    expect(screen.getByText("In review")).toBeInTheDocument();
  });
});
