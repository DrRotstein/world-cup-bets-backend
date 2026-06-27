import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

export interface FootballDataResponse {
  matches: FootballDataMatch[];
}

@Injectable()
export class FootballDataClient {
  private readonly logger = new Logger(FootballDataClient.name);
  private readonly client: AxiosInstance;
  private readonly competitionId = 2001; // FIFA World Cup

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('FOOTBALL_DATA_API_KEY', '');

    this.client = axios.create({
      baseURL: 'https://api.football-data.org/v4',
      headers: {
        'X-Auth-Token': apiKey,
      },
      timeout: 10000,
    });
  }

  async getMatches(): Promise<FootballDataMatch[]> {
    try {
      const response = await this.client.get<FootballDataResponse>(
        `/competitions/${this.competitionId}/matches`,
      );
      return response.data.matches;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.logger.warn(
            'Rate limited by football-data.org. Will retry on next sync cycle.',
          );
          throw new RateLimitError('football-data.org rate limit hit');
        }
        this.logger.error(
          `football-data.org API error: ${error.response?.status} ${error.message}`,
        );
      } else {
        this.logger.error(`Unexpected error fetching matches: ${String(error)}`);
      }
      throw error;
    }
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
