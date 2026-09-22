import { TaskDetail, type TaskQuery } from '@/components/task-detail';
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<TaskQuery> }) { return <TaskDetail id={(await params).id} query={await searchParams} demo={false}/>; }
