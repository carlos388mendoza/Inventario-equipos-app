import { describe, expect, it } from "vitest";
import { restaurantInputSchema } from "./restaurants";

const validRestaurant = {
  name: "Sucursal Centro",
  code: "CENTRO01",
  address: "",
};

describe("logo de restaurante", () => {
  it("acepta rutas locales y URLs HTTPS", () => {
    expect(
      restaurantInputSchema.parse({
        ...validRestaurant,
        logo: "/brands/sucursal.svg",
      }).logo
    ).toBe("/brands/sucursal.svg");
    expect(
      restaurantInputSchema.parse({
        ...validRestaurant,
        logo: "https://example.com/logo.svg",
      }).logo
    ).toBe("https://example.com/logo.svg");
  });

  it("rechaza esquemas inseguros y rutas demasiado largas", () => {
    expect(
      restaurantInputSchema.safeParse({
        ...validRestaurant,
        logo: "javascript:alert(1)",
      }).success
    ).toBe(false);
    expect(
      restaurantInputSchema.safeParse({
        ...validRestaurant,
        logo: "https://example.com/" + "a".repeat(500),
      }).success
    ).toBe(false);
  });

  it("permite guardar el restaurante sin logo", () => {
    expect(restaurantInputSchema.parse(validRestaurant).logo).toBeUndefined();
  });
});
