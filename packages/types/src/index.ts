export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FOUNDER = 'FOUNDER',
  CO_FOUNDER = 'CO_FOUNDER',
  ADMIN = 'ADMIN',
  HR = 'HR',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_EXECUTIVE = 'SALES_EXECUTIVE',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  DEVELOPER = 'DEVELOPER',
  DESIGNER = 'DESIGNER',
  MARKETING_EXECUTIVE = 'MARKETING_EXECUTIVE',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  CLIENT = 'CLIENT',
}

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: Role;
  organizationId: string;
  createdAt: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  createdAt: string;
}

export interface LeadDto {
  id: string;
  title: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  status: string;
  score: number;
  assigneeId?: string | null;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  healthScore: number;
  budget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  managerId?: string | null;
  clientId?: string | null;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  projectId: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  createdAt: string;
}
