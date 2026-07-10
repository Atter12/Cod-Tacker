import { Skeleton } from "@/components/ui";
export default function Loading() { return <main className="space-y-5 p-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div><Skeleton className="h-72 w-full" /></main>; }
