import type { Spark } from "./sparks";

function isSameSpark(left: Spark, right: Spark): boolean {
  return (
    left.id === right.id &&
    left.text === right.text &&
    left.createdAt === right.createdAt &&
    left.lastSurfacedAt === right.lastSurfacedAt &&
    left.resolvedAt === right.resolvedAt
  );
}

export function getSyncedSparks(current: Spark[], stored: Spark[]): Spark[] {
  if (
    current.length === stored.length &&
    current.every((spark, index) => isSameSpark(spark, stored[index]))
  ) {
    return current;
  }

  return stored;
}
