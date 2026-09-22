import { TaskHome } from '@/components/task-home';
export default async function MapPage({ searchParams }: { searchParams: Promise<{ workplace?: string }> }) {
  return <TaskHome demo selected={(await searchParams).workplace} view="map"/>;
}
