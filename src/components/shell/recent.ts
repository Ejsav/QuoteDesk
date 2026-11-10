"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Recently viewed records, kept per browser (localStorage) for the command palette. */
export interface RecentItem {
  type: "lead" | "customer" | "operator";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

const KEY = "quotedesk:recent:v1";
const EVENT = "quotedesk:recent-change";
const EMPTY: RecentItem[] = [];

let cachedRaw: string | null = null;
let cachedValue: RecentItem[] = EMPTY;

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function snapshot(): RecentItem[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      cachedValue = Array.isArray(parsed) ? (parsed as RecentItem[]) : EMPTY;
    } catch {
      cachedValue = EMPTY;
    }
  }
  return cachedValue;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 8)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable (private mode / quota) — recents are a convenience only.
  }
}

export function pushRecent(item: RecentItem) {
  write([item, ...snapshot().filter((i) => !(i.type === item.type && i.id === item.id))]);
}

export function removeRecent(type: RecentItem["type"], id: string) {
  write(snapshot().filter((i) => !(i.type === type && i.id === id)));
}

export function useRecentItems(): RecentItem[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Drop into a detail page to record the visit. */
export function TrackRecent(props: RecentItem) {
  const { type, id, label, sublabel, href } = props;
  useEffect(() => {
    pushRecent({ type, id, label, sublabel, href });
  }, [type, id, label, sublabel, href]);
  return null;
}
