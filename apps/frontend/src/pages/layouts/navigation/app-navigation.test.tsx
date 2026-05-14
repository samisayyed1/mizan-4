import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isPathActive, useNavigation } from "./app-navigation";

describe("app-navigation", () => {
  describe("useNavigation (Phase 1 boomer-friendly primary)", () => {
    it("primary nav exposes exactly Home, Portfolio, Activities, Goals, Settings", () => {
      const { result } = renderHook(() => useNavigation());

      const primaryTitles = result.current.primary.map((n) => n.title);
      expect(primaryTitles).toEqual(["Home", "Portfolio", "Activities", "Goals", "Settings"]);
    });

    it("Home points at /dashboard so the existing Dashboard route keeps working", () => {
      const { result } = renderHook(() => useNavigation());

      const home = result.current.primary.find((n) => n.title === "Home");
      expect(home?.href).toBe("/dashboard");
    });

    it("Portfolio surfaces /holdings as the calm entry point for the portfolio area", () => {
      const { result } = renderHook(() => useNavigation());

      const portfolio = result.current.primary.find((n) => n.title === "Portfolio");
      expect(portfolio?.href).toBe("/holdings");
    });

    it("advanced views (Insights, Assistant, Connect) remain accessible via secondary nav", () => {
      const { result } = renderHook(() => useNavigation());

      const secondaryTitles = (result.current.secondary ?? []).map((n) => n.title);
      expect(secondaryTitles).toContain("Insights");
      expect(secondaryTitles).toContain("Assistant");
      expect(secondaryTitles).toContain("Connect");
    });

    it("every nav entry carries a plain-English title and a route", () => {
      const { result } = renderHook(() => useNavigation());

      const all = [...result.current.primary, ...(result.current.secondary ?? [])];
      for (const entry of all) {
        expect(entry.title).toMatch(/^[A-Z][A-Za-z]+( [A-Za-z]+)*$/);
        expect(entry.href).toMatch(/^\//);
      }
    });
  });

  describe("isPathActive", () => {
    it("treats / and /dashboard as the Home route", () => {
      expect(isPathActive("/", "/dashboard")).toBe(true);
      expect(isPathActive("/dashboard", "/dashboard")).toBe(true);
    });

    it("matches nested routes under their parent", () => {
      expect(isPathActive("/holdings/AAPL", "/holdings")).toBe(true);
      expect(isPathActive("/activities/manage", "/activities")).toBe(true);
      expect(isPathActive("/goals/abc/guide", "/goals")).toBe(true);
      expect(isPathActive("/settings/general", "/settings")).toBe(true);
    });

    it("does not match unrelated routes", () => {
      expect(isPathActive("/holdings", "/activities")).toBe(false);
      expect(isPathActive("/insights", "/holdings")).toBe(false);
    });

    it("normalizes trailing slashes", () => {
      expect(isPathActive("/holdings/", "/holdings")).toBe(true);
      expect(isPathActive("/holdings", "/holdings/")).toBe(true);
    });

    it("returns false for an empty href", () => {
      expect(isPathActive("/holdings", "")).toBe(false);
    });
  });
});
