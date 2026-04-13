import { Body, Controller, Delete, Get, HttpCode, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import { IntOpCode } from '../common/decorators/operation-code.decorator';
import type { CurrentUser as CurrentUserType } from '../common/interfaces/current-user.interface';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AssignGroupMemberDto } from './dto/assign-group-member.dto';

@UseGuards(SupabaseAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @IntOpCode('GROUPS_LIST')
  listGroups(@CurrentUserDecorator() currentUser: CurrentUserType) {
    return this.groupsService.listGroups(currentUser);
  }

  @Get(':groupId')
  @IntOpCode('GROUPS_GET')
  getGroup(@CurrentUserDecorator() currentUser: CurrentUserType, @Param('groupId') groupId: string) {
    return this.groupsService.getGroup(currentUser, groupId);
  }

  @Post()
  @HttpCode(201)
  @IntOpCode('GROUPS_CREATE')
  createGroup(@CurrentUserDecorator() currentUser: CurrentUserType, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(currentUser, dto);
  }

  @Patch(':groupId')
  @IntOpCode('GROUPS_UPDATE')
  updateGroup(
    @CurrentUserDecorator() currentUser: CurrentUserType,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(currentUser, groupId, dto);
  }

  @Delete(':groupId')
  @IntOpCode('GROUPS_DELETE')
  deleteGroup(@CurrentUserDecorator() currentUser: CurrentUserType, @Param('groupId') groupId: string) {
    return this.groupsService.deleteGroup(currentUser, groupId);
  }

  @Get(':groupId/members')
  @IntOpCode('GROUPS_MEMBERS_LIST')
  listMembers(@CurrentUserDecorator() currentUser: CurrentUserType, @Param('groupId') groupId: string) {
    return this.groupsService.listGroupMembers(currentUser, groupId);
  }

  @Post(':groupId/members')
  @HttpCode(201)
  @IntOpCode('GROUPS_MEMBER_ASSIGN')
  assignMember(
    @CurrentUserDecorator() currentUser: CurrentUserType,
    @Param('groupId') groupId: string,
    @Body() dto: AssignGroupMemberDto,
  ) {
    return this.groupsService.assignGroupMember(currentUser, groupId, dto);
  }

  @Delete(':groupId/members/:userId')
  @IntOpCode('GROUPS_MEMBER_REMOVE')
  removeMember(
    @CurrentUserDecorator() currentUser: CurrentUserType,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.removeGroupMember(currentUser, groupId, userId);
  }
}
