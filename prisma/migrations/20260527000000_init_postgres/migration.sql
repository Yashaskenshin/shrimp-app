-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED', 'SENT');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rmAvgSize" DOUBLE PRECISION,
    "stdYieldPct" DOUBLE PRECISION,
    "sizeBand" TEXT,
    "category" TEXT,
    "packDefault" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingChargeRate" (
    "id" TEXT NOT NULL,
    "plant" TEXT NOT NULL,
    "productG" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "freezeType" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "countSize" TEXT NOT NULL,
    "rsPerKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProcessingChargeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Rs/kg',
    "group" TEXT NOT NULL DEFAULT 'cost',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "poNo" TEXT,
    "contractDate" TIMESTAMP(3),
    "revisedDate" TIMESTAMP(3),
    "customer" TEXT,
    "country" TEXT,
    "incoterm" TEXT,
    "payment" TEXT,
    "plant" TEXT,
    "freezeType" TEXT,
    "commissionOverridePerKg" DOUBLE PRECISION,
    "processingChargeWithGst" BOOLEAN NOT NULL DEFAULT false,
    "portLoading" TEXT,
    "portLoadingDate" TIMESTAMP(3),
    "portDestination" TEXT,
    "portDestDate" TIMESTAMP(3),
    "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 83,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedBy" TEXT,
    "verifiedBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "customVariableCosts" JSONB,
    "customFixedCosts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productCode" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "sizeBand" TEXT,
    "pack" TEXT,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usdPerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockFgKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rmPriceRs" DOUBLE PRECISION,
    "stockCostRs" DOUBLE PRECISION,
    "packagingRs" DOUBLE PRECISION,
    "additiveRs" DOUBLE PRECISION,
    "processingChargeRs" DOUBLE PRECISION,
    "commissionRs" DOUBLE PRECISION,
    "exportShipmentRs" DOUBLE PRECISION,
    "ddpRs" DOUBLE PRECISION,
    "yieldPctOverride" DOUBLE PRECISION,
    "avgSizeOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "comment" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSnapshot" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenBy" TEXT,

    CONSTRAINT "QuoteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "ProcessingChargeRate_plant_idx" ON "ProcessingChargeRate"("plant");

-- CreateIndex
CREATE UNIQUE INDEX "Assumption_key_key" ON "Assumption"("key");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteLine_quoteId_lineNo_key" ON "QuoteLine"("quoteId", "lineNo");

-- CreateIndex
CREATE INDEX "QuoteEvent_quoteId_idx" ON "QuoteEvent"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSnapshot_quoteId_key" ON "QuoteSnapshot"("quoteId");

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSnapshot" ADD CONSTRAINT "QuoteSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
