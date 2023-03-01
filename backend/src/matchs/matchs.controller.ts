import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { MatchsService } from './matchs.service';
import { CreateMatchDto } from './dto/create-match.dto'
import { UpdateMatchDto } from './dto/update-match.dto'

@Controller('matchs')
export class MatchsController {
  constructor(private readonly matchsService: MatchsService) {}

  @Post()
  create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchsService.create(createMatchDto);
  }

  @Get()
  findAll() {
    return this.matchsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.matchsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() updateMatchDto: UpdateMatchDto) {
    return this.matchsService.update(id, updateMatchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.matchsService.remove(id);
  }

  @Get(':userId')
  findHistory(@Param('userId') userId: number) {
    return this.matchsService.findHistory(userId);
  }

  @Delete(':userId')
  removeHistory(@Param('userId') userId: number) {
    return this.matchsService.removeHistory(userId);
  }
  


}
