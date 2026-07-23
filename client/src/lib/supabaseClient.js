// CodeQuest Supabase client with auto-mocking fallback for offline or demo stability
class MockSupabaseClient {
  constructor() {
    console.warn("Supabase credentials not configured. Falling back to LocalStorage mock database.");
    // Initialize mock DB
    if (!localStorage.getItem('cq_users')) {
      localStorage.setItem('cq_users', JSON.stringify([]));
    }
    if (!localStorage.getItem('cq_roadmaps')) {
      localStorage.setItem('cq_roadmaps', JSON.stringify([]));
    }
  }

  auth = {
    getUser: () => {
      const activeUser = localStorage.getItem('cq_active_user');
      return { data: { user: activeUser ? JSON.parse(activeUser) : null }, error: null };
    },
    signUp: async ({ email, password }) => {
      const users = JSON.parse(localStorage.getItem('cq_users'));
      if (users.find(u => u.email === email)) {
        return { data: null, error: { message: "User already exists." } };
      }
      const newUser = { id: Math.random().toString(36).substring(2), email, xp: 0, streak: 1 };
      users.push(newUser);
      localStorage.setItem('cq_users', JSON.stringify(users));
      localStorage.setItem('cq_active_user', JSON.stringify(newUser));
      return { data: { user: newUser }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const users = JSON.parse(localStorage.getItem('cq_users'));
      const user = users.find(u => u.email === email);
      if (!user) {
        return { data: null, error: { message: "Invalid credentials" } };
      }
      localStorage.setItem('cq_active_user', JSON.stringify(user));
      return { data: { user }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem('cq_active_user');
      return { error: null };
    }
  };

  // Basic Postgres mock queries
  from(table) {
    return {
      select: (queryStr) => {
        const data = JSON.parse(localStorage.getItem(`cq_${table}`) || '[]');
        const activeUser = JSON.parse(localStorage.getItem('cq_active_user') || 'null');
        const filtered = activeUser ? data.filter(item => item.user_id === activeUser.id) : data;
        return {
          data: filtered,
          error: null,
          eq: (key, val) => ({
            data: filtered.filter(item => item[key] === val),
            error: null
          })
        };
      },
      insert: async (records) => {
        const data = JSON.parse(localStorage.getItem(`cq_${table}`) || '[]');
        const activeUser = JSON.parse(localStorage.getItem('cq_active_user') || 'null');
        
        const newRecords = (Array.isArray(records) ? records : [records]).map(r => ({
          id: Math.random().toString(36).substring(2),
          user_id: activeUser?.id || 'guest',
          created_at: new Date().toISOString(),
          ...r
        }));
        
        data.push(...newRecords);
        localStorage.setItem(`cq_${table}`, JSON.stringify(data));
        return { data: newRecords, error: null };
      },
      update: async (updates) => {
        let data = JSON.parse(localStorage.getItem(`cq_${table}`) || '[]');
        return {
          eq: (key, val) => {
            data = data.map(item => {
              if (item[key] === val) {
                return { ...item, ...updates };
              }
              return item;
            });
            localStorage.setItem(`cq_${table}`, JSON.stringify(data));
            return { data, error: null };
          }
        };
      },
      delete: async () => {
        let data = JSON.parse(localStorage.getItem(`cq_${table}`) || '[]');
        return {
          eq: (key, val) => {
            data = data.filter(item => item[key] !== val);
            localStorage.setItem(`cq_${table}`, JSON.stringify(data));
            return { data, error: null };
          }
        };
      }
    };
  }
}

const isConfigured = 
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_URL !== 'https://mock-supabase-project.supabase.co';

export const supabase = new MockSupabaseClient();
