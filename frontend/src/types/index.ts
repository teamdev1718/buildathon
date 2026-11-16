export type User = {
  id: string;
  name: string;
  email: string;
  verifiedAt: string;
  emailOptIn: boolean;
  telegramConnected: boolean;
  roles: string[];
  permissions: string[];
};

export type Features = { google: boolean; email: boolean; loginOtp: boolean; telegram: boolean };

