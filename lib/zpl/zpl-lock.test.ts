import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Candado sobre el ZPL aprobado.
 *
 * La parte de Zebra se probó FÍSICAMENTE y está aprobada. Este test no juzga si el
 * ZPL es bonito: solo que el archivo no cambia sin que alguien lo decida a
 * propósito. Si falla, significa que se ha tocado `graphics.generated.ts`, y eso
 * hay que reportarlo, no arreglarlo por su cuenta.
 */
const APPROVED_SHA256 =
  "EA185E75E01164E1B95C95B16F8332A09569CFB2AC59E77F03A38DAE663F6504";
const ZPL_FILE = join("lib", "zpl", "graphics.generated.ts");

describe("ZPL aprobado", () => {
  it("13. lib/zpl/graphics.generated.ts conserva el hash aprobado", () => {
    const actual = createHash("sha256")
      .update(readFileSync(ZPL_FILE))
      .digest("hex")
      .toUpperCase();

    expect(actual).toBe(APPROVED_SHA256);
  });
});
