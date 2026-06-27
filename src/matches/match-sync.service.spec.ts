import { Test, TestingModule } from '@nestjs/testing';
import { MatchSyncService } from './match-sync.service';
import { MatchesService } from './matches.service';

describe('MatchSyncService', () => {
  let syncService: MatchSyncService;
  let matchesService: jest.Mocked<MatchesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchSyncService,
        {
          provide: MatchesService,
          useValue: {
            syncMatches: jest.fn().mockResolvedValue({ synced: 5, errors: 0 }),
          },
        },
      ],
    }).compile();

    syncService = module.get<MatchSyncService>(MatchSyncService);
    matchesService = module.get(MatchesService) as jest.Mocked<MatchesService>;
  });

  describe('handleSync', () => {
    it('should call matchesService.syncMatches', async () => {
      await syncService.handleSync();
      expect(matchesService.syncMatches).toHaveBeenCalledTimes(1);
    });

    it('should not throw when syncMatches rejects (error is logged)', async () => {
      matchesService.syncMatches.mockRejectedValue(new Error('sync failed'));
      // With try/catch in handleSync, errors are caught and logged — never propagated
      await expect(syncService.handleSync()).resolves.toBeUndefined();
    });
  });
});
