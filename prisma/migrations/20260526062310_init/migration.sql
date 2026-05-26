-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rmAvgSize" REAL,
    "stdYieldPct" REAL,
    "sizeBand" TEXT,
    "category" TEXT,
    "packDefault" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Rs/kg',
    "group" TEXT NOT NULL DEFAULT 'cost',
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNo" TEXT,
    "contractDate" DATETIME,
    "revisedDate" DATETIME,
    "customer" TEXT,
    "country" TEXT,
    "incoterm" TEXT,
    "payment" TEXT,
    "plant" TEXT,
    "portLoading" TEXT,
    "portLoadingDate" DATETIME,
    "portDestination" TEXT,
    "portDestDate" DATETIME,
    "fxRate" REAL NOT NULL DEFAULT 83,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "preparedBy" TEXT,
    "verifiedBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productCode" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "sizeBand" TEXT,
    "pack" TEXT,
    "weightKg" REAL NOT NULL DEFAULT 0,
    "usdPerKg" REAL NOT NULL DEFAULT 0,
    "stockFgKg" REAL NOT NULL DEFAULT 0,
    "rmPriceRs" REAL,
    "stockCostRs" REAL,
    "packagingRs" REAL,
    "additiveRs" REAL,
    "processingChargeRs" REAL,
    "commissionRs" REAL,
    "exportShipmentRs" REAL,
    "ddpRs" REAL,
    "yieldPctOverride" REAL,
    "avgSizeOverride" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "comment" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenBy" TEXT,
    CONSTRAINT "QuoteSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

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
