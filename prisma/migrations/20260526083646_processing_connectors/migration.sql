-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "commissionOverridePerKg" REAL;
ALTER TABLE "Quote" ADD COLUMN "freezeType" TEXT;

-- CreateTable
CREATE TABLE "ProcessingChargeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plant" TEXT NOT NULL,
    "productG" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "freezeType" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "countSize" TEXT NOT NULL,
    "rsPerKg" REAL NOT NULL
);

-- CreateIndex
CREATE INDEX "ProcessingChargeRate_plant_idx" ON "ProcessingChargeRate"("plant");
