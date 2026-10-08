/**
 * Service to handle recurring task generation upon completion.
 */
function getNextDueDate(currentDueDate, frequency) {
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  const nextDate = new Date(baseDate.getTime());

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

async function handleRecurringTaskCreation(TaskModel, completedTask) {
  if (!completedTask.recurring || !completedTask.recurring.enabled) {
    return null;
  }

  const frequency = completedTask.recurring.frequency || 'daily';
  const nextDueDate = getNextDueDate(completedTask.dueDate, frequency);

  const nextTask = new TaskModel({
    userId: completedTask.userId,
    title: completedTask.title,
    description: completedTask.description,
    status: 'Pending',
    priority: completedTask.priority,
    category: completedTask.category,
    tags: completedTask.tags,
    dueDate: nextDueDate,
    recurring: {
      enabled: true,
      frequency: frequency,
    },
  });

  await nextTask.save();
  return nextTask;
}

module.exports = {
  getNextDueDate,
  handleRecurringTaskCreation,
};
