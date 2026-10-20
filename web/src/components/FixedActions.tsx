"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Reserve the measured dock height, including wrapped/zoomed text and safe-area padding. */
export default function FixedActions({ children }: { children: ReactNode }) {
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = dock.current;
    const shell = element?.closest<HTMLElement>("main");
    if (!element || !shell) return;
    const resize = () => shell.style.setProperty("--action-height", `${element.getBoundingClientRect().height}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => { observer.disconnect(); shell.style.removeProperty("--action-height"); };
  }, []);
  return <div className="fixed-actions" role="group" aria-label="다음 화면으로">{children}</div>;
}
