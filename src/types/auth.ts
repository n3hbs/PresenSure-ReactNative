export type UserRole = {
  role_id: number;
  role_name: string;
};

export type AuthUser = {
  user_id: string;
  first_name: string;
  middle_initial: string | null;
  last_name: string;
  suffix: string | null;
  sex: string;
  image?: string | null;
  avatar?: string | null;
  profile_photo?: string | null;
  profile_image?: string | null;
  profile?: {
    imagelink?: string | null;
  } | null;
  role: UserRole;
};

export type LoginCredentials = {
  user_id: string;
  password: string;
};

export type LoginResponse = {
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};
