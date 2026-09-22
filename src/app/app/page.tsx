import { TaskHome } from '@/components/task-home';
export default async function Home({ searchParams }: { searchParams: Promise<{ workplace?: string; setup?: string; focus?: string; q?: string; catalog?: string; status?: string }> }) {
  const query = await searchParams;
  return <TaskHome demo={true} selected={query.workplace} setup={query.setup === '1'} focus={query.focus} browse={Boolean(query.q || query.catalog || query.status)}/>;
}
