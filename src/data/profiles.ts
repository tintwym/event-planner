import { UserProfile } from '../types';

export const MOCK_PROFILES: UserProfile[] = [
  {
    id: 'u1',
    name: 'Sophia & Liam',
    email: 'sophia@amalfiwedding.com',
    role: 'Amalfi Wedding Clients',
    targetBudget: 150000,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'u2',
    name: 'Aurelia Group',
    email: 'events@aurelia.com',
    role: 'Corporate Event Planner',
    targetBudget: 80000,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'u3',
    name: 'Lead Concierge',
    email: 'concierge@villa-vale.com',
    role: 'Villa & Vale Manager',
    targetBudget: 300000,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'
  }
];
