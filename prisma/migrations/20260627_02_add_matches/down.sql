-- DropIndex
DROP INDEX IF EXISTS "matches_kickoffTime_idx";

-- DropIndex
DROP INDEX IF EXISTS "matches_status_idx";

-- DropTable
DROP TABLE IF EXISTS "matches";

-- DropEnum
DROP TYPE IF EXISTS "match_status";
