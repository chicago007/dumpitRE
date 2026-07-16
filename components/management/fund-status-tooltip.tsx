"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { LabFund } from "@/lib/types";
import { LabRoundDetail } from "@/components/management/fund-panels";
import { cn } from "@/lib/utils";

const BUBBLE_WIDTH = 640;
const BUBBLE_MAX_HEIGHT = 720;

export function FundStatusHoverBubble({
  fund,
  children,
  className,
}: {
  fund: LabFund;
  children: React.ReactNode;
  className?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, placement: "bottom" as "bottom" | "top" });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const bubbleW = Math.min(BUBBLE_WIDTH, window.innerWidth - 24);
    const bubbleH = Math.min(
      bubble?.offsetHeight ?? BUBBLE_MAX_HEIGHT,
      window.innerHeight * 0.75,
      BUBBLE_MAX_HEIGHT
    );
    const gap = 12;

    let left = Math.min(rect.left, window.innerWidth - bubbleW - 12);
    let top = rect.bottom + gap;
    let placement: "bottom" | "top" = "bottom";

    if (left < 12) left = 12;

    if (top + bubbleH > window.innerHeight - 12) {
      top = rect.top - gap - bubbleH;
      placement = "top";
      if (top < 12) {
        top = Math.max(12, (window.innerHeight - bubbleH) / 2);
        left = Math.max(12, (window.innerWidth - bubbleW) / 2);
        placement = "bottom";
      }
    }

    setPos({ top, left, placement });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOpen(false), 200);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const bubbleWidth = `min(${BUBBLE_WIDTH}px, calc(100vw - 24px))`;

  return (
    <>
      <span
        ref={anchorRef}
        className={cn(
          "cursor-help underline decoration-dotted decoration-muted/60 underline-offset-2",
          className
        )}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        tabIndex={0}
      >
        {children}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={bubbleRef}
              role="tooltip"
              className="pointer-events-auto fixed z-[200] overflow-hidden rounded-xl border border-border bg-card shadow-card"
              style={{
                top: pos.top,
                left: pos.left,
                width: bubbleWidth,
                maxHeight: `min(${BUBBLE_MAX_HEIGHT}px, 75vh)`,
              }}
              onMouseEnter={show}
              onMouseLeave={scheduleHide}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute z-10 h-2.5 w-2.5 rotate-45 border border-border bg-card",
                  pos.placement === "bottom"
                    ? "-top-1.5 left-8 border-b-0 border-r-0"
                    : "-bottom-1.5 left-8 border-l-0 border-t-0"
                )}
              />
              <div className="max-h-[inherit] overflow-y-auto">
                <LabRoundDetail fund={fund} embedded readOnly compact />
              </div>
              <div className="sticky bottom-0 border-t border-border bg-card/95 px-3 py-2 text-right backdrop-blur-sm">
                <Link
                  href={`/management/sites?lab=${encodeURIComponent(fund.id)}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  사업장별(회차별)에서 열기 →
                </Link>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
