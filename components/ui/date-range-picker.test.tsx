import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "@/lib/date-range";
import { formatDate } from "@/lib/utils";

const day = (month: number, date: number) => new Date(2026, month - 1, date);

function render(value: DateRange, ariaLabel?: string, placeholder?: string) {
  return renderToStaticMarkup(
    React.createElement(DateRangePicker, {
      value,
      onChange: () => {},
      "aria-label": ariaLabel,
      placeholder,
    })
  );
}

describe("DateRangePicker (marcado del botón)", () => {
  it("9. sin fechas muestra el placeholder", () => {
    const html = render({}, undefined, "Rango de fechas");
    expect(html).toContain("Rango de fechas");
  });

  it("9. con fechas muestra el intervalo formateado", () => {
    const html = render({ from: day(3, 10), to: day(3, 20) });
    expect(html).toContain(formatDate(day(3, 10)));
    expect(html).toContain(formatDate(day(3, 20)));
    expect(html).toContain("–");
  });

  it("expone un nombre accesible en el botón", () => {
    const html = render({}, "Filtrar por fecha");
    expect(html).toContain('aria-label="Filtrar por fecha"');
  });
});
