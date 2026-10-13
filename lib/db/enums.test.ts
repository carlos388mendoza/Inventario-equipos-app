import { describe, expect, it } from "vitest";
import {
  DESTINATION_AREA,
  ROLES,
  TECHNICIAN_ROLES,
  asUserRole,
  isDestinationArea,
  isTechnicianRole,
  isUserRole,
} from "./enums";

describe("roles ampliados (issues #11/#16)", () => {
  it("incluye TECHNICIAN y HEAD_TECHNICIAN en ALL_ROLES", () => {
    const all = Object.values(ROLES);
    expect(all).toContain(ROLES.TECHNICIAN);
    expect(all).toContain(ROLES.HEAD_TECHNICIAN);
  });

  it("isTechnicianRole reconoce ambos roles técnicos y rechaza el resto", () => {
    expect(isTechnicianRole(ROLES.TECHNICIAN)).toBe(true);
    expect(isTechnicianRole(ROLES.HEAD_TECHNICIAN)).toBe(true);
    expect(isTechnicianRole(ROLES.ADMIN)).toBe(false);
    expect(isTechnicianRole(ROLES.RESTAURANT_USER)).toBe(false);
    expect(isTechnicianRole(ROLES.IT_MANAGER)).toBe(false);
  });

  it("TECHNICIAN_ROLES lista los dos roles técnicos", () => {
    expect(TECHNICIAN_ROLES.sort()).toEqual(
      [ROLES.TECHNICIAN, ROLES.HEAD_TECHNICIAN].sort()
    );
  });

  it("isUserRole/asUserRole siguen normalizando valores desconocidos", () => {
    expect(isUserRole(ROLES.TECHNICIAN)).toBe(true);
    expect(isUserRole("Q9Snoop")).toBe(false);
    expect(asUserRole(ROLES.TECHNICIAN)).toBe(ROLES.TECHNICIAN);
    expect(asUserRole("rol-que-no-existe")).toBe(ROLES.RESTAURANT_USER);
  });
});

describe("áreas de destino (issue #14)", () => {
  it("contiene exactamente las 4 áreas del issue", () => {
    expect(Object.values(DESTINATION_AREA).sort()).toEqual(
      ["COCINA", "COUNTER", "DESPACHO", "DOMICILIO"].sort()
    );
  });

  it("valida valores conocidos y rechaza inventados", () => {
    expect(isDestinationArea("COCINA")).toBe(true);
    expect(isDestinationArea("DOMICILIO")).toBe(true);
    expect(isDestinationArea("BODEGA")).toBe(false);
    expect(isDestinationArea(null)).toBe(false);
  });
});