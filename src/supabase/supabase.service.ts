import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CurrentUser } from '../common/interfaces/current-user.interface';

@Injectable()
export class SupabaseService {
  public readonly publicClient: SupabaseClient;
  public readonly adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.getRequired('SUPABASE_URL');
    const anonKey = this.getRequired('SUPABASE_ANON_KEY');
    const secretKey = this.getRequired('SUPABASE_SECRET_KEY');

    this.publicClient = createClient(supabaseUrl, anonKey);
    this.adminClient = createClient(supabaseUrl, secretKey);
  }

  async getCurrentUserFromAccessToken(accessToken: string): Promise<CurrentUser> {
    const { data, error } = await this.publicClient.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      throw new Error('Invalid or expired token');
    }

    const email = data.user.email.toLowerCase();
    const { data: profile, error: profileError } = await this.adminClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    return {
      authUserId: data.user.id,
      email,
      profile,
    };
  }

  private getRequired(key: string): string {
    const value = this.configService.get(key);
    if (!value) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value;
  }
}
