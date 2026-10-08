const crypto = require('crypto');
const { supabase, getIsLive } = require('../config/supabase');
const { calculateFocusScore } = require('../services/focusScoreService');

// In-memory tasks store for dev fallback
const memoryTasks = new Map();

class TaskModel {
  constructor(data = {}) {
    this.id = data.id || data._id || crypto.randomUUID();
    this._id = this.id;
    this.userId = data.userId || data.user_id;
    this.title = data.title || '';
    this.description = data.description || '';
    this.status = data.status || 'Pending';
    this.priority = data.priority || 'Medium';
    this.category = data.category || 'Work';
    this.tags = Array.isArray(data.tags)
      ? data.tags
      : typeof data.tags === 'string'
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    this.dueDate = data.dueDate || data.due_date || null;
    
    // Normalize recurring object
    let rec = data.recurring;
    if (typeof rec === 'string') {
      try {
        rec = JSON.parse(rec);
      } catch {
        rec = { enabled: false, frequency: 'daily' };
      }
    }
    this.recurring = {
      enabled: Boolean(rec && rec.enabled),
      frequency: rec && rec.frequency ? rec.frequency : 'daily',
    };

    this.focusScore = data.focusScore !== undefined 
      ? Number(data.focusScore) 
      : calculateFocusScore(this);

    this.createdAt = data.createdAt || data.created_at || new Date().toISOString();
    this.updatedAt = data.updatedAt || data.updated_at || new Date().toISOString();
  }

  toJSON() {
    return {
      _id: this.id,
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      category: this.category,
      tags: this.tags,
      dueDate: this.dueDate,
      recurring: this.recurring,
      focusScore: this.focusScore,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async save() {
    this.focusScore = calculateFocusScore(this);
    this.updatedAt = new Date().toISOString();

    if (getIsLive()) {
      // Check if task exists to decide insert or update
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', this.id)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('tasks')
          .update({
            title: this.title,
            description: this.description,
            status: this.status,
            priority: this.priority,
            category: this.category,
            tags: this.tags,
            due_date: this.dueDate,
            recurring: this.recurring,
            focus_score: this.focusScore,
            updated_at: this.updatedAt,
          })
          .eq('id', this.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update task: ${error.message}`);
        }
        return TaskModel.mapFromDB(data);
      } else {
        // Insert
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            id: this.id,
            user_id: this.userId,
            title: this.title,
            description: this.description,
            status: this.status,
            priority: this.priority,
            category: this.category,
            tags: this.tags,
            due_date: this.dueDate,
            recurring: this.recurring,
            focus_score: this.focusScore,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to insert task: ${error.message}`);
        }
        return TaskModel.mapFromDB(data);
      }
    } else {
      memoryTasks.set(this.id, { ...this });
      return this;
    }
  }

  static mapFromDB(row) {
    if (!row) return null;
    let tags = row.tags;
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    let recurring = row.recurring;
    if (typeof recurring === 'string') {
      try {
        recurring = JSON.parse(recurring);
      } catch {
        recurring = { enabled: false, frequency: 'daily' };
      }
    }

    return new TaskModel({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      category: row.category,
      tags: Array.isArray(tags) ? tags : [],
      dueDate: row.due_date,
      recurring: recurring || { enabled: false, frequency: 'daily' },
      focusScore: row.focus_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  static find(queryObj = {}) {
    let sortOption = null;

    const execute = async () => {
      let results = [];

      if (getIsLive()) {
        let dbQuery = supabase.from('tasks').select('*');

        if (queryObj.userId) {
          dbQuery = dbQuery.eq('user_id', queryObj.userId);
        }

        // Status filter (string or $ne)
        if (queryObj.status) {
          if (typeof queryObj.status === 'object' && queryObj.status.$ne) {
            dbQuery = dbQuery.neq('status', queryObj.status.$ne);
          } else if (typeof queryObj.status === 'string') {
            dbQuery = dbQuery.eq('status', queryObj.status);
          }
        }

        // Priority filter
        if (queryObj.priority) {
          dbQuery = dbQuery.eq('priority', queryObj.priority);
        }

        // Category filter
        if (queryObj.category && queryObj.category !== 'All') {
          dbQuery = dbQuery.eq('category', queryObj.category);
        }

        // Tag filter
        if (queryObj.tags) {
          dbQuery = dbQuery.contains('tags', JSON.stringify([queryObj.tags]));
        }

        // Date filter ($gte, $lte, $lt)
        if (queryObj.dueDate) {
          if (queryObj.dueDate.$gte) {
            dbQuery = dbQuery.gte('due_date', new Date(queryObj.dueDate.$gte).toISOString());
          }
          if (queryObj.dueDate.$lte) {
            dbQuery = dbQuery.lte('due_date', new Date(queryObj.dueDate.$lte).toISOString());
          }
          if (queryObj.dueDate.$lt) {
            dbQuery = dbQuery.lt('due_date', new Date(queryObj.dueDate.$lt).toISOString());
          }
        }

        // Search text ($or with RegExp or string)
        if (queryObj.$or && Array.isArray(queryObj.$or)) {
          let searchTerms = [];
          for (const condition of queryObj.$or) {
            if (condition.title) {
              const term = condition.title.source || condition.title;
              if (term) searchTerms.push(term);
            }
          }
          if (searchTerms.length > 0) {
            const term = searchTerms[0];
            dbQuery = dbQuery.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
          }
        }

        const { data, error } = await dbQuery;
        if (error) {
          throw new Error(`Database error querying tasks: ${error.message}`);
        }

        results = (data || []).map(TaskModel.mapFromDB);
      } else {
        // In-memory query evaluation
        results = Array.from(memoryTasks.values())
          .filter((t) => {
            if (queryObj.userId && String(t.userId) !== String(queryObj.userId)) return false;
            
            if (queryObj.status) {
              if (typeof queryObj.status === 'object' && queryObj.status.$ne) {
                if (t.status === queryObj.status.$ne) return false;
              } else if (t.status !== queryObj.status) {
                return false;
              }
            }

            if (queryObj.priority && t.priority !== queryObj.priority) return false;
            if (queryObj.category && queryObj.category !== 'All' && t.category !== queryObj.category) return false;

            if (queryObj.tags) {
              if (!t.tags || !t.tags.includes(queryObj.tags)) return false;
            }

            if (queryObj.dueDate) {
              if (!t.dueDate) return false;
              const due = new Date(t.dueDate).getTime();
              if (queryObj.dueDate.$gte && due < new Date(queryObj.dueDate.$gte).getTime()) return false;
              if (queryObj.dueDate.$lte && due > new Date(queryObj.dueDate.$lte).getTime()) return false;
              if (queryObj.dueDate.$lt && due >= new Date(queryObj.dueDate.$lt).getTime()) return false;
            }

            if (queryObj.$or && Array.isArray(queryObj.$or)) {
              let matched = false;
              for (const cond of queryObj.$or) {
                if (cond.title instanceof RegExp && cond.title.test(t.title)) matched = true;
                if (cond.description instanceof RegExp && cond.description.test(t.description)) matched = true;
                if (typeof cond.title === 'string' && t.title.toLowerCase().includes(cond.title.toLowerCase())) matched = true;
                if (typeof cond.description === 'string' && t.description.toLowerCase().includes(cond.description.toLowerCase())) matched = true;
              }
              if (!matched) return false;
            }

            return true;
          })
          .map((t) => new TaskModel(t));
      }

      if (sortOption) {
        results.sort((a, b) => {
          if (sortOption.focusScore) {
            const diff = (b.focusScore || 0) - (a.focusScore || 0);
            if (diff !== 0) return diff * sortOption.focusScore * -1;
          }
          if (sortOption.dueDate) {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (diff !== 0) return diff * sortOption.dueDate;
          }
          if (sortOption.title) {
            const cmp = (a.title || '').localeCompare(b.title || '');
            if (cmp !== 0) return cmp * sortOption.title;
          }
          if (sortOption.createdAt) {
            const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return diff * (sortOption.createdAt === 1 ? -1 : 1);
          }
          return 0;
        });
      }

      return results;
    };

    return {
      sort(sortOpt) {
        sortOption = sortOpt;
        return execute();
      },
      then(onFulfilled, onRejected) {
        return execute().then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return execute().catch(onRejected);
      },
    };
  }

  static async findOne(queryObj = {}) {
    const id = queryObj._id || queryObj.id;
    const userId = queryObj.userId || queryObj.user_id;

    if (getIsLive()) {
      let q = supabase.from('tasks').select('*');
      if (id) q = q.eq('id', id);
      if (userId) q = q.eq('user_id', userId);

      const { data, error } = await q.maybeSingle();
      if (error) {
        throw new Error(`Database error fetching task: ${error.message}`);
      }
      return TaskModel.mapFromDB(data);
    } else {
      for (const t of memoryTasks.values()) {
        if (id && String(t.id) !== String(id)) continue;
        if (userId && String(t.userId) !== String(userId)) continue;
        return new TaskModel(t);
      }
      return null;
    }
  }

  static async findOneAndDelete(queryObj = {}) {
    const id = queryObj._id || queryObj.id;
    const userId = queryObj.userId || queryObj.user_id;

    if (getIsLive()) {
      const existing = await TaskModel.findOne(queryObj);
      if (!existing) return null;

      let q = supabase.from('tasks').delete().eq('id', id);
      if (userId) q = q.eq('user_id', userId);

      const { error } = await q;
      if (error) {
        throw new Error(`Database error deleting task: ${error.message}`);
      }
      return existing;
    } else {
      const existing = await TaskModel.findOne(queryObj);
      if (existing) {
        memoryTasks.delete(existing.id);
      }
      return existing;
    }
  }

  static async deleteMany(queryObj = {}) {
    const userId = queryObj.userId || queryObj.user_id;

    if (getIsLive()) {
      let q = supabase.from('tasks').delete();
      if (userId) q = q.eq('user_id', userId);
      else q = q.neq('id', '00000000-0000-0000-0000-000000000000');

      const { error } = await q;
      if (error) {
        throw new Error(`Database error deleting tasks: ${error.message}`);
      }
      return true;
    } else {
      if (userId) {
        for (const [key, val] of memoryTasks.entries()) {
          if (String(val.userId) === String(userId)) {
            memoryTasks.delete(key);
          }
        }
      } else {
        memoryTasks.clear();
      }
      return true;
    }
  }

  static async countDocuments(queryObj = {}) {
    if (getIsLive()) {
      let q = supabase.from('tasks').select('*', { count: 'exact', head: true });
      if (queryObj.userId) q = q.eq('user_id', queryObj.userId);
      const { count, error } = await q;
      if (error) {
        if (error.code === '42P01') return 0;
        throw error;
      }
      return count || 0;
    } else {
      if (queryObj.userId) {
        let count = 0;
        for (const val of memoryTasks.values()) {
          if (String(val.userId) === String(queryObj.userId)) count++;
        }
        return count;
      }
      return memoryTasks.size;
    }
  }
}

module.exports = TaskModel;
