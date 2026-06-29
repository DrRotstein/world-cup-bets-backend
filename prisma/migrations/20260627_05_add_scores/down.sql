-- DropIndex
DROP INDEX IF EXISTS "scores_groupId_idx";

-- DropIndex
DROP INDEX IF EXISTS "scores_userId_groupId_matchId_key";

-- DropTable
DROP TABLE IF EXISTS "scores";

-- DropEnum
DROP TYPE IF EXISTS "score_type";
