-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("id", "userId", "categoryId", "amount", "description", "date", "createdAt")
SELECT "id", "userId", "categoryId", "amount", "description", "date", "createdAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
PRAGMA foreign_keys=ON;

-- CreateTable
CREATE TABLE "PortfolioConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accountId" TEXT,
    "brokerAccountType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "PortfolioConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "expectedYield" REAL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PortfolioConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "figi" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT,
    "instrumentType" TEXT,
    "balance" REAL NOT NULL,
    "lot" REAL,
    "currentPrice" REAL,
    "averagePositionPrice" REAL,
    "expectedYield" REAL,
    "expectedYieldPercent" REAL,
    "currency" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioPosition_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PortfolioConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "figi" TEXT,
    "ticker" TEXT,
    "instrumentType" TEXT,
    "operationType" TEXT NOT NULL,
    "payment" REAL,
    "price" REAL,
    "quantity" REAL,
    "currency" TEXT,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "commission" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioOperation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PortfolioConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioDividend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "figi" TEXT,
    "ticker" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT,
    "paymentDate" DATETIME NOT NULL,
    "recordDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioDividend_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PortfolioConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioConnection_userId_key" ON "PortfolioConnection"("userId");
CREATE INDEX "PortfolioSnapshot_connectionId_capturedAt_idx" ON "PortfolioSnapshot"("connectionId", "capturedAt");
CREATE INDEX "PortfolioPosition_connectionId_figi_idx" ON "PortfolioPosition"("connectionId", "figi");
CREATE UNIQUE INDEX "PortfolioOperation_connectionId_operationId_key" ON "PortfolioOperation"("connectionId", "operationId");
CREATE INDEX "PortfolioOperation_connectionId_date_idx" ON "PortfolioOperation"("connectionId", "date");
CREATE INDEX "PortfolioDividend_connectionId_paymentDate_idx" ON "PortfolioDividend"("connectionId", "paymentDate");
