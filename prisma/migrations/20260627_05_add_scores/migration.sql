-- CreateEnum
CREATE TYPE "score_type" AS ENUM ('EXACT', 'DIFF', 'OUTCOME', 'WRONG');

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "betId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "score_type" NOT NULL,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scores_userId_groupId_matchId_key" ON "scores"("userId", "groupId", "matchId");

-- CreateIndex
CREATE INDEX "scores_groupId_idx" ON "scores"("groupId");
