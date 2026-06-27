-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "memberships_groupId_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "memberships_userId_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT IF EXISTS "groups_createdBy_fkey";

-- DropIndex
DROP INDEX IF EXISTS "groups_inviteCode_key";

-- DropTable
DROP TABLE IF EXISTS "memberships";

-- DropTable
DROP TABLE IF EXISTS "groups";
