import { Test, TestingModule } from '@nestjs/testing';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

describe('GroupsController', () => {
  let controller: GroupsController;
  let groupsService: jest.Mocked<GroupsService>;

  const mockUser = {
    id: 'user-1',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockGroup = {
    id: 'group-1',
    name: 'World Cup Buddies',
    description: 'Our betting group',
    inviteCode: 'abc-123-def',
    createdBy: 'user-1',
    createdAt: new Date('2026-06-27T12:00:00Z'),
    creator: mockUser,
  };

  const mockReq = {
    user: { userId: 'user-1', email: 'test@example.com' },
  } as Parameters<typeof controller.create>[0];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [
        {
          provide: GroupsService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockGroup),
            findMyGroups: jest
              .fn()
              .mockResolvedValue([{ ...mockGroup, _count: { memberships: 3 } }]),
            findById: jest.fn().mockResolvedValue({
              ...mockGroup,
              memberships: [{ userId: 'user-1', joinedAt: new Date(), user: mockUser }],
            }),
            joinByInviteCode: jest.fn().mockResolvedValue({
              ...mockGroup,
              _count: { memberships: 2 },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<GroupsController>(GroupsController);
    groupsService = module.get(GroupsService) as jest.Mocked<GroupsService>;
  });

  describe('POST /groups', () => {
    it('should create a group and return it with invite code', async () => {
      const result = await controller.create(mockReq, {
        name: 'World Cup Buddies',
        description: 'Our betting group',
      });

      expect(result.id).toBe('group-1');
      expect(result.inviteCode).toBe('abc-123-def');
      expect(groupsService.create).toHaveBeenCalledWith('user-1', {
        name: 'World Cup Buddies',
        description: 'Our betting group',
      });
    });
  });

  describe('GET /groups', () => {
    it('should return list of user groups with member count', async () => {
      const result = await controller.findMyGroups(mockReq);
      expect(result).toHaveLength(1);
      expect(result[0].memberCount).toBe(3);
    });
  });

  describe('GET /groups/:id', () => {
    it('should return group with members', async () => {
      const result = await controller.findOne(mockReq, 'group-1');
      expect(result.id).toBe('group-1');
      expect(result.members).toHaveLength(1);
    });
  });

  describe('POST /groups/join/:inviteCode', () => {
    it('should join a group via invite code', async () => {
      const result = await controller.join(mockReq, 'abc-123-def');
      expect(result).toBeDefined();
      expect(groupsService.joinByInviteCode).toHaveBeenCalledWith(
        'user-1',
        'abc-123-def',
      );
    });
  });
});
