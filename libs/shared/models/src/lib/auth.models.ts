export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  permissions: string[];
  avatarUrl: string | null;
  phoneNumber: string | null;
  lastLoginAt: string;
  createdAt: string;
  isActive: boolean;
  mfaEnabled: boolean;
}

export enum AdminRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Operator = 'Operator',
  Support = 'Support',
  Viewer = 'Viewer',
  Finance = 'Finance',
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
  deviceFingerprint?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  issuedAt: string;
  scope: string[];
}

export interface AuthState {
  user: UserProfile | null;
  token: TokenResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastRefreshAt: string | null;
  sessionExpiresAt: string | null;
}
