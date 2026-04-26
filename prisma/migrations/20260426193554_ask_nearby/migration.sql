-- CreateTable
CREATE TABLE "AskNearbyRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 5,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "areaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskNearbyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskNearbyResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conversationId" TEXT,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AskNearbyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskNearbyRequest_customerId_idx" ON "AskNearbyRequest"("customerId");

-- CreateIndex
CREATE INDEX "AskNearbyResponse_requestId_idx" ON "AskNearbyResponse"("requestId");

-- CreateIndex
CREATE INDEX "AskNearbyResponse_ownerId_idx" ON "AskNearbyResponse"("ownerId");

-- AddForeignKey
ALTER TABLE "AskNearbyRequest" ADD CONSTRAINT "AskNearbyRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskNearbyResponse" ADD CONSTRAINT "AskNearbyResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AskNearbyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskNearbyResponse" ADD CONSTRAINT "AskNearbyResponse_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
