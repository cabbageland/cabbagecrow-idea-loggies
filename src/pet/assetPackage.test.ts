import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

type PngChunk = {
  type: string;
  data: Buffer;
};

type RgbaPng = {
  width: number;
  height: number;
  alpha: Uint8Array;
};

function readPngChunks(path: string): PngChunk[] {
  const png = readFileSync(path);
  const signature = png.subarray(0, 8);
  expect(signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);

  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    chunks.push({ type, data: png.subarray(dataStart, dataStart + length) });
    offset = dataStart + length + 4;
  }
  return chunks;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  if (upDistance <= upperLeftDistance) {
    return up;
  }
  return upperLeft;
}

function readRgbaPng(path: string): RgbaPng {
  const chunks = readPngChunks(path);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!ihdr) {
    throw new Error("PNG is missing IHDR");
  }

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr.readUInt8(8);
  const colorType = ihdr.readUInt8(9);
  const interlace = ihdr.readUInt8(12);

  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);
  expect(interlace).toBe(0);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data),
  );
  const inflated = inflateSync(compressed);
  const alpha = new Uint8Array(width * height);
  let sourceOffset = 0;
  let alphaOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const scanline = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? scanline[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;

      if (filter === 1) {
        scanline[x] = (scanline[x] + left) & 0xff;
      } else if (filter === 2) {
        scanline[x] = (scanline[x] + up) & 0xff;
      } else if (filter === 3) {
        scanline[x] = (scanline[x] + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        scanline[x] = (scanline[x] + paethPredictor(left, up, upperLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }
    }

    for (let x = 3; x < stride; x += bytesPerPixel) {
      alpha[alphaOffset] = scanline[x];
      alphaOffset += 1;
    }
    previous = scanline;
  }

  return { width, height, alpha };
}

function readRgbaPngAlphaValues(path: string): Set<number> {
  return new Set(readRgbaPng(path).alpha);
}

function getAlphaAt(png: RgbaPng, x: number, y: number): number {
  return png.alpha[y * png.width + x];
}

describe("CabbageCrow asset package", () => {
  it("uses generated row strips rather than the old all-in-one grid", () => {
    const pet = JSON.parse(readFileSync("public/pets/cabbagecrow/pet.json", "utf8"));
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(pet.sourceMode).toBe("generated-row-strips");
    expect(validation.sourceMode).toBe("generated-row-strips");
    expect(validation.detectedFrames).toBe(72);
  });

  it("keeps every extracted sprite away from cell edges", () => {
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(validation.edgeContactFrames).toEqual([]);
  });

  it("builds the exact Codex atlas geometry", () => {
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(validation.atlasWidth).toBe(1536);
    expect(validation.atlasHeight).toBe(1872);
    expect(validation.cellWidth).toBe(192);
    expect(validation.cellHeight).toBe(208);
  });

  it("uses solid sprite alpha with no semi-transparent color pixels", () => {
    const alphaValues = readRgbaPngAlphaValues("public/pets/cabbagecrow/spritesheet.png");

    expect([...alphaValues].sort((a, b) => a - b)).toEqual([0, 255]);
  });

  it("keeps the idle beak filled instead of keying out dark beak pixels", () => {
    const spritesheet = readRgbaPng("public/pets/cabbagecrow/spritesheet.png");

    expect(getAlphaAt(spritesheet, 137, 60)).toBe(255);
  });
});
