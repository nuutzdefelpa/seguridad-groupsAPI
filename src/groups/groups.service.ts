import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async getGroup(currentUser: CurrentUser, groupId: string) {
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
}
