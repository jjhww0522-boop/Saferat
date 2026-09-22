import type { TaskRecord } from './tasks';

export function taskCycleNumber(task: TaskRecord) { return task.cycle_number ?? 1; }
export function taskCycleLabel(task: TaskRecord) {
  return task.definition_id === 'REVIEW-003' ? `${taskCycleNumber(task)}회차` : '';
}
export function currentTasks(tasks: TaskRecord[]) {
  const latest = new Map<string, TaskRecord>();
  for (const task of tasks) {
    const key = `${task.workplace_id}:${task.definition_id}`;
    const previous = latest.get(key);
    if (!previous || taskCycleNumber(task) > taskCycleNumber(previous)) latest.set(key, task);
  }
  return [...latest.values()];
}
