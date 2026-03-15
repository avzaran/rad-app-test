export type UserRole = "admin" | "doctor";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  twoFaEnabled: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RefreshResponse = {
  accessToken: string;
};
