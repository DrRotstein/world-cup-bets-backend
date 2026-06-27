import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: {
    group: Record<string, jest.Mock>;
    membership: Record<string, jest.Mock>;
  };

  const mockUser = {
    id: 'user-1',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockGroup = {
    id: 'group-1',
    name: 'World Cup Buddies',
    description: 'Our betting group',
    inviteCode: 'Abc12xYz',
    createdBy: 'user-1',
    createdAt: new Date('2026-06-27T12:00:00Z'),
    creator: mockUser,
  };

  beforeEach(async () => {
    prisma = {
      group: {
        create: jest.fn().mockResolvedValue(mockGroup),
        findMany: jest
          .fn()
          .mockResolvedValue([{ ...mockGroup, _count: { memberships: 3 } }]),
        findUnique: jest.fn().mockResolvedValue({
          ...mockGroup,
          memberships: [
            {
              userId: 'user-1',
              joinedAt: new Date(),
              user: mockUser,
            },
          ],
        }),
      },
      membership: {
        create: jest.fn().mockResolvedValue({ userId: 'user-2', groupId: 'group-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  describe('create', () => {
    it('should create a group with short invite code and add creator as member', async () => {
      const result = await service.create('user-1', {
        name: 'World Cup Buddies',
        description: 'Our betting group',
      });

      expect(result).toEqual(mockGroup);
      expect(prisma.group.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'World Cup Buddies',
          description: 'Our betting group',
          inviteCode: expect.any(String),
          createdBy: 'user-1',
          memberships: { create: { userId: 'user-1' } },
        }),
        include: {
          creator: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });

      // Verify invite code is short (8 chars)
      const callArgs = prisma.group.create.mock.calls[0][0];
      expect(callArgs.data.inviteCode).toHaveLength(8);
    });
  });

  describe('findMyGroups', () => {
    it('should return groups the user is a member of', async () => {
      const result = await service.findMyGroups('user-1');
      expect(result).toHaveLength(1);
      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberships: { some: { userId: 'user-1' } } },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return group with members for a group member', async () => {
      const result = await service.findById('group-1', 'user-1');
      expect(result.id).toBe('group-1');
      expect(result.memberships).toHaveLength(1);
    });

    it('should throw NotFoundException when group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user is not a member', async () => {
      prisma.group.findUnique.mockResolvedValue({
        ...mockGroup,
        memberships: [{ userId: 'other-user', joinedAt: new Date(), user: mockUser }],
      });
      await expect(service.findById('group-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('joinByInviteCode', () => {
    it('should join a group via invite code', async () => {
      prisma.group.findUnique
        .mockResolvedValueOnce(mockGroup) // find by inviteCode
        .mockResolvedValueOnce({
          ...mockGroup,
          _count: { memberships: 4 },
        }); // return group after join

      const result = await service.joinByInviteCode('user-2', 'Abc12xYz');
      expect(result).toBeDefined();
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: { userId: 'user-2', groupId: 'group-1' },
      });
    });

    it('should throw NotFoundException for invalid invite code', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      await expect(service.joinByInviteCode('user-2', 'invalid-code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on P2002 unique constraint (race-safe)', async () => {
      prisma.group.findUnique.mockResolvedValue(mockGroup);
      prisma.membership.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(service.joinByInviteCode('user-2', 'Abc12xYz')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow unexpected errors', async () => {
      prisma.group.findUnique.mockResolvedValue(mockGroup);
      prisma.membership.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.joinByInviteCode('user-2', 'Abc12xYz')).rejects.toThrow(
        'DB connection lost',
      );
    });
  });
});
