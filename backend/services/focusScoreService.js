/**
 * Calculate the Focus Score for a task based on Priority, Due Date, and Status.
 * 
 * Formula breakdown:
 * - Priority: High (40), Medium (25), Low (10)
 * - Due Date / Overdue:
 *     - Overdue: +45
 *     - Due Today: +40
 *     - Due Tomorrow: +35
 *     - Due within 3 days: +25
 *     - Due within 7 days (next week): +15
 *     - Due within 30 days (next month): +5
 *     - Far future (>30 days) or no due date: +0
 * - Status modifier:
 *     - Completed: 0 points (completed tasks do not require focus)
 *     - In Progress: +20 points (active engagement)
 *     - Pending: +20 points for urgent items (or +10 if far out)
 *
 * Targets:
 * High + tomorrow = 40 + 35 + 20 = 95
 * Medium + next week = 25 + 15 + 20 = 60
 * Low + next month = 10 + 5 + 10 = 25
 */
function calculateFocusScore(task) {
  if (task.status === 'Completed') {
    return 0;
  }

  let priorityScore = 10;
  if (task.priority === 'High') priorityScore = 40;
  else if (task.priority === 'Medium') priorityScore = 25;
  else if (task.priority === 'Low') priorityScore = 10;

  let dueDateScore = 0;
  let statusBonus = 20;

  if (task.dueDate) {
    const now = new Date();
    // Compare dates based on start of day
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(task.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Overdue! Maximum urgency
      dueDateScore = 45;
    } else if (diffDays === 0) {
      // Due Today
      dueDateScore = 40;
    } else if (diffDays === 1) {
      // Due Tomorrow
      dueDateScore = 35;
    } else if (diffDays <= 3) {
      // Due in 2-3 days
      dueDateScore = 25;
    } else if (diffDays <= 7) {
      // Due in next week
      dueDateScore = 15;
    } else if (diffDays <= 30) {
      // Due next month
      dueDateScore = 5;
      statusBonus = 10;
    } else {
      dueDateScore = 0;
      statusBonus = 5;
    }
  } else {
    // No due date set
    dueDateScore = 0;
    statusBonus = 10;
  }

  if (task.status === 'In Progress') {
    statusBonus += 5; // Slight bump for currently active tasks
  }

  const rawScore = priorityScore + dueDateScore + statusBonus;
  return Math.min(100, Math.max(0, rawScore));
}

module.exports = { calculateFocusScore };
