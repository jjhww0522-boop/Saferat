import { TaskHome } from '@/components/task-home';
export default async function MapPage({ searchParams }: { searchParams: Promise<{ workplace?: string }> }) {
  return <TaskHome demo={false} selected={(await searchParams).workplace} view="map"/>;
}
