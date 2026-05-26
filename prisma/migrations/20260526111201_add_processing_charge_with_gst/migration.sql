-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNo" TEXT,
    "contractDate" DATETIME,
    "revisedDate" DATETIME,
    "customer" TEXT,
    "country" TEXT,
    "incoterm" TEXT,
    "payment" TEXT,
    "plant" TEXT,
    "freezeType" TEXT,
    "commissionOverridePerKg" REAL,
    "processingChargeWithGst" BOOLEAN NOT NULL DEFAULT false,
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
    "customVariableCosts" JSONB,
    "customFixedCosts" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Quote" ("approvedBy", "commissionOverridePerKg", "contractDate", "country", "createdAt", "customFixedCosts", "customVariableCosts", "customer", "freezeType", "fxRate", "id", "incoterm", "notes", "payment", "plant", "poNo", "portDestDate", "portDestination", "portLoading", "portLoadingDate", "preparedBy", "revisedDate", "status", "updatedAt", "verifiedBy") SELECT "approvedBy", "commissionOverridePerKg", "contractDate", "country", "createdAt", "customFixedCosts", "customVariableCosts", "customer", "freezeType", "fxRate", "id", "incoterm", "notes", "payment", "plant", "poNo", "portDestDate", "portDestination", "portLoading", "portLoadingDate", "preparedBy", "revisedDate", "status", "updatedAt", "verifiedBy" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
