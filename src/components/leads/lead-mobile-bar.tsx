"use client";

import { CalendarClock, MessageSquarePlus, Phone } from "lucide-react";
import type { LeadStatus, QualificationField } from "@/domain/lead";
import { Button } from "@/components/ui/button";
import { LeadMoreMenu, StatusControl } from "./lead-controls";

/** Phone-sized quick actions, pinned under the top bar while scrolling. */
export function LeadMobileBar(props: {
  leadId: string;
  leadNumber: number;
  status: LeadStatus;
  missing: QualificationField[];
  phone: string | null;
  customerName: string;
  activityCount: number;
  stopCount: number;
}) {
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-canvas/90 px-4 py-2 backdrop-blur-md md:hidden">
      <div className="min-w-0 flex-1">
        <StatusControl leadId={props.leadId} leadNumber={props.leadNumber} status={props.status} missing={props.missing} fullWidth />
      </div>
      <Button asChild variant="secondary" size="icon" aria-label="Follow-up">
        <a href="#follow-up">
          <CalendarClock />
        </a>
      </Button>
      {props.phone ? (
        <Button asChild variant="secondary" size="icon" aria-label={`Call ${props.customerName}`}>
          <a href={`tel:${props.phone}`}>
            <Phone />
          </a>
        </Button>
      ) : null}
      <Button asChild variant="secondary" size="icon" aria-label="Add a note or log contact">
        <a href="#composer">
          <MessageSquarePlus />
        </a>
      </Button>
      <LeadMoreMenu
        leadId={props.leadId}
        leadNumber={props.leadNumber}
        customerName={props.customerName}
        activityCount={props.activityCount}
        stopCount={props.stopCount}
      />
    </div>
  );
}
