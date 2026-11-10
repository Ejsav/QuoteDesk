"use client";

import { Bus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PlainDate } from "@/domain/dates";
import { VEHICLE_AMENITY_LABELS, VEHICLE_CATEGORY_META } from "@/domain/vehicle";
import type { FleetSummary } from "@/server/services/operators";
import { deleteVehicleAction } from "@/server/actions/operators";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/misc";
import { pluralize } from "@/lib/utils";
import { FleetChips, VehicleSourceLabel } from "./operator-display";
import { VehicleDialog, type VehicleRecord } from "./vehicle-dialog";

export function FleetSection({
  operatorId,
  vehicles,
  fleet,
  today,
  className,
}: {
  operatorId: string;
  vehicles: VehicleRecord[];
  fleet: FleetSummary;
  today: PlainDate;
  className?: string;
}) {
  const [editing, setEditing] = useState<VehicleRecord | "new" | null>(null);
  const [removing, setRemoving] = useState<VehicleRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(vehicle: VehicleRecord) {
    startTransition(async () => {
      const result = await deleteVehicleAction({ operatorId, vehicleId: vehicle.id });
      if (result.ok) toast.success(`${vehicle.label ?? VEHICLE_CATEGORY_META[vehicle.category].label} removed from the fleet`);
      else toast.error(result.error.message);
      setRemoving(null);
    });
  }

  const summary =
    fleet.totalVehicles === 0
      ? "Nothing recorded yet"
      : `${pluralize(fleet.totalVehicles, "vehicle")} across ${pluralize(fleet.categories.length, "category", "categories")} · ${
          fleet.verifiedVehicles === 0 ? "all operator-reported" : `${fleet.verifiedVehicles} verified by your team`
        }`;

  return (
    <Card className={className}>
      <CardHeader
        title="Fleet"
        description={summary}
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add vehicle
          </Button>
        }
      />
      {vehicles.length === 0 ? (
        <EmptyState
          compact
          icon={<Bus />}
          title="No vehicles recorded"
          description="Add each vehicle type they run with its seat count, so you can find the right operator for a group in seconds."
          action={
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add the first vehicle
            </Button>
          }
        />
      ) : (
        <>
          <div className="px-4 pb-3 sm:px-5">
            <FleetChips fleet={fleet} max={8} />
          </div>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-fg-muted">
                  <Bus className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-fg">{VEHICLE_CATEGORY_META[v.category].label}</p>
                    {v.label ? <p className="min-w-0 truncate text-sm text-fg-secondary">{v.label}</p> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span>
                      <span className="tabular font-medium text-fg-secondary">{v.quantity}</span> in fleet
                    </span>
                    <span>
                      {v.capacity ? (
                        <>
                          <span className="tabular font-medium text-fg-secondary">{v.capacity}</span> seats
                        </>
                      ) : (
                        "Seats not reported"
                      )}
                    </span>
                    <VehicleSourceLabel verifiedOn={v.verifiedOn} note={v.verificationNote} />
                  </div>
                  {v.amenities.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1" aria-label="Amenities">
                      {v.amenities.map((a) => (
                        <li key={a} className="rounded-full bg-surface-hover px-2 py-0.5 text-2xs font-medium text-fg-secondary">
                          {VEHICLE_AMENITY_LABELS[a]}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {v.notes ? <p className="mt-2 text-xs leading-5 whitespace-pre-line text-fg-muted">{v.notes}</p> : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${v.label ?? VEHICLE_CATEGORY_META[v.category].label}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => setEditing(v)}>
                      <Pencil /> Edit vehicle
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => setRemoving(v)}>
                      <Trash2 /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing ? (
        <VehicleDialog
          key={editing === "new" ? "new" : editing.id}
          operatorId={operatorId}
          vehicle={editing === "new" ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(open) => !open && !isPending && setRemoving(null)}
        title="Remove this vehicle?"
        description={
          removing
            ? `${removing.label ?? VEHICLE_CATEGORY_META[removing.category].label} (${pluralize(removing.quantity, "vehicle")}) will be removed from this operator's fleet. The removal is recorded in the operator's activity.`
            : ""
        }
        confirmLabel="Remove vehicle"
        loading={isPending}
        onConfirm={() => removing && remove(removing)}
      />
    </Card>
  );
}
