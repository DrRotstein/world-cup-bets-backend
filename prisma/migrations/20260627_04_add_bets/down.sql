-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT IF EXISTS "bets_matchId_fkey";

-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT IF EXISTS "bets_groupId_fkey";

-- DropForeignKey
ALTER TABLE "bets" DROP CONSTRAINT IF EXISTS "bets_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "bets_groupId_matchId_idx";

-- DropIndex
DROP INDEX IF EXISTS "bets_userId_groupId_matchId_key";

-- DropTable
DROP TABLE IF EXISTS "bets";
