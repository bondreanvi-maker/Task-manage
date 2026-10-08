const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase, getIsLive } = require('../config/supabase');

// In-memory user store for dev fallback
const memoryUsers = new Map();

const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Study', 'Shopping', 'Projects'];

class UserModel {
  constructor(data = {}) {
    this.id = data.id || data._id || crypto.randomUUID();
    this._id = this.id;
    this.name = data.name;
    this.email = data.email ? data.email.toLowerCase().trim() : '';
    this.password = data.password;
    this.customCategories = Array.isArray(data.customCategories || data.custom_categories)
      ? data.customCategories || data.custom_categories
      : DEFAULT_CATEGORIES;
    this.createdAt = data.createdAt || data.created_at || new Date().toISOString();
    this.updatedAt = data.updatedAt || data.updated_at || new Date().toISOString();
  }

  async comparePassword(candidatePassword) {
    if (!this.password || !candidatePassword) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }

  toJSON() {
    return {
      id: this.id,
      _id: this.id,
      name: this.name,
      email: this.email,
      customCategories: this.customCategories,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    if (getIsLive()) {
      const { data, error } = await supabase
        .from('users')
        .update({
          name: this.name,
          email: this.email,
          password: this.password,
          custom_categories: this.customCategories,
          updated_at: this.updatedAt,
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save user: ${error.message}`);
      }
      return UserModel.mapFromDB(data);
    } else {
      memoryUsers.set(this.id, { ...this });
      return this;
    }
  }

  static mapFromDB(row) {
    if (!row) return null;
    let categories = row.custom_categories;
    if (typeof categories === 'string') {
      try {
        categories = JSON.parse(categories);
      } catch {
        categories = DEFAULT_CATEGORIES;
      }
    }
    return new UserModel({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      customCategories: Array.isArray(categories) ? categories : DEFAULT_CATEGORIES,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  static async findOne(query = {}) {
    if (query.email) {
      const email = query.email.toLowerCase().trim();
      if (getIsLive()) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (error) {
          throw new Error(`Database error looking up user: ${error.message}`);
        }
        return UserModel.mapFromDB(data);
      } else {
        for (const u of memoryUsers.values()) {
          if (u.email.toLowerCase() === email) {
            return new UserModel(u);
          }
        }
        return null;
      }
    }

    if (query._id || query.id) {
      return UserModel.findById(query._id || query.id);
    }

    return null;
  }

  static async findById(id) {
    if (!id) return null;
    if (getIsLive()) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Database error fetching user: ${error.message}`);
      }
      return UserModel.mapFromDB(data);
    } else {
      const u = memoryUsers.get(String(id));
      return u ? new UserModel(u) : null;
    }
  }

  static async create(userData) {
    const name = userData.name?.trim();
    const email = userData.email?.toLowerCase().trim();
    let password = userData.password;

    if (!name) throw new Error('Please provide a name');
    if (!email) throw new Error('Please provide an email address');
    if (!password) throw new Error('Please provide a password');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customCategories = userData.customCategories || DEFAULT_CATEGORIES;
    const now = new Date().toISOString();

    if (getIsLive()) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          name,
          email,
          password: hashedPassword,
          custom_categories: customCategories,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const err = new Error('An account with this email address already exists.');
          err.code = 11000;
          throw err;
        }
        throw new Error(`Failed to create user: ${error.message}`);
      }

      return UserModel.mapFromDB(data);
    } else {
      // Check existing email in memory
      for (const u of memoryUsers.values()) {
        if (u.email.toLowerCase() === email) {
          const err = new Error('An account with this email address already exists.');
          err.code = 11000;
          throw err;
        }
      }

      const id = crypto.randomUUID();
      const userObj = new UserModel({
        id,
        name,
        email,
        password: hashedPassword,
        customCategories,
        createdAt: now,
        updatedAt: now,
      });

      memoryUsers.set(id, { ...userObj });
      return userObj;
    }
  }

  static async countDocuments() {
    if (getIsLive()) {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') return 0;
        throw error;
      }
      return count || 0;
    } else {
      return memoryUsers.size;
    }
  }

  select() {
    return this;
  }
}

module.exports = UserModel;
