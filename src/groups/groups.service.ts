import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/interfaces/current-user.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AssignGroupMemberDto } from './dto/assign-group-member.dto';

export interface GroupRecord {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRecord {
  id: string;
  username: string;
  full_name: string;
  email: string;
}

interface GroupMemberRow {
  user_id: string;
}

@Injectable()
export class GroupsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listGroups(currentUser: CurrentUser) {
    const userId = currentUser.profile.id;
    const canViewAllGroups = await this.hasPermission(userId, 'groups:view');

    if (canViewAllGroups) {
      const { data, error } = await this.supabaseService.adminClient
        .from('groups')
        .select('*');

      if (error) {
        throw new Error(error.message);
      }

      return {
        groups: data as GroupRecord[],
      };
    }

    const canViewOwnGroups = await this.hasPermission(userId, 'group:view');
    if (!canViewOwnGroups) {
      throw new ForbiddenException('Missing permission to view groups');
    }

    const memberGroupIds = await this.getMemberGroupIds(userId);
    if (memberGroupIds.length === 0) {
      return { groups: [] };
    }

    const { data, error } = await this.supabaseService.adminClient
      .from('groups')
      .select('*')
      .in('id', memberGroupIds);

    if (error) {
      throw new Error(error.message);
    }

    return {
      groups: data as GroupRecord[],
    };
  }

  async getGroup(currentUser: CurrentUser, groupId: string) {
    await this.assertCanViewGroup(currentUser, groupId);

    const { data, error } = await this.supabaseService.adminClient
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    return {
      group: data as GroupRecord,
    };
  }

  async createGroup(currentUser: CurrentUser, dto: CreateGroupDto) {
    const { data, error } = await this.supabaseService.adminClient
      .from('groups')
      .insert({
        name: dto.name,
        description: dto.description || '',
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      group: data as GroupRecord,
    };
  }

  async updateGroup(currentUser: CurrentUser, groupId: string, dto: UpdateGroupDto) {
    const { data, error } = await this.supabaseService.adminClient
      .from('groups')
      .update({
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
      })
      .eq('id', groupId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    return {
      group: data as GroupRecord,
    };
  }

  async deleteGroup(currentUser: CurrentUser, groupId: string) {
    const { error } = await this.supabaseService.adminClient
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    return { success: true };
  }

  async listGroupMembers(currentUser: CurrentUser, groupId: string) {
    await this.assertCanViewGroup(currentUser, groupId);

    // Verify group exists
    const { data: group, error: groupError } = await this.supabaseService.adminClient
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    const { data: memberRows, error: membersError } = await this.supabaseService.adminClient
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) {
      throw new Error(membersError.message);
    }

    const memberIds = (memberRows as GroupMemberRow[]).map(item => item.user_id);
    let members: GroupMemberRecord[] = [];

    if (memberIds.length > 0) {
      const { data: userRows, error: usersError } = await this.supabaseService.adminClient
        .from('users')
        .select('id, username, full_name, email')
        .is('deleted_at', null)
        .in('id', memberIds);

      if (usersError) {
        throw new Error(usersError.message);
      }

      members = userRows as GroupMemberRecord[];
    }

    return {
      group: group as GroupRecord,
      members,
    };
  }

  async assignGroupMember(currentUser: CurrentUser, groupId: string, dto: AssignGroupMemberDto) {
    let userId: string | null = null;

    if (dto.userId) {
      userId = dto.userId;
    } else if (dto.email) {
      const { data: user, error: userError } = await this.supabaseService.adminClient
        .from('users')
        .select('id')
        .eq('email', dto.email.toLowerCase())
        .is('deleted_at', null)
        .single();

      if (userError || !user) {
        throw new NotFoundException(`User with email ${dto.email} not found`);
      }

      userId = user.id;
    } else if (dto.username) {
      const { data: user, error: userError } = await this.supabaseService.adminClient
        .from('users')
        .select('id')
        .eq('username', dto.username.toLowerCase())
        .is('deleted_at', null)
        .single();

      if (userError || !user) {
        throw new NotFoundException(`User with username ${dto.username} not found`);
      }

      userId = user.id;
    }

    if (!userId) {
      throw new BadRequestException('Must provide userId, email, or username');
    }

    const { error } = await this.supabaseService.adminClient
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
      });

    if (error) {
      if (error.message.includes('duplicate key')) {
        throw new BadRequestException('User is already a member of this group');
      }
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async removeGroupMember(currentUser: CurrentUser, groupId: string, userId: string) {
    const { error } = await this.supabaseService.adminClient
      .from('group_members')
      .delete()
      .match({ group_id: groupId, user_id: userId });

    if (error) {
      throw new NotFoundException('Member not found in group');
    }

    return { success: true };
  }

  private async assertCanViewGroup(currentUser: CurrentUser, groupId: string) {
    const userId = currentUser.profile.id;
    const canViewAllGroups = await this.hasPermission(userId, 'groups:view');
    if (canViewAllGroups) {
      return;
    }

    const canViewOwnGroups = await this.hasPermission(userId, 'group:view');
    const isMember = await this.isGroupMember(userId, groupId);
    if (!canViewOwnGroups || !isMember) {
      throw new ForbiddenException('Missing permission to view this group');
    }
  }

  private async getMemberGroupIds(userId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return (data as Array<{ group_id: string }>).map((item) => item.group_id);
  }

  private async isGroupMember(userId: string, groupId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('group_members')
      .select('id')
      .match({ user_id: userId, group_id: groupId })
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }

  private async hasPermission(userId: string, permissionCode: string) {
    const { data, error } = await this.supabaseService.adminClient.rpc('user_has_permission', {
      p_user_id: userId,
      p_permission_code: permissionCode,
      p_group_id: null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data);
  }
}
