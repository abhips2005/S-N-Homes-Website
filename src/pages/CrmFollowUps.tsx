import { useEffect, useState } from 'react';
import { FollowUpService } from '../services/crmService';
import type { FollowUpTask, TaskStatus, TaskType } from '../types/crm';
import { CalendarCheck, Plus, RefreshCw, Check, Clock, Phone, MapPin, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICONS: Record<TaskType, JSX.Element> = {
  callback: <Phone size={14} />,
  site_visit: <MapPin size={14} />,
  follow_up: <MessageSquare size={14} />,
  review_submission: <CalendarCheck size={14} />,
};

function taskTypeColor(t: TaskType): string {
  if (t === 'callback') return 'bg-blue-100 text-blue-700';
  if (t === 'site_visit') return 'bg-green-100 text-green-700';
  return 'bg-purple-100 text-purple-700';
}

function statusBadge(s: TaskStatus): string {
  const m: Record<TaskStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  return m[s] || 'bg-gray-100 text-gray-600';
}

export default function CrmFollowUps() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ task_type: 'callback' as TaskType, due_at: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTasks(await FollowUpService.getAll(200)); }
    catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    try {
      await FollowUpService.updateStatus(id, status);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      toast.success('Task updated');
    } catch { toast.error('Failed to update task'); }
  };

  const createTask = async () => {
    if (!newTask.due_at) { toast.error('Due date is required'); return; }
    setSaving(true);
    try {
      await FollowUpService.create({
        customer_id: 'manual',
        task_type: newTask.task_type,
        due_at: newTask.due_at,
        notes: newTask.notes || undefined,
        status: 'pending',
      });
      setNewTask({ task_type: 'callback', due_at: '', notes: '' });
      setShowNew(false);
      toast.success('Task created');
      await load(); // reload the full list so we get the full FollowUpTask shape
    } catch { toast.error('Failed to create task'); }
    finally { setSaving(false); }
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toDateString();
  const filtered = tasks.filter(t => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'today') return t.status === 'pending' && new Date(t.due_at).toDateString() === today;
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  const isOverdue = (due: string) =>
    new Date(due) < new Date() && new Date(due).toDateString() !== today;
  const isDueToday = (due: string) => new Date(due).toDateString() === today;

  function cardBorder(task: FollowUpTask): string {
    if (isOverdue(task.due_at) && task.status === 'pending') return 'border-red-200 bg-red-50';
    if (isDueToday(task.due_at)) return 'border-yellow-200 bg-yellow-50';
    return 'border-gray-100';
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 px-6 pb-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarCheck size={28} className="text-teal-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
              <p className="text-gray-500 text-sm">{tasks.filter(t => t.status === 'pending').length} pending tasks</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 rounded-xl hover:bg-white border border-gray-200 text-gray-500">
              <RefreshCw size={16} />
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium text-sm">
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>

        {showNew && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create Follow-up Task</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Task Type</label>
                <select value={newTask.task_type}
                  onChange={e => setNewTask(p => ({ ...p, task_type: e.target.value as TaskType }))}
                  className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="callback">Callback</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="review_submission">Review Submission</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due Date &amp; Time</label>
                <input type="datetime-local" value={newTask.due_at}
                  onChange={e => setNewTask(p => ({ ...p, due_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea value={newTask.notes}
                onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))}
                rows={2} placeholder="Add context or notes\u2026"
                className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={createTask} disabled={saving}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 text-sm">
                {saving ? 'Creating\u2026' : 'Create Task'}
              </button>
              <button onClick={() => setShowNew(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {[['pending','Pending'],['today','Due Today'],['done','Completed'],['all','All']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={'px-4 py-2 rounded-xl text-sm font-medium transition-colors ' +
                (filter === val
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading\u2026</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(task => (
              <div key={task.id}
                className={'bg-white rounded-2xl p-5 shadow-sm border transition-all ' + cardBorder(task)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={taskTypeColor(task.task_type) + ' w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0'}>
                      {TYPE_ICONS[task.task_type]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{task.task_type.replace(/_/g, ' ')}</p>
                      {task.customer?.name && (
                        <p className="text-sm text-gray-600">{task.customer.name} \u00b7 {task.customer.phone_e164}</p>
                      )}
                      {task.notes && <p className="text-sm text-gray-500 mt-1">{task.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock size={13} className={isOverdue(task.due_at) && task.status === 'pending' ? 'text-red-500' : 'text-gray-400'} />
                      <span className={isOverdue(task.due_at) && task.status === 'pending' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {new Date(task.due_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className={'text-xs px-2.5 py-1 rounded-full font-medium ' + statusBadge(task.status)}>
                      {task.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                {task.status === 'pending' && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => updateStatus(task.id, 'in_progress')}
                      className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                      In Progress
                    </button>
                    <button onClick={() => updateStatus(task.id, 'done')}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
                      <Check size={14} /> Done
                    </button>
                    <button onClick={() => updateStatus(task.id, 'cancelled')}
                      className="px-4 py-2 bg-gray-50 text-gray-500 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
