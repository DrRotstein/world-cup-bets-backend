import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { FilterMatchesDto } from './dto/filter-matches.dto';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async findAll(@Query() filters: FilterMatchesDto) {
    return this.matchesService.findAll({
      status: filters.status,
      stage: filters.stage,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const match = await this.matchesService.findById(id);
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    return match;
  }
}
